import { generateAuthenticationOptions } from '@simplewebauthn/server';
import dbConnect from '@/lib/db';
import { Challenge, User } from '@/lib/models';
import crypto from 'crypto';

// In-Memory Rate Limiter (Protects MongoDB from DDoS/Spam scripts)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const limitData = rateLimitMap.get(ip);
    
    // Reset or initialize count (Max 5 requests per minute per IP)
    if (!limitData || now > limitData.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
        return false;
    }
    if (limitData.count >= 5) {
        return true; // Block DB Access!
    }
    limitData.count += 1;
    return false;
}

export async function POST(req: Request) {
    // SECURITY PATCH: Stop Database DoS Attacks!
    const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
    if (isRateLimited(ip)) {
        return Response.json({ error: 'Too many requests. Firewall blocked database execution.' }, { status: 429 });
    }

    await dbConnect();
    const body = await req.json();
    const userId = body.userId;

    // SECURITY PATCH: Prevent NoSQL Injection via Object Operators { "$ne": null }
    if (typeof userId !== 'string' || !userId) {
        return Response.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    // Check if user is registered in MongoDB
    const user = await User.findOne({ userId });
    
    // ADVANCED ANTI-ENUMERATION HONEYPOT
    // If a hacker guesses a wrong name, we DO NOT tell them it's wrong!
    // We send back a cryptographically perfect FAKE challenge to confuse their hacking scripts!
    if (!user || !user.credentials || user.credentials.length === 0) {
        // Simulate a slight database delay so timing attacks fail
        await new Promise(r => setTimeout(r, Math.random() * 200 + 300));
        
        return Response.json({
            rpId: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
            challenge: crypto.randomBytes(32).toString('base64url'),
            allowCredentials: [{
                id: crypto.randomBytes(32).toString('base64url'),
                type: 'public-key',
                transports: ['internal', 'hybrid']
            }],
            timeout: 60000,
            userVerification: 'required'
        });
    }

    const allowCredentials = user.credentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports && cred.transports.length > 0 ? cred.transports : ['internal', 'hybrid'],
    }));

    const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        userVerification: 'required',
        allowCredentials
    });

    // Save login challenge to DB
    await Challenge.findOneAndUpdate(
        { userId },
        { challenge: options.challenge, createdAt: new Date() },
        { upsert: true, new: true }
    );

    return Response.json(options);
}
