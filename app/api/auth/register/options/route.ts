import { generateRegistrationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    const user = await User.findOne({ userId });
    
    // Safely structure credentials or leave undefined to prevent CaBLE array crashes
    const excludeCredentials = user?.credentials?.length > 0 ? user.credentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
    })) : undefined;

    const options = await generateRegistrationOptions({
        rpName: 'RealityLimit Bank',
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userID: new TextEncoder().encode(userId),
        userName: userId,
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: {
            // FIX: Changing from 'required' to 'preferred'. 
            // Smartphones (Apple/Android) will STILL generate strict Resident Keys + FaceID, 
            // but setting it to 'preferred' stops Windows CaBLE tunnels from crashing the handshake.
            residentKey: 'preferred',
            userVerification: 'preferred'
        },
    });

    await Challenge.findOneAndUpdate(
        { userId },
        { challenge: options.challenge, createdAt: new Date() },
        { upsert: true, new: true }
    );

    return Response.json(options);
}
