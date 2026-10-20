import jwt from "jsonwebtoken";
import User from "../models/User.js";
import HttpError from "../middleware/HttpError.js";

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
