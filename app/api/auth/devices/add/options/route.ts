import dbConnect from '@/lib/db';
import { User, Challenge } from '@/lib/models';
import { generateRegistrationOptions } from '@simplewebauthn/server';

// POST /api/auth/devices/add/options
// Generates WebAuthn registration options for an already authenticated user
// who wants to register a second (or additional) device.
export async function POST(req: Request) {
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
        userName: userId,
        attestationType: 'none',
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'required',
            userVerification: 'required',
        },
        // Exclude credentials already registered
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
}
