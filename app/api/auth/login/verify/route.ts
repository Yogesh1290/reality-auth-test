import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { attResp, userId } = await req.json();

    const challengeDoc = await Challenge.findOne({ userId });
    if (!challengeDoc) return Response.json({ verified: false, error: 'Challenge expired or missing' }, { status: 400 });

    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ verified: false, error: 'User credential not registered' }, { status: 400 });
    }

    const activeCredential = user.credentials.find((cred: any) => cred.credentialID === attResp.id);
    if (!activeCredential) {
        return Response.json({ verified: false, error: 'Authenticator is not mapped to this user' }, { status: 400 });
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: attResp,
            expectedChallenge: challengeDoc.challenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            credential: {
                id: activeCredential.credentialID,
                publicKey: activeCredential.credentialPublicKey as Uint8Array<ArrayBuffer>,
                counter: activeCredential.counter,
                transports: attResp.response.transports
            }
        });

        if (verification.verified) {
            // Consume challenge + update replay-prevention counter
            await Challenge.deleteOne({ userId });
            activeCredential.counter = verification.authenticationInfo.newCounter;
            await user.save();

            return Response.json({ verified: true });
        }

        return Response.json({ verified: false, error: 'Physical Cryptographic Validation Failed' }, { status: 401 });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
