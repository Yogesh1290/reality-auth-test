import { generateRegistrationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

import crypto from 'crypto';

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    const user = await User.findOne({ userId });
    
    // Safely structure credentials or leave undefined to prevent CaBLE array crashes
    const excludeCredentials = user?.credentials?.length > 0 ? user.credentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
    })) : undefined;

    // Windows 11 CaBLE Protocol Strict Rule: userID MUST be universally unique and ideally exactly 32 or 64 bytes natively.
    // Short 5-byte TextEncoder strings trigger internal parsing assertions in the Hybrid transport bridge!
    const hashedUserId = new Uint8Array(crypto.createHash('sha256').update(userId).digest());

    const options = await generateRegistrationOptions({
        rpName: 'RealityLimit Bank',
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userID: hashedUserId,
        userName: userId,
        timeout: 60000,
        attestationType: 'none',
        // iPhones strictly use ES256 (-7) for Passkeys. If RS256 (-257) is negotiated over CaBLE, the iPhone bridge may aggressively crash!
        supportedAlgorithmIDs: [-7], 
        excludeCredentials,
        authenticatorSelection: {
            residentKey: 'required', // Passkeys must technically be resident
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
