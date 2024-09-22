import { Router } from "express";
import {
  addAnswer,
  deleteAnswer,
  getAllAnswers,
  getAnswerById,
  toggleDownvoteAnswer,
  toggleUpvoteAnswer,
  updateAnswer,
} from "@/controllers/apps/qna/answer.controllers";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "@/middlewares/auth.middleware";

const router = Router();

router
  .route("/q/:questionId")
  .get(getLoggedInUserOrIgnore, getAllAnswers)
  .post(verifyJWT, addAnswer);

router
  .route("/:answerId")
  .get(getLoggedInUserOrIgnore, getAnswerById)
  .put(verifyJWT, updateAnswer)
  .delete(verifyJWT, deleteAnswer);

router
  .use(verifyJWT)
  .patch("/toggle-upvote/:questionId", toggleUpvoteAnswer)
  .patch("/toggle-downvote/:questionId", toggleDownvoteAnswer);

export default router;
