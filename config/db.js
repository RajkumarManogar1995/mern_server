import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined. Add it to backend/.env.");
  }

  const { connection } = await mongoose.connect(uri);
  console.log(`MongoDB connected ${connection.host}`);
};
