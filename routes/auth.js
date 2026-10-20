import express from "express";
import { protect } from "../middleware/auth.js";
import {
  changePassword,
  getCurrentUser,
  login,
  logout,
  refreshToken,
  register,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", protect, logout);
router.patch("/change-password", protect, changePassword);
router.get("/me", protect, getCurrentUser);

export default router;
