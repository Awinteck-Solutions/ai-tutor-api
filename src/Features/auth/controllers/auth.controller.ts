import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { AuthService } from "../services/auth.service";

export class AuthController {
  static async register(req: Request, res: Response): Promise<Response> {
    const result = await AuthService.register(req.body);
    return ApiResponse.created(res, result, "Registration successful");
  }

  static async login(req: Request, res: Response): Promise<Response> {
    const result = await AuthService.login(req.body);
    return ApiResponse.success(res, result, "Login successful");
  }

  static async refresh(req: Request, res: Response): Promise<Response> {
    const tokens = await AuthService.refresh(req.body.refreshToken);
    return ApiResponse.success(res, tokens, "Token refreshed");
  }

  static async logout(req: Request, res: Response): Promise<Response> {
    await AuthService.logout(req.body.refreshToken);
    return ApiResponse.success(res, null, "Logged out successfully");
  }

  static async forgotPassword(req: Request, res: Response): Promise<Response> {
    await AuthService.forgotPassword(req.body.email);
    return ApiResponse.success(
      res,
      null,
      "If that email exists, a reset link has been sent"
    );
  }

  static async resetPassword(req: Request, res: Response): Promise<Response> {
    await AuthService.resetPassword(req.body);
    return ApiResponse.success(res, null, "Password reset successful");
  }

  static async getProfile(req: Request, res: Response): Promise<Response> {
    const profile = await AuthService.getProfile(req.currentUser!.sub);
    return ApiResponse.success(res, profile, "Profile retrieved");
  }

  static async updateProfile(req: Request, res: Response): Promise<Response> {
    const profile = await AuthService.updateProfile(
      req.currentUser!.sub,
      req.body
    );
    return ApiResponse.success(res, profile, "Profile updated");
  }

  static async changePassword(req: Request, res: Response): Promise<Response> {
    await AuthService.changePassword(req.currentUser!.sub, req.body);
    return ApiResponse.success(res, null, "Password changed successfully");
  }
}
