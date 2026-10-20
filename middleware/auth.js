import User from "../models/User.js";
import jwt from "jsonwebtoken";
import HttpError from "./HttpError.js";

export const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const match =
    typeof authorization === "string"
      ? authorization.match(/^Bearer\s+(.+)$/i)
      : null;

  if (!match) {
    throw new HttpError(401, "Authentication required");
  }

  let decoded;
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.id !== "string" ||
    !Number.isSafeInteger(decoded.tokenVersion ?? 0)
  ) {
    throw new HttpError(401, "Invalid or expired token");
  }

  req.user = await User.findById(decoded.id).select("+tokenVersion");
  if (!req.user) {
    throw new HttpError(401, "User no longer exists");
  }
  if ((decoded.tokenVersion ?? 0) !== req.user.tokenVersion) {
    throw new HttpError(401, "Session expired. Please log in again.");
  }

  next();
};
