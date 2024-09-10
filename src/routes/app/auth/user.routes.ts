import { Router } from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
} from "@/controllers/apps/auth/user.controllers";
import { verifyJWT } from "@/middlewares/auth.middleware";

const router = Router();

// Unsecured routes
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/refresh-token").post(refreshAccessToken);

// Secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);

export default router;
