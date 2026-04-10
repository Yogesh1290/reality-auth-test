import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User, SessionHardwareAnchor } from '@/lib/models';

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

    // 100% REAL: Retrieve the exact FIDO WebAuthn Array of Keys for this user
    const user = await User.findOne({ userId });
    if (!user || !user.credentials || user.credentials.length === 0) {
        return Response.json({ verified: false, error: 'User credential not registered' }, { status: 400 });
    }

    // Match the specific hardware token used out of their Array of registered devices
    const activeCredential = user.credentials.find((cred: any) => cred.credentialID === attResp.id);
    if (!activeCredential) {
        return Response.json({ verified: false, error: 'Authenticator is not mapped to this user' }, { status: 400 });
    }

    try {
        // 100% REAL: Cryptographically verify the signature over the Elliptic Curve 
        // to prove they physically unlocked the device successfully
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
            // Anchor the RealityLimit math to the session
            await SessionHardwareAnchor.findOneAndUpdate(
                { userId },
                { hardwareSignature, createdAt: new Date() },
                { upsert: true, new: true }
            );

            // Consume the challenge and update replay-prevention counter
            await Challenge.deleteOne({ userId });
            
            // Advance the specific credential's security counter in the Array
            activeCredential.counter = verification.authenticationInfo.newCounter;
            await user.save();

            return Response.json({ verified: true });
        }

        return Response.json({ verified: false, error: 'Physical Cryptographic Validation Failed' }, { status: 401 });
    } catch (err) {
        return Response.json({ verified: false, error: (err as Error).message }, { status: 400 });
    }
}
