import { Role } from "../shared/enums/roles.enum";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  organizationId?: string;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: JwtPayload;
    }
  }
}

export {};
