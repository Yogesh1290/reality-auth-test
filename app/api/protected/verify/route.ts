import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';
import { verifyTransactionExecution } from '@realitylimit/core/server';

export async function POST(req: Request) {
    await dbConnect();
    const { attResp, userId } = await req.json();

    const challengeDoc = await Challenge.findOne({ userId, intent: { $exists: true } }).sort({ createdAt: -1 });
    if (!challengeDoc) return Response.json({ verified: false, error: 'Transaction challenge expired or missing' }, { status: 400 });

    const intent = JSON.parse(challengeDoc.intent || '{}');

    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ verified: false, error: 'User credential not registered' }, { status: 400 });
    }

    const activeCredential = user.credentials.find((cred: any) => cred.credentialID === attResp.id);
    if (!activeCredential) {
        return Response.json({ verified: false, error: 'Authenticator is not mapped to this user' }, { status: 400 });
    }

    // Check sufficient balance before signing
    const transferAmount = Number(intent.amount || 0);
    if (user.balance < transferAmount) {
        return Response.json({ verified: false, error: `Insufficient balance. Available: $${user.balance}` }, { status: 400 });
    }

    try {
        const verification = await verifyTransactionExecution(
             process.env.NEXT_PUBLIC_RP_ID || 'localhost',
             process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
             attResp,
             challengeDoc.challenge,
             activeCredential
        );

        if (verification.verified) {
            await Challenge.deleteOne({ _id: challengeDoc._id });
            activeCredential.counter = verification.authenticationInfo.newCounter;

            // Deduct balance and persist to DB
            user.balance = (user.balance ?? 125000) - transferAmount;
            await user.save();

            return Response.json({
                verified: true,
                newBalance: user.balance,
                message: `Hardware Signed Transaction Approved! $${transferAmount} transferred successfully.`
            });
        }

        return Response.json({ verified: false, error: 'Physical Cryptographic Validation Failed' }, { status: 401 });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
