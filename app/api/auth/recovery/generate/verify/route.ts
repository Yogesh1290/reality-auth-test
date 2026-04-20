import dbConnect from '@/lib/db';
import { Challenge, User, generateRecoveryCode } from '@/lib/models';
import { verifyTransactionExecution } from '@realitylimit/core/server';

export async function POST(req: Request) {
    await dbConnect();
    const { attResp, userId } = await req.json();

    const challengeDoc = await Challenge.findOne({ userId, intent: { $exists: true } }).sort({ createdAt: -1 });
    if (!challengeDoc) return Response.json({ verified: false, error: 'Transaction challenge expired or missing' }, { status: 400 });

    const intent = JSON.parse(challengeDoc.intent || '{}');

    // ONLY ALLOW GENERATE RECOVERY INTENT HERE
    if (intent.action !== "generate-recovery-code") {
        return Response.json({ verified: false, error: 'Invalid intent for this endpoint.' }, { status: 400 });
    }

    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ verified: false, error: 'User credential not registered' }, { status: 400 });
    }

    const activeCredential = user.credentials.find((cred: any) => cred.credentialID === attResp.id);
    if (!activeCredential) {
        return Response.json({ verified: false, error: 'Authenticator is not mapped to this user' }, { status: 400 });
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
            // Consume challenge
            await Challenge.deleteOne({ _id: challengeDoc._id });
            activeCredential.counter = verification.authenticationInfo.newCounter;

            // Generate cryptographically random recovery code
            const { plaintext, hash } = generateRecoveryCode();

            // Store ONLY the hash — plaintext is discarded server-side after this response
            user.recoveryCodeHash = hash;
            await user.save();

            return Response.json({
                verified: true,
                recoveryCode: plaintext,
                message: 'Recovery code generated securely via FIDO authorization.'
            });
        }

        return Response.json({ verified: false, error: 'Physical Cryptographic Validation Failed' }, { status: 401 });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
