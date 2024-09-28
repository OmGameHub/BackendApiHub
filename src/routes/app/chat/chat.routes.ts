import { Router } from "express";
import { verifyJWT } from "@/middlewares/auth.middleware";
import {
  getAllAvailableUsers,
  createOrGetAOneOnOneChat,
  createGroupChat,
  getAllChatChannels,
  getOneGroupChat,
  updateGroupChatDetails,
  changeMemberRoleInGroupChat,
  addMembersInGroupChat,
  removeMemberFromChatGroup,
  deleteGroupChat,
  leaveGroupChat,
} from "@/controllers/apps/chat/chat.controllers";

const router = Router();

router.use(verifyJWT);

router.get("/", getAllChatChannels);

router.get("/users", getAllAvailableUsers);

router.get("/c/:receiverId", createOrGetAOneOnOneChat);

router.post("/group", createGroupChat);

router
  .route("/group/:chatId")
  .get(getOneGroupChat)
  .put(updateGroupChatDetails)
  .delete(deleteGroupChat);

router
  .route("/group/:chatId/:memberId")
  .post(addMembersInGroupChat)
  .patch(changeMemberRoleInGroupChat)
  .delete(removeMemberFromChatGroup);

router.route("/leave/group/:chatId").delete(leaveGroupChat);

export default router;
