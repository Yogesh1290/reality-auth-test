import dbConnect from '@/lib/db';
import { User, Challenge } from '@/lib/models';
import { generateRegistrationOptions } from '@simplewebauthn/server';

import crypto from 'crypto';

// POST /api/auth/devices/add/options
// Generates WebAuthn registration options for an authenticated user adding a second device.
export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const userId = body.userId;
        const deviceName = body.deviceName;

        // SECURITY PATCH: Prevent NoSQL Injection via Object Operators { "$ne": null }
        if (typeof userId !== 'string' || !userId) {
            return Response.json({ error: 'Invalid userId format' }, { status: 400 });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Windows 11 CaBLE Protocol Strict Rule: userID MUST be universally unique and ideally exactly 32 bytes natively.
        const hashedUserId = new Uint8Array(crypto.createHash('sha256').update(userId).digest());

        const options = await generateRegistrationOptions({
            rpName: 'RealityLimit Auth',
            rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            userID: hashedUserId, // Required as Uint8Array 32-byte hash
            userName: userId,
            userDisplayName: userId, // VITAL for CaBLE Passkey Vault rendering!
            timeout: 60000,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
            },
            // Exclude credentials already registered to force a truly new key
            excludeCredentials: user.credentials.map((cred: any) => ({
                id: cred.credentialID,
                type: 'public-key',
            })),
        });

        await Challenge.create({
            userId,
            challenge: options.challenge,
            intent: JSON.stringify({ action: 'add-device', deviceName: deviceName || 'New Device' }),
            createdAt: new Date()
        });

        return Response.json(options);
    } catch (err: any) {
        console.error('[devices/add/options] Error:', err);
        return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
