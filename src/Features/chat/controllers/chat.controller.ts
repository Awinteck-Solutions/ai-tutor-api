import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { ChatService } from "../services/chat.service";

export class ChatController {
  static async createSession(req: Request, res: Response): Promise<Response> {
    const session = await ChatService.createSession(req.currentUser!, req.body);
    return ApiResponse.created(res, session, "Chat session created");
  }

  static async listSessions(req: Request, res: Response): Promise<Response> {
    const sessions = await ChatService.listSessions(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, sessions, "Chat sessions retrieved");
  }

  static async getSession(req: Request, res: Response): Promise<Response> {
    const session = await ChatService.getSession(
      req.currentUser!,
      req.params.sessionId
    );
    return ApiResponse.success(res, session, "Chat session retrieved");
  }

  static async sendMessage(req: Request, res: Response): Promise<Response> {
    const message = await ChatService.sendMessage(
      req.currentUser!,
      req.params.sessionId,
      req.body
    );
    return ApiResponse.success(res, message, "Message sent");
  }

  static async deleteSession(req: Request, res: Response): Promise<Response> {
    await ChatService.deleteSession(req.currentUser!, req.params.sessionId);
    return ApiResponse.success(res, null, "Chat session deleted");
  }
}
