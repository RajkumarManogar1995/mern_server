import mongoose from "mongoose";

export const connectDB = async (uri) => {
  const { connection } = await mongoose.connect(uri);
  console.info(`MongoDB connected: ${connection.host}`);
};
