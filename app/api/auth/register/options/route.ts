import { generateRegistrationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

import crypto from 'crypto';

export async function POST(req: Request) {
    await dbConnect();
    const body = await req.json();
    const userId = body.userId;

    // SECURITY PATCH: Prevent NoSQL Injection via Object Operators { "$ne": null }
    if (typeof userId !== 'string' || !userId) {
        return Response.json({ error: 'Invalid userId format' }, { status: 400 });
    }

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
        userDisplayName: userId, // VITAL: Passkey Vaults crash over CaBLE if this is missing because they cannot name the credential!
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'required' 
        },
    });

    await Challenge.findOneAndUpdate(
        { userId },
        { challenge: options.challenge, createdAt: new Date() },
        { upsert: true, new: true }
    );

    return Response.json(options);
}
