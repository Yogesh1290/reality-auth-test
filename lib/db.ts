import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    // In demo, we will log a warning instead of throw, and throw only when attempting connection
    console.warn('⚠️ MONGODB_URI is not defined in .env! Database connection will fail.');
}

let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    if (!process.env.MONGODB_URI) {
        throw new Error('Please define the MONGODB_URI environment variable inside .env or .env.local');
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
            console.log('✅ Connected to MongoDB Atlas');
            return mongoose;
        }).catch(err => {
            console.error('❌ MongoDB Connection Error. If you see ECONNREFUSED querySrv, your ISP or VPN is blocking DNS SRV records. Try removing +srv from the URI and using the older connection string format from Atlas, or change your DNS to 8.8.8.8.', err.message);
            throw err;
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

export default dbConnect;
