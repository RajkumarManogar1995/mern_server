import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import { connectDB } from "./config/db.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json());

app.use("/api/users", authRoutes);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
