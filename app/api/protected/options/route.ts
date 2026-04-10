import { generateAuthenticationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { userId, intent } = await req.json();

    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ status: 'error', message: 'User not registered.' }, { status: 400 });
    }

    const allowCredentials = user.credentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports && cred.transports.length > 0 ? cred.transports : ['internal', 'hybrid'],
    }));

    // generate FIDO challenge
    const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userVerification: 'required',
        allowCredentials
    });

    // Save transaction challenge explicitly marking the intent
    await Challenge.create({
        userId,
        challenge: options.challenge,
        intent: JSON.stringify(intent),
        createdAt: new Date()
    });

    return Response.json(options);
}
