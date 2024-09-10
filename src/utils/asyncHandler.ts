import { Users as User } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

/**
 * Interface extending the Express Request object.
 * Adds a user property which is of type User (from Prisma schema)
 */
interface ApiRequest extends Request {
  user?: User;
}

/**
 * Type alias for a Request Handler function.
 * @param req - An ApiRequest object
 * @param res - An Express Response object
 * @param next - An Express NextFunction object
 * @returns A Promise that resolves to any value
 */
type RequestHandler = (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Async Handler function for handling asynchronous operations in Express routes.
 * Wraps the provided RequestHandler in a Promise and handles any errors.
 * @param requestHandler - The RequestHandler function to be wrapped
 * @returns A function that takes an ApiRequest, Response, and NextFunction as arguments
 */
export const asyncHandler = (requestHandler: RequestHandler) => {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
