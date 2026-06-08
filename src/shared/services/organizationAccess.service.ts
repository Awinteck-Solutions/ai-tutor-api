import { JwtPayload } from "../../types/express.d";
import { AccessControlService } from "./accessControl.service";

/** @deprecated Use AccessControlService directly for new code */
export class OrganizationAccessService {
  static async assertManageAccess(
    user: JwtPayload,
    organizationId: string
  ): Promise<void> {
    return AccessControlService.assertOrgManage(user, organizationId);
  }

  static async assertReadAccess(
    user: JwtPayload,
    organizationId: string
  ): Promise<void> {
    return AccessControlService.assertOrgRead(user, organizationId);
  }
}
