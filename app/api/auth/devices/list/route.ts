import dbConnect from '@/lib/db';
import { User } from '@/lib/models';

// GET /api/auth/devices/list?userId=xxx
// Returns all registered devices for a user (without sensitive key data)
export async function GET(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Return only safe display fields — never the public key bytes
    const devices = user.credentials.map((cred: any) => ({
        credentialID: cred.credentialID,
        deviceName: cred.deviceName || 'Unknown Device',
        registeredAt: cred.registeredAt || null,
        counter: cred.counter,
    }));

    return Response.json({
        devices,
        hasRecoveryCode: !!user.recoveryCodeHash
    });
}
