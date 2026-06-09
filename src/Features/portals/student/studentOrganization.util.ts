import { Request } from "express";
import { AppError } from "../../../shared/errors/AppError";
import User from "../../auth/models/user.model";
import { StudentWorkspaceService } from "../../../shared/services/studentWorkspace.service";

/** Resolve org for self-study features: query → body → JWT → DB user → auto-provision personal workspace. */
export async function resolveStudentOrganizationId(req: Request): Promise<string> {
  const user = req.currentUser;
  if (!user) {
    throw new AppError("Unauthorized", 401);
  }

  const fromQuery = req.query.organizationId;
  const fromBody = req.body?.organizationId;
  const candidate =
    (typeof fromQuery === "string" && fromQuery.trim()) ||
    (typeof fromBody === "string" && fromBody.trim()) ||
    user.organizationId;

  if (candidate) {
    return candidate;
  }

  const dbUser = await User.findById(user.sub);
  if (!dbUser) {
    throw new AppError("User not found", 404);
  }

  if (dbUser.organizationId) {
    return dbUser.organizationId.toString();
  }

  const org = await StudentWorkspaceService.provisionPersonalWorkspace(dbUser);
  return org._id.toString();
}
