import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import HttpError from "../middleware/HttpError.js";
import { sendPasswordResetEmail } from "../services/passwordResetEmail.js";

const createToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "30d",
    }
  );

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
});

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateNewPassword = (password) => {
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters long");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new HttpError(400, "Password must be no longer than 72 bytes");
  }
};

const hashResetToken = (token) =>
  createHash("sha256").update(token).digest("hex");

export const register = async (req, res) => {
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !email || !password) {
    throw new HttpError(400, "Username, email, and password are required");
  }
  if (!isValidEmail(email)) {
    throw new HttpError(400, "Please provide a valid email address");
  }
  validateNewPassword(password);

  const user = await User.create({ username, email, password });

  res.status(201).json({
    ...publicUser(user),
    token: createToken(user),
  });
};

export const login = async (req, res) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    throw new HttpError(400, "Email and password are required");
  }
  if (!isValidEmail(email)) {
    throw new HttpError(400, "Invalid credentials");
  }

  const user = await User.findOne({ email }).select("+password +tokenVersion");
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, "Invalid credentials");
  }

  res.status(200).json({
    ...publicUser(user),
    token: createToken(user),
  });
};

export const forgotPassword = async (req, res) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    throw new HttpError(400, "Please provide a valid email address");
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(202).json({
      message: "If an account exists for that email, reset instructions will be sent.",
    });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  try {
    await sendPasswordResetEmail(user.email, token);
  } catch (error) {
    try {
      await User.updateOne(
        { _id: user._id, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
      );
    } catch (cleanupError) {
      console.error(
        "Failed to clear an undelivered password reset token:",
        cleanupError
      );
    }
    throw error;
  }

  res.status(202).json({
    message: "If an account exists for that email, reset instructions will be sent.",
  });
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new HttpError(400, "Invalid or expired password reset token");
  }
  validateNewPassword(newPassword);

  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt +tokenVersion");

  if (!user) {
    throw new HttpError(400, "Invalid or expired password reset token");
  }

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.tokenVersion += 1;

  try {
    await user.save();
  } catch (error) {
    if (error.name === "VersionError") {
      throw new HttpError(400, "Invalid or expired password reset token");
    }
    throw error;
  }

  res.status(200).json({ message: "Password reset successfully. Please log in." });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || !currentPassword) {
    throw new HttpError(400, "Current password is required");
  }
  validateNewPassword(newPassword);

  const user = await User.findById(req.user._id).select("+password +tokenVersion");
  if (!user || !(await user.matchPassword(currentPassword))) {
    throw new HttpError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  await user.save();

  res.status(200).json({
    ...publicUser(user),
    token: createToken(user),
  });
};

export const getCurrentUser = (req, res) => {
  res.status(200).json(publicUser(req.user));
};
