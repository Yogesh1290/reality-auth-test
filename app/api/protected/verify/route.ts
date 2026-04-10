import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { attResp, userId } = await req.json();

    // Find the latest challenge specifically generated for a transaction
    const challengeDoc = await Challenge.findOne({ userId, intent: { $exists: true } }).sort({ createdAt: -1 });
    if (!challengeDoc) return Response.json({ verified: false, error: 'Transaction challenge expired or missing' }, { status: 400 });
    const expectedChallenge = challengeDoc.challenge;
    
    // Safety check - what is the intent?
    const intent = JSON.parse(challengeDoc.intent || '{}');

    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ verified: false, error: 'User credential not registered' }, { status: 400 });
    }

    const activeCredential = user.credentials.find((cred: any) => cred.credentialID === attResp.id);
    if (!activeCredential) {
        return Response.json({ verified: false, error: 'Authenticator is not mapped to this user' }, { status: 400 });
    }

    try {
        // NATIVE FIDO TRANSACTION SIGNING: Apple/Google mathematically signs the challenge
        // which officially authorizes the embedded intent! No external Javascript MACs!
        const verification = await verifyAuthenticationResponse({
            response: attResp,
            expectedChallenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            credential: {
                id: activeCredential.credentialID,
                publicKey: activeCredential.credentialPublicKey,
                counter: activeCredential.counter,
                transports: attResp.response.transports
            }
        });

        if (verification.verified) {
            // Consume the challenge 
            await Challenge.deleteOne({ _id: challengeDoc._id });
            
            activeCredential.counter = verification.authenticationInfo.newCounter;
            await user.save();

            // EXECUTE INTENT (e.g. Wire Transfer)
            return Response.json({ 
                verified: true, 
                message: `Hardware Signed Transaction Approved! Action [${intent.action}] for $${intent.amount} executed successfully.`
            });
        }

        return Response.json({ verified: false, error: 'Physical Cryptographic Validation Failed' }, { status: 401 });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
