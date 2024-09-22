import { Router } from "express";
import {
  createQuestion,
  deleteQuestion,
  getAllQuestions,
  getMyQuestions,
  getQuestionById,
  toggleDownvoteQuestion,
  toggleUpvoteQuestion,
  updateQuestion,
} from "@/controllers/apps/qna/question.controllers";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "@/middlewares/auth.middleware";

const router = Router();

router.get("/", getLoggedInUserOrIgnore, getAllQuestions);

router
  .route("/:questionId")
  .get(getLoggedInUserOrIgnore, getQuestionById)
  .put(verifyJWT, updateQuestion)
  .delete(verifyJWT, deleteQuestion);

router
  .use(verifyJWT)
  .patch("/toggle-upvote/:questionId", toggleUpvoteQuestion)
  .patch("/toggle-downvote/:questionId", toggleDownvoteQuestion);

router.post("/create", verifyJWT, createQuestion);

router.route("/get/my").get(verifyJWT, getMyQuestions);

export default router;
