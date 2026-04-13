import dbConnect from '@/lib/db';
import { User } from '@/lib/models';

// GET /api/auth/balance?userId=xxx
export async function GET(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    const user = await User.findOne({ userId });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    return Response.json({ balance: user.balance ?? 125000 });
}
