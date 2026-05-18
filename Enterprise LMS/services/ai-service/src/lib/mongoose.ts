import mongoose from "mongoose";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/enterprise_lms";

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  connected = true;
  console.log("[mongoose] Connected to MongoDB");
}
