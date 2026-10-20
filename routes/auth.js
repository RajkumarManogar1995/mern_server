import express from "express";
import { protect } from "../middleware/auth.js";
import {
  changePassword,
  getCurrentUser,
  login,
  register,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.patch("/change-password", protect, changePassword);
router.get("/me", protect, getCurrentUser);

export default router;
