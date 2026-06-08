import { SubscriptionPlan } from "../enums/subscriptionPlan.enum";
import { Status } from "../enums/status.enum";
import { generateSlug } from "../../helpers/random";
import User, { IUser } from "../../Features/auth/models/user.model";
import Organization, { IOrganization } from "../../Features/organization/models/organization.model";

export class StudentWorkspaceService {
  /** Creates a personal FREE workspace for a self-registered student. */
  static async provisionPersonalWorkspace(user: IUser): Promise<IOrganization> {
    if (user.organizationId) {
      const existing = await Organization.findById(user.organizationId);
      if (existing) return existing;
    }

    const baseName = `${user.firstName?.trim() || "My"} Learning Space`;
    let slug = generateSlug(`student-${user._id.toString()}`);
    const slugTaken = await Organization.findOne({ slug });
    if (slugTaken) {
      slug = `${slug}-${Date.now()}`;
    }

    const org = await Organization.create({
      name: baseName,
      slug,
      subscriptionPlan: SubscriptionPlan.FREE,
      ownerId: user._id,
      students: [user._id],
      isPersonalWorkspace: true,
      status: Status.ACTIVE,
    });

    await User.updateOne(
      { _id: user._id },
      { $set: { organizationId: org._id } }
    );
    user.organizationId = org._id;

    return org;
  }

  static async isPersonalWorkspace(organizationId: string): Promise<boolean> {
    const org = await Organization.findById(organizationId).select("isPersonalWorkspace");
    return Boolean(org?.isPersonalWorkspace);
  }
}
