import dns from "node:dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {}

import mongoose from "mongoose";

let isDbConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "⚠️  [DB] MONGODB_URI is not set in environment. Running in offline/in-memory fallback mode."
    );
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: "legallens",
      serverSelectionTimeoutMS: 10000,
      autoIndex: true,
    });

    isDbConnected = true;
    console.log(`✅ [DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    // Verify or create TTL index for 24-hour document vector expiry
    try {
      const collection = conn.connection.collection("document_vectors");
      await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
      console.log("✅ [DB] TTL index on 'document_vectors' confirmed (24h auto-expiry).");
    } catch (indexErr) {
      console.warn("⚠️  [DB] TTL index check notice:", indexErr.message);
    }

    return true;
  } catch (error) {
    console.error("❌ [DB] MongoDB connection error:", error.message);
    isDbConnected = false;
    return false;
  }
}

export function isConnected() {
  return isDbConnected && mongoose.connection.readyState === 1;
}

export default connectDB;
