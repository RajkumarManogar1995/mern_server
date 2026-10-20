import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const loadConfig = () => {
  const portValue = process.env.PORT ?? "5000";
  if (!/^\d+$/.test(portValue)) {
    throw new Error("PORT must be a number between 1 and 65535");
  }

  const port = Number(portValue);
  if (port < 1 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535");
  }

  const mongodbUri = process.env.MONGODB_URI?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  return { port, mongodbUri };
};

const startServer = async () => {
  const { port, mongodbUri } = loadConfig();
  await connectDB(mongodbUri);

  const server = app.listen(port);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  console.info(`Server listening on port ${port}`);

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`${signal} received; closing server`);

    server.close(async (error) => {
      if (error) {
        console.error("Failed to close HTTP server:", error);
        process.exitCode = 1;
      }
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error("Failed to disconnect from MongoDB:", disconnectError);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
};

startServer().catch(async (error) => {
  console.error("Failed to start server:", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("Failed to disconnect from MongoDB:", disconnectError);
  }
  process.exitCode = 1;
});
