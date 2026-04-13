import dbConnect from '@/lib/db';
import { User, Challenge, verifyRecoveryCode } from '@/lib/models';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import crypto from 'crypto';

// POST /api/auth/recovery/verify
// Verifies recovery code — if valid, returns WebAuthn registration options
// so the user can register a new device without their old device.
export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { userId, recoveryCode, deviceName } = body;

        if (!userId || !recoveryCode) {
            return Response.json({ error: 'userId and recoveryCode are required' }, { status: 400 });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }
        if (!user.recoveryCodeHash) {
            return Response.json({ error: 'No recovery code set for this account. Generate one while logged in first.' }, { status: 404 });
        }

        // Constant-time comparison — prevents timing attacks
        const isValid = verifyRecoveryCode(recoveryCode, user.recoveryCodeHash);
        if (!isValid) {
            return Response.json({ error: 'Invalid recovery code. Check your saved code and try again.' }, { status: 401 });
        }

        // Recovery code is valid — generate registration options for new device
        const options = await generateRegistrationOptions({
            rpName: 'RealityLimit Auth',
            rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            // userID must be Uint8Array in @simplewebauthn/server v13+
            userID: new TextEncoder().encode(userId),
            userName: userId,
            attestationType: 'none',
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'required',
                userVerification: 'required',
            },
            // Exclude existing credentials — forces a truly NEW hardware key
            excludeCredentials: user.credentials.map((cred: any) => ({
                id: cred.credentialID,
                type: 'public-key',
            })),
        });

        // Store challenge
        await Challenge.create({
            userId,
            challenge: options.challenge,
            intent: JSON.stringify({ action: 'recovery-device-add', deviceName: deviceName || 'Recovery Device' }),
            createdAt: new Date()
        });

        return Response.json(options);

    } catch (err: any) {
        console.error('[recovery/verify] Error:', err);
        return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
