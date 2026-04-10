import { generateAuthenticationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, UserCredential } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    // Check if user is registered in MongoDB
    const userCredential = await UserCredential.findOne({ userId });
    if (!userCredential) {
        return Response.json({ status: 'error', message: 'User not registered. Please register first.' }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userVerification: 'required',
        allowCredentials: [{
            id: userCredential.credentialID,
            transports: ['internal', 'hybrid'] as any
        }]
    });

    // Save login challenge to DB
    await Challenge.findOneAndUpdate(
        { userId },
        { challenge: options.challenge, createdAt: new Date() },
        { upsert: true, new: true }
    );

    return Response.json(options);
}
