import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { getConfig } from "./config/env.js";

const startServer = async () => {
  const { port, mongodbUri } = getConfig();
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
