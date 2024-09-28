import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

import { errorHandler } from "./middlewares/error.middleware";

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

//routes import
import healthCheckRouter from "./routes/healthCheck.routes";
import userRouter from "./routes/app/auth/user.routes";
import todoRouter from "./routes/app/todo/todo.routes";

// qna routes
import questionRouter from "@/routes/app/qna/question.routes";
import answerRouter from "@/routes/app/qna/answer.routes";

// chat app routes
import chatRouter from "@/routes/app/chat/chat.routes";
import messageRouter from "@/routes/app/chat/message.routes";

//routes declaration
app.use("/api/v1/health-check", healthCheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/todos", todoRouter);

// qna routes
app.use("/api/v1/qna/questions", questionRouter);
app.use("/api/v1/qna/answers", answerRouter);

// chat app routes
app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

// common error handling middleware
app.use(errorHandler);

export { app };
