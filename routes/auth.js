import express from "express";
import { protect } from "../middleware/auth.js";
import {
  changePassword,
  forgotPassword,
  getCurrentUser,
  login,
  register,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.patch("/change-password", protect, changePassword);
router.get("/me", protect, getCurrentUser);

export default router;
