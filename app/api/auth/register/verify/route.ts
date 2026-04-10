import { verifyRegistrationResponse } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, UserCredential } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { attResp, userId } = await req.json();
    
    // Retrieve challenge from DB
    const challengeDoc = await Challenge.findOne({ userId });

    if (!challengeDoc) {
        return Response.json({ verified: false, error: 'Challenge expired or missing' }, { status: 400 });
    }
    
    const expectedChallenge = challengeDoc.challenge;

    try {
        const verification = await verifyRegistrationResponse({
            response: attResp,
            expectedChallenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        });

        if (verification.verified && verification.registrationInfo) {
            // Delete the challenge after successful consumption
            await Challenge.deleteOne({ userId });

            const { credential } = verification.registrationInfo;

            // 100% REAL: Store the user's authentic physical public key and ID in MongoDB
            await UserCredential.findOneAndUpdate(
                { userId },
                {
                    credentialID: credential.id,
                    credentialPublicKey: Buffer.from(credential.publicKey),
                    counter: credential.counter
                },
                { upsert: true, new: true }
            );
            return Response.json({ verified: true });
        }

        return Response.json({ verified: false, error: 'Registration verification failed' });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
