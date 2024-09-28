import { Router } from "express";
import { verifyJWT } from "@/middlewares/auth.middleware";
import {
  deleteOneMessage,
  getAllMessages,
  sendMessage,
  updateOneMessage,
} from "@/controllers/apps/chat/message.controllers";

const router = Router();

router.use(verifyJWT);

router.route("/:chatId").get(getAllMessages).post(sendMessage);

router
  .route("/:chatId/:messageId")
  .patch(updateOneMessage)
  .delete(deleteOneMessage);

export default router;
