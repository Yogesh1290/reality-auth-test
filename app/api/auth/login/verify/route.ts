import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, UserCredential, SessionHardwareAnchor } from '@/lib/models';

export async function POST(req: Request) {
    await dbConnect();
    const { attResp, userId } = await req.json();

    // 100% REAL: Deterministically pull the physically verified silicon signature
    // straight from the Elliptic Curve packet to anchor RealityLimit math.
    // This prevents malicious clients from decoupling the auth verification from the RealityLimit anchor.
    const hardwareSignature = attResp.response.signature;
    
    const challengeDoc = await Challenge.findOne({ userId });
    if (!challengeDoc) return Response.json({ verified: false, error: 'Challenge expired or missing' }, { status: 400 });
    const expectedChallenge = challengeDoc.challenge;

    // 100% REAL: Retrieve the exact FIDO WebAuthn Public Key for this user
    const userCredential = await UserCredential.findOne({ userId });
    if (!userCredential) {
        return Response.json({ verified: false, error: 'User credential not registered' }, { status: 400 });
    }

    try {
        // 100% REAL: Cryptographically verify the signature over the Elliptic Curve 
        // to prove they physically unlocked the device registered to this user.
        const verification = await verifyAuthenticationResponse({
            response: attResp,
            expectedChallenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            credential: {
                id: userCredential.credentialID,
                publicKey: userCredential.credentialPublicKey,
                counter: userCredential.counter,
                transports: attResp.response.transports
            }
        });

        if (verification.verified) {
            // 100% REAL: Only anchor the RealityLimit math to the session AFTER the hardware elliptic-curve proof passes
            await SessionHardwareAnchor.findOneAndUpdate(
                { userId },
                { hardwareSignature, createdAt: new Date() },
                { upsert: true, new: true }
            );

            // Consume the challenge and update replay-prevention counter
            await Challenge.deleteOne({ userId });
            
            userCredential.counter = verification.authenticationInfo.newCounter;
            await userCredential.save();

            return Response.json({ verified: true });
        }

        return Response.json({ verified: false, error: 'Physical Cryptographic Validation Failed' }, { status: 401 });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
