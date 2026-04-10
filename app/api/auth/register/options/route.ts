import { generateRegistrationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    // Fetch existing user to find mapped credentials
    const user = await User.findOne({ userId });
    
    // Support Multiple Devices: Map all existing credentials into exclude list to prevent duplicate keys
    const excludeCredentials = user?.credentials?.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports,
    })) || [];

    const options = await generateRegistrationOptions({
        rpName: 'RealityLimit Bank',
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userID: new TextEncoder().encode(userId),
        userName: userId,
        excludeCredentials,
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
