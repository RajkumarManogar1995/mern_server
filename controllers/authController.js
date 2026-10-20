import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import HttpError from "../middleware/HttpError.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";

const signToken = (user, type, expiresIn) =>
  jwt.sign(
    {
      id: user._id.toString(),
      tokenVersion: user.tokenVersion,
      type,
      jti: randomUUID(),
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn,
    }
  );

const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");

const tokenMatchesHash = (token, hash) => {
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/i.test(hash)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(hashToken(token), "hex"),
    Buffer.from(hash, "hex")
  );
};

const cookieOptions = (path, maxAge) => ({
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path,
  maxAge,
});

const setSessionCookies = (res, accessToken, refreshToken) => {
  res.cookie(
    ACCESS_COOKIE,
    accessToken,
    cookieOptions("/", ACCESS_COOKIE_MAX_AGE)
  );
  res.cookie(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions("/api/users/refresh-token", REFRESH_COOKIE_MAX_AGE)
  );
};

const clearSessionCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions("/", undefined));
  res.clearCookie(
    REFRESH_COOKIE,
    cookieOptions("/api/users/refresh-token", undefined)
  );
};

const issueSession = async (user, res) => {
  const accessToken = signToken(user, "access", ACCESS_TOKEN_TTL);
  const refreshToken = signToken(user, "refresh", REFRESH_TOKEN_TTL);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  setSessionCookies(res, accessToken, refreshToken);
};

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
  await issueSession(user, res);

  res.status(201).json({ user: publicUser(user) });
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
  await issueSession(user, res);

  res.status(200).json({ user: publicUser(user) });
};

export const refreshToken = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== "string" || !token) {
    throw new HttpError(401, "Refresh token is required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    clearSessionCookies(res);
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.id !== "string" ||
    decoded.type !== "refresh" ||
    !Number.isSafeInteger(decoded.tokenVersion)
  ) {
    clearSessionCookies(res);
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.id).select(
    "+tokenVersion +refreshTokenHash"
  );
  if (
    !user ||
    decoded.tokenVersion !== user.tokenVersion ||
    !tokenMatchesHash(token, user.refreshTokenHash)
  ) {
    clearSessionCookies(res);
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  try {
    await issueSession(user, res);
  } catch (error) {
    if (error.name === "VersionError") {
      clearSessionCookies(res);
      throw new HttpError(401, "Refresh token has already been used");
    }
    throw error;
  }

  res.status(200).json({ message: "Session refreshed" });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || !currentPassword) {
    throw new HttpError(400, "Current password is required");
  }
  validateNewPassword(newPassword);

  const user = await User.findById(req.user._id).select(
    "+password +tokenVersion +refreshTokenHash"
  );
  if (!user || !(await user.matchPassword(currentPassword))) {
    throw new HttpError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  await issueSession(user, res);

  res.status(200).json({ user: publicUser(user) });
};

export const logout = async (req, res) => {
  req.user.tokenVersion += 1;
  req.user.refreshTokenHash = undefined;
  await req.user.save();

  clearSessionCookies(res);
  res.status(200).json({ message: "Logged out successfully" });
};

export const getCurrentUser = (req, res) => {
  res.status(200).json(publicUser(req.user));
};
