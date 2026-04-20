import dbConnect from '@/lib/db';
import { User, Challenge } from '@/lib/models';
import { generateRegistrationOptions } from '@simplewebauthn/server';

// POST /api/auth/devices/add/options
// Generates WebAuthn registration options for an authenticated user adding a second device.
export async function POST(req: Request) {
    try {
        await dbConnect();
        const { userId, deviceName } = await req.json();

        if (!userId) {
            return Response.json({ error: 'userId is required' }, { status: 400 });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        const options = await generateRegistrationOptions({
            rpName: 'RealityLimit Auth',
            rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            userID: new TextEncoder().encode(userId), // Required as Uint8Array in v13+
            userName: userId,
            attestationType: 'none',
            authenticatorSelection: {
                // Changing from 'required' to 'preferred'. 
                // Smartphones will STILL generate strict Resident Keys + FaceID, 
                // but setting it to 'preferred' stops Windows CaBLE tunnels from crashing.
                residentKey: 'preferred',
                userVerification: 'preferred',
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
