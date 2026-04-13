import dbConnect from '@/lib/db';
import { User } from '@/lib/models';

// DELETE /api/auth/devices/remove
// Removes a specific device credential from the user's account.
// The user must have at least one other device remaining — 
// removing the last device would lock the account.
export async function DELETE(req: Request) {
    await dbConnect();
    const { userId, credentialID } = await req.json();

    if (!userId || !credentialID) {
        return Response.json({ error: 'userId and credentialID are required' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.credentials.length <= 1) {
        return Response.json({
            error: 'Cannot remove the last registered device. Register a new device before removing this one, or use account recovery.'
        }, { status: 400 });
    }

    const credentialExists = user.credentials.some((c: any) => c.credentialID === credentialID);
    if (!credentialExists) {
        return Response.json({ error: 'Credential not found for this user' }, { status: 404 });
    }

    // Remove the specific credential
    user.credentials = user.credentials.filter((c: any) => c.credentialID !== credentialID);
    await user.save();

    return Response.json({
        verified: true,
        message: 'Device removed successfully.',
        remainingDevices: user.credentials.length
    });
}
