import express from "express";
import authRoutes from "./routes/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use("/api/users", authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
