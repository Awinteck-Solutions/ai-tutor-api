import { NextFunction, Request, Response } from "express";
import { validationResult, ValidationChain } from "express-validator";
import { AppError } from "../shared/errors/AppError";

export const validate =
  (validations: ValidationChain[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      next(
        new AppError("Validation failed", 422, errors.array())
      );
      return;
    }

    next();
  };
