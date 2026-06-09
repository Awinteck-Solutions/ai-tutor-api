import { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError";
import { sanitizeErrorMessageForClient } from "../shared/utils/aiErrorMapper";
import { ApiResponse } from "../shared/utils/apiResponse";

export const notFoundHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  ApiResponse.error(res, "Route not found", 404);
};

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    ApiResponse.error(
      res,
      sanitizeErrorMessageForClient(error.message),
      error.statusCode,
      error.details
    );
    return;
  }

  const sanitized = sanitizeErrorMessageForClient(error.message);
  if (sanitized !== error.message) {
    console.error("Unhandled AI provider error:", error);
    ApiResponse.error(res, sanitized, 503);
    return;
  }

  console.error("Unhandled error:", error);
  ApiResponse.error(res, "Internal server error", 500);
};
