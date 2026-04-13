import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

const ChallengeSchema = new Schema({
    userId: { type: String, required: true },
    challenge: { type: String, required: true },
    intent: { type: String, required: false },
    createdAt: { type: Date, default: Date.now, expires: 300 } // Auto-expires in 5 minutes
});

const CredentialSchema = new Schema({
    credentialID: { type: String, required: true },
    credentialPublicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: [] },
    deviceName: { type: String, default: 'Unknown Device' }, // Human-readable label
    registeredAt: { type: Date, default: Date.now }
});

const UserSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    credentials: [CredentialSchema],
    recoveryCodeHash: { type: String, required: false },
    balance: { type: Number, default: 125000 }, // Demo balance in USD
});

export const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', ChallengeSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);

/** Generates a 12-word style numeric recovery code and returns [plaintext, hash] */
export function generateRecoveryCode(): { plaintext: string; hash: string } {
    // 24 random hex chars grouped as 6 blocks of 4 (e.g. A1B2-C3D4-E5F6-G7H8-I9J0-K1L2)
    const raw = crypto.randomBytes(12).toString('hex').toUpperCase();
    const plaintext = raw.match(/.{1,4}/g)!.join('-'); // "A1B2-C3D4-E5F6-G7H8-I9J0-K1L2"
    const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    return { plaintext, hash };
}

/** Verifies a plaintext recovery code against the stored hash */
export function verifyRecoveryCode(plaintext: string, storedHash: string): boolean {
    const hash = crypto.createHash('sha256').update(plaintext.toUpperCase().trim()).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

