import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { JwtPayload } from "../../../types/express.d";
import {
  buildPaginationMeta,
  parsePagination,
} from "../../../shared/utils/pagination";
import { generateSlug } from "../../../helpers/random";
import User from "../../auth/models/user.model";
import {
  AddMemberInput,
  CreateOrganizationInput,
  OrganizationResponse,
  toOrganizationResponse,
  UpdateOrganizationInput,
} from "../dto/organization.dto";
import Organization from "../models/organization.model";

export class OrganizationService {
  static async create(
    ownerId: string,
    input: CreateOrganizationInput
  ): Promise<OrganizationResponse> {
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new AppError("Owner not found", 404);
    }

    let slug = generateSlug(input.name);
    const existingSlug = await Organization.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const org = await Organization.create({
      name: input.name,
      slug,
      logo: input.logo,
      subscriptionPlan: input.subscriptionPlan,
      ownerId,
      teachers: owner.role === Role.TEACHER ? [ownerId] : [],
    });

    owner.organizationId = org._id;
    if (owner.role === Role.STUDENT || owner.role === Role.PARENT) {
      owner.role = Role.SCHOOL_ADMIN;
    }
    await owner.save();

    return toOrganizationResponse(org);
  }

  static async getById(user: JwtPayload, id: string): Promise<OrganizationResponse> {
    await AccessControlService.assertOrgRead(user, id);
    const org = await Organization.findById(id);
    if (!org || org.status === Status.DELETED) {
      throw new AppError("Organization not found", 404);
    }
    return toOrganizationResponse(org);
  }

  static async list(query: { page?: number; limit?: number; search?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { status: { $ne: Status.DELETED } };

    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }

    const [items, total] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Organization.countDocuments(filter),
    ]);

    return {
      items: items.map(toOrganizationResponse),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async update(
    id: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationResponse> {
    const org = await Organization.findById(id);
    if (!org || org.status === Status.DELETED) {
      throw new AppError("Organization not found", 404);
    }

    if (input.name) org.name = input.name;
    if (input.logo !== undefined) org.logo = input.logo;
    if (input.subscriptionPlan) org.subscriptionPlan = input.subscriptionPlan;

    await org.save();
    return toOrganizationResponse(org);
  }

  static async addMember(
    orgId: string,
    input: AddMemberInput
  ): Promise<OrganizationResponse> {
    const org = await Organization.findById(orgId);
    if (!org || org.status === Status.DELETED) {
      throw new AppError("Organization not found", 404);
    }

    const user = await User.findById(input.userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const memberField = this.getMemberField(input.role);
    const memberIds = org[memberField].map((id) => id.toString());

    if (memberIds.includes(input.userId)) {
      throw new AppError("User is already a member", 409);
    }

    org[memberField].push(user._id);
    user.organizationId = org._id;
    user.role = input.role;
    await Promise.all([org.save(), user.save()]);

    return toOrganizationResponse(org);
  }

  static async removeMember(
    orgId: string,
    userId: string
  ): Promise<OrganizationResponse> {
    const org = await Organization.findById(orgId);
    if (!org || org.status === Status.DELETED) {
      throw new AppError("Organization not found", 404);
    }

    if (org.ownerId.toString() === userId) {
      throw new AppError("Cannot remove organization owner", 400);
    }

    org.teachers = org.teachers.filter((id) => id.toString() !== userId);
    org.students = org.students.filter((id) => id.toString() !== userId);
    org.parents = org.parents.filter((id) => id.toString() !== userId);

    const user = await User.findById(userId);
    if (user?.organizationId?.toString() === orgId) {
      user.organizationId = undefined;
      await user.save();
    }

    await org.save();
    return toOrganizationResponse(org);
  }

  static async delete(id: string): Promise<void> {
    const org = await Organization.findById(id);
    if (!org) {
      throw new AppError("Organization not found", 404);
    }
    org.status = Status.DELETED;
    await org.save();
  }

  private static getMemberField(
    role: Role.TEACHER | Role.STUDENT | Role.PARENT
  ): "teachers" | "students" | "parents" {
    switch (role) {
      case Role.TEACHER:
        return "teachers";
      case Role.STUDENT:
        return "students";
      case Role.PARENT:
        return "parents";
    }
  }
}
