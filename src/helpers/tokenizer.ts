import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env";
import { JwtPayload } from "../types/express.d";

const SALT_ROUNDS = 12;

export class TokenService {
  static hashPassword(password: string): string {
    return bcrypt.hashSync(password, SALT_ROUNDS);
  }

  static comparePassword(plain: string, hash: string): boolean {
    return bcrypt.compareSync(plain, hash);
  }

  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.jwt.accessSecret, {
      expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  static generateRefreshToken(payload: Pick<JwtPayload, "sub">): string {
    return jwt.sign(payload, env.jwt.refreshSecret, {
      expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  static verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
  }

  static verifyRefreshToken(token: string): Pick<JwtPayload, "sub"> {
    return jwt.verify(token, env.jwt.refreshSecret) as Pick<JwtPayload, "sub">;
  }

  static generateResetToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    return { token, hash };
  }

  static hashResetToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
