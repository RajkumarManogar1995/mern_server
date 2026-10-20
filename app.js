import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { getClientOrigin } from "./config/env.js";

const app = express();
const clientOrigin = getClientOrigin();

app.disable("x-powered-by");
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  if (req.get("origin") !== clientOrigin) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use("/api/users", authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
