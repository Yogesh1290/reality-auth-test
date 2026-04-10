import { generateRegistrationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, UserCredential } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    // Check if user already exists
    const existingUser = await UserCredential.findOne({ userId });
    if (existingUser) {
        return Response.json({ status: 'error', message: 'User already exists' }, { status: 400 });
    }

    const options = await generateRegistrationOptions({
        rpName: 'RealityLimit Bank',
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userID: new TextEncoder().encode(userId),
        userName: userId,
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'required'
        },
    });

    // Save challenge to MongoDB
    await Challenge.findOneAndUpdate(
        { userId },
        { challenge: options.challenge, createdAt: new Date() },
        { upsert: true, new: true }
    );

    return Response.json(options);
}
