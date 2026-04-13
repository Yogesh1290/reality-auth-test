import dbConnect from '@/lib/db';
import { User, verifyRecoveryCode } from '@/lib/models';
import { generateRegistrationOptions } from '@simplewebauthn/server';

// POST /api/auth/recovery/verify
// Verifies the recovery code and if valid, returns WebAuthn registration options
// so the user can register a new device without their old one.
export async function POST(req: Request) {
    await dbConnect();
    const { userId, recoveryCode, deviceName } = await req.json();

    if (!userId || !recoveryCode) {
        return Response.json({ error: 'userId and recoveryCode are required' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user || !user.recoveryCodeHash) {
        return Response.json({ error: 'No recovery code configured for this user' }, { status: 404 });
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = verifyRecoveryCode(recoveryCode, user.recoveryCodeHash);
    if (!isValid) {
        return Response.json({ error: 'Invalid recovery code' }, { status: 401 });
    }

    // Recovery code is valid — generate new device registration options
    const options = await generateRegistrationOptions({
        rpName: 'RealityLimit Auth',
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userName: userId,
        attestationType: 'none',
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'required',
            userVerification: 'required',
        },
        // Exclude existing credentials so same device can't be re-registered
        excludeCredentials: user.credentials.map((cred: any) => ({
            id: cred.credentialID,
            type: 'public-key',
        })),
    });

    // Store challenge temporarily
    const { Challenge } = await import('@/lib/models');
    await Challenge.create({
        userId,
        challenge: options.challenge,
        intent: JSON.stringify({ action: 'recovery-device-add', deviceName: deviceName || 'Recovery Device' }),
        createdAt: new Date()
    });

    return Response.json(options);
}
