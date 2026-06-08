import { NextFunction, Request, Response } from "express";
import { TokenService } from "../helpers/tokenizer";
import { AppError } from "../shared/errors/AppError";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Unauthorized", 401);
    }

    const token = header.split(" ")[1];
    if (!token) {
      throw new AppError("Unauthorized", 401);
    }

    req.currentUser = TokenService.verifyAccessToken(token);
    next();
  } catch {
    next(new AppError("Unauthorized", 401));
  }
};
