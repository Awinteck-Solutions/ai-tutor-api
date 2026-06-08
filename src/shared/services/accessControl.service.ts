import { Role } from "../enums/roles.enum";
import { Status } from "../enums/status.enum";
import { AppError } from "../errors/AppError";
import { JwtPayload } from "../../types/express.d";
import User from "../../Features/auth/models/user.model";
import Organization from "../../Features/organization/models/organization.model";
import ParentStudentLink from "../models/parentStudentLink.model";

const MANAGE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.SCHOOL_ADMIN,
  Role.TEACHER,
];

const UPLOAD_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.SCHOOL_ADMIN,
  Role.TEACHER,
  Role.PARENT,
  Role.STUDENT,
];

export class AccessControlService {
  static async assertOrgRead(user: JwtPayload, organizationId: string): Promise<void> {
    if (user.role === Role.SUPER_ADMIN) return;
    await this.assertMembership(user.sub, organizationId);
  }

  static async assertOrgManage(user: JwtPayload, organizationId: string): Promise<void> {
    if (user.role === Role.SUPER_ADMIN) return;
    if (!MANAGE_ROLES.includes(user.role)) {
      throw new AppError("Forbidden", 403);
    }
    await this.assertMembership(user.sub, organizationId);
  }

  static async assertOrgUpload(user: JwtPayload, organizationId: string): Promise<void> {
    if (user.role === Role.SUPER_ADMIN) return;
    if (!UPLOAD_ROLES.includes(user.role)) {
      throw new AppError("Forbidden", 403);
    }
    await this.assertMembership(user.sub, organizationId);
  }

  static async assertAdmin(user: JwtPayload, organizationId: string): Promise<void> {
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.role !== Role.SCHOOL_ADMIN) {
      throw new AppError("Forbidden — admin access required", 403);
    }
    await this.assertMembership(user.sub, organizationId);
  }

  static async assertParentAccessToStudent(
    parentUserId: string,
    studentUserId: string,
    organizationId: string
  ): Promise<void> {
    const link = await ParentStudentLink.findOne({
      parentId: parentUserId,
      studentId: studentUserId,
      organizationId,
      status: Status.ACTIVE,
    });
    if (!link) {
      throw new AppError("Forbidden — parent not linked to student", 403);
    }
  }

  static async canAccessStudentData(
    user: JwtPayload,
    studentUserId: string,
    organizationId: string
  ): Promise<void> {
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.sub === studentUserId) return;

    if ([Role.SCHOOL_ADMIN, Role.TEACHER].includes(user.role)) {
      await this.assertMembership(user.sub, organizationId);
      return;
    }

    if (user.role === Role.PARENT) {
      await this.assertParentAccessToStudent(user.sub, studentUserId, organizationId);
      return;
    }

    throw new AppError("Forbidden", 403);
  }

  static async assertMembership(userId: string, organizationId: string): Promise<void> {
    const [member, org] = await Promise.all([
      User.findById(userId),
      Organization.findOne({ _id: organizationId, status: { $ne: Status.DELETED } }),
    ]);

    if (!org) throw new AppError("Organization not found", 404);
    if (member?.organizationId?.toString() !== organizationId) {
      throw new AppError("Forbidden — not a member of this organization", 403);
    }
    if (member.status === Status.SUSPENDED) {
      throw new AppError("Account is suspended", 403);
    }
  }
}
