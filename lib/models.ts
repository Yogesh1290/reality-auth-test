import mongoose, { Schema } from 'mongoose';

const ChallengeSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    challenge: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 } // Challenge expires in 5 minutes
});

const UserCredentialSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    credentialID: { type: String, required: true }, 
    credentialPublicKey: { type: Buffer, required: true }, // Binary standard for FIDO keys map well to buffers
    counter: { type: Number, required: true, default: 0 }
});

const SessionHardwareAnchorSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    hardwareSignature: { type: String, required: true }, // The physical signature anchor
    createdAt: { type: Date, default: Date.now, expires: 86400 } // Session expires in 24 hours
});

export const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', ChallengeSchema);
export const UserCredential = mongoose.models.UserCredential || mongoose.model('UserCredential', UserCredentialSchema);
export const SessionHardwareAnchor = mongoose.models.SessionHardwareAnchor || mongoose.model('SessionHardwareAnchor', SessionHardwareAnchorSchema);
