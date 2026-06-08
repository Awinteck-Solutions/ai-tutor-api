import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { OrganizationMemberService } from "../services/organizationMember.service";

export class OrganizationMemberController {
  static async listMembers(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.listMembers(
      req.currentUser!,
      req.params.id,
      {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
        role: req.query.role as string | undefined,
      }
    );
    return ApiResponse.success(res, data);
  }

  static async invite(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.inviteMember(req.currentUser!, req.params.id, req.body);
    return ApiResponse.created(res, data, "Invitation sent");
  }

  static async listInvites(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.listInvites(
      req.currentUser!,
      req.params.id,
      {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
        role: req.query.role as string | undefined,
      }
    );
    return ApiResponse.success(res, data, "Pending invitations retrieved");
  }

  static async createMemberDirect(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.createMemberDirect(
      req.currentUser!,
      req.params.id,
      req.body
    );
    return ApiResponse.created(res, data, "Member created");
  }

  static async listAssignments(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.listAssignments(req.currentUser!, req.params.id);
    return ApiResponse.success(res, data, "Assignments retrieved");
  }

  static async previewInvite(req: Request, res: Response): Promise<Response> {
    const token = req.query.token as string;
    const data = await OrganizationMemberService.previewInvite(token);
    return ApiResponse.success(res, data, "Invitation details retrieved");
  }

  static async acceptInvite(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.acceptInvite(req.body);
    return ApiResponse.success(res, data, "Invitation accepted");
  }

  static async suspend(req: Request, res: Response): Promise<Response> {
    const suspend = req.body?.suspend !== false;
    const data = await OrganizationMemberService.suspendMember(
      req.currentUser!,
      req.params.id,
      req.params.userId,
      suspend
    );
    return ApiResponse.success(res, data, suspend ? "Member suspended" : "Member reactivated");
  }

  static async linkParent(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.linkParentToStudent(
      req.currentUser!,
      req.params.id,
      req.body.parentId,
      req.body.studentId
    );
    return ApiResponse.success(res, data, "Parent linked to student");
  }

  static async assignTeacher(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.assignTeacherToSubject(
      req.currentUser!,
      req.params.id,
      req.body.subjectId,
      req.body.teacherId
    );
    return ApiResponse.success(res, data, "Teacher assigned");
  }

  static async enrollStudent(req: Request, res: Response): Promise<Response> {
    const data = await OrganizationMemberService.enrollStudent(
      req.currentUser!,
      req.params.id,
      req.body.subjectId,
      req.body.studentId
    );
    return ApiResponse.success(res, data, "Student enrolled");
  }
}
