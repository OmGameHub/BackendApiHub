import { Router } from "express";
import {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
} from "@/controllers/apps/todo/todo.controllers";
import { verifyJWT } from "@/middlewares/auth.middleware";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getAllTodos).post(createTodo);

router.route("/:todoId").get(getTodoById).put(updateTodo).delete(deleteTodo);

export default router;
