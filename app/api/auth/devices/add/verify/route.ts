import dbConnect from '@/lib/db';
import { User, Challenge } from '@/lib/models';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

// POST /api/auth/devices/add/verify
// Verifies the new device registration and appends the credential to the user's array.
export async function POST(req: Request) {
    await dbConnect();
    const { userId, attResp, deviceName } = await req.json();

    const challengeDoc = await Challenge.findOne({ userId, intent: /add-device|recovery-device-add/ }).sort({ createdAt: -1 });
    if (!challengeDoc) {
        return Response.json({ error: 'Registration challenge expired or missing' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: attResp,
            expectedChallenge: challengeDoc.challenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        });

        if (!verification.verified || !verification.registrationInfo) {
            return Response.json({ error: 'Device verification failed' }, { status: 401 });
        }

        const { credential } = verification.registrationInfo;

        // Append the new device credential to the existing array
        user.credentials.push({
            credentialID: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey),
            counter: credential.counter,
            transports: attResp.response.transports || [],
            deviceName: deviceName || 'New Device',
            registeredAt: new Date(),
        });

        // If this was a recovery registration, invalidate the recovery code (single-use)
        const intent = JSON.parse(challengeDoc.intent || '{}');
        if (intent.action === 'recovery-device-add') {
            user.recoveryCodeHash = undefined;
        }

        await user.save();
        await Challenge.deleteOne({ _id: challengeDoc._id });

        const mappedDevices = user.credentials.map((cred: any) => ({
            credentialID: cred.credentialID,
            deviceName: cred.deviceName || 'Unknown Device',
            registeredAt: cred.registeredAt || null,
        }));

        return Response.json({
            verified: true,
            message: `New device "${deviceName || 'New Device'}" registered successfully.`,
            devices: mappedDevices,
            totalDevices: user.credentials.length
        });
    } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 400 });
    }
}
