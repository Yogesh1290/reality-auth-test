import mongoose, { Schema } from 'mongoose';

const ChallengeSchema = new Schema({
    userId: { type: String, required: true }, // Removed unique: true so multiple challenges can queue (e.g. login & transfer simultaneously)
    challenge: { type: String, required: true },
    intent: { type: String, required: false }, // Stores the FIDO transaction JSON intent
    createdAt: { type: Date, default: Date.now, expires: 300 } // Challenge expires in 5 minutes
});

const CredentialSchema = new Schema({
    credentialID: { type: String, required: true }, 
    credentialPublicKey: { type: Buffer, required: true }, 
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: [] }
});

const UserSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    credentials: [CredentialSchema]
});

export const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', ChallengeSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
