import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";
import { Role } from "../../../shared/enums/roles.enum";
import { IOrganization } from "../models/organization.model";

export interface CreateOrganizationInput {
  name: string;
  logo?: string;
  subscriptionPlan?: SubscriptionPlan;
}

export interface UpdateOrganizationInput {
  name?: string;
  logo?: string;
  subscriptionPlan?: SubscriptionPlan;
}

export interface AddMemberInput {
  userId: string;
  role: Role.TEACHER | Role.STUDENT | Role.PARENT;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  subscriptionPlan: SubscriptionPlan;
  ownerId: string;
  teachers: string[];
  students: string[];
  parents: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toOrganizationResponse(
  org: IOrganization
): OrganizationResponse {
  return {
    id: org._id.toString(),
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    subscriptionPlan: org.subscriptionPlan,
    ownerId: org.ownerId.toString(),
    teachers: org.teachers.map((id) => id.toString()),
    students: org.students.map((id) => id.toString()),
    parents: org.parents.map((id) => id.toString()),
    status: org.status,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}
