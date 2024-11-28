import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";

const file = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(
  file?.replace(
    "- url: ${{server}}",
    `- url: ${process.env.BACKEND_API_HOST_URL}/api/v1`
  )
);

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

// * API DOCS
// ? Keeping swagger code at the end so that we can load swagger on "/" route
app.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none", // keep all the sections collapsed by default
    },
    customSiteTitle: "Backend API Hub docs",
  })
);

// common error handling middleware
app.use(errorHandler);

export { app };
