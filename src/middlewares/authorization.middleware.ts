import { NextFunction, Request, Response } from "express";
import { Role } from "../shared/enums/roles.enum";
import { AppError } from "../shared/errors/AppError";
import User from "../Features/auth/models/user.model";

export const authorize =
  (...allowedRoles: Role[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.currentUser) {
        throw new AppError("Unauthorized", 401);
      }

      const user = await User.findById(req.currentUser.sub).select("role status");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (user.status !== "ACTIVE") {
        throw new AppError("Account is not active", 403);
      }

      if (!allowedRoles.includes(user.role)) {
        throw new AppError("Forbidden", 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
