import { generateAuthenticationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const body = await req.json();
    const userId = body.userId;
    const intent = body.intent;

    // SECURITY PATCH: Prevent NoSQL Injection
    if (typeof userId !== 'string' || !userId) {
        return Response.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ status: 'error', message: 'User not registered.' }, { status: 400 });
    }

    const allowCredentials = user.credentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports && cred.transports.length > 0 ? cred.transports : ['internal', 'hybrid'],
    }));

    // Generate a fresh FIDO challenge bound to this intent
    const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userVerification: 'required',
        allowCredentials
    });

    // Store challenge with the intent — server side, tamper-proof
    await Challenge.create({
        userId,
        challenge: options.challenge,
        intent: JSON.stringify(intent),
        createdAt: new Date()
    });

    return Response.json(options);
}
