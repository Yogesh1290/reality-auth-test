import dbConnect from '@/lib/db';
import { User, generateRecoveryCode } from '@/lib/models';

// POST /api/auth/recovery/generate
// Generates a new recovery code for the authenticated user.
// The plaintext is shown ONCE and never stored — only the SHA-256 hash is saved.
export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await req.json();

    if (!userId) {
        return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate cryptographically random recovery code
    const { plaintext, hash } = generateRecoveryCode();

    // Store ONLY the hash — plaintext is discarded server-side after this response
    user.recoveryCodeHash = hash;
    await user.save();

    return Response.json({
        recoveryCode: plaintext,
        message: 'Save this code securely. It will NOT be shown again. Use it to access your account if you lose all registered devices.'
    });
}
