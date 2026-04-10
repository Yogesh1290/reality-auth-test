import { generateAuthenticationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    // Check if user is registered in MongoDB
    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ status: 'error', message: 'User not registered or no credentials found. Please register first.' }, { status: 400 });
    }

    const allowCredentials = user.credentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports && cred.transports.length > 0 ? cred.transports : ['internal', 'hybrid'],
    }));

    const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userVerification: 'required',
        allowCredentials
    });

    // Save login challenge to DB
    await Challenge.findOneAndUpdate(
        { userId },
        { challenge: options.challenge, createdAt: new Date() },
        { upsert: true, new: true }
    );

    return Response.json(options);
}
