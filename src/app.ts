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

//routes declaration
app.use("/api/v1/health-check", healthCheckRouter);

// common error handling middleware
app.use(errorHandler);

export { app };
