import { Router } from "express";
import { verifyJWT } from "@/middlewares/auth.middleware";
import {
  getAllAvailableUsers,
  createOrGetAOneOnOneChat,
} from "@/controllers/apps/chat/chat.controllers";

const router = Router();

router.use(verifyJWT);

router.get("/users", getAllAvailableUsers);

router.get("/c/:receiverId", createOrGetAOneOnOneChat);

export default router;
