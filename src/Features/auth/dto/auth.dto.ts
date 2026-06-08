import { Role } from "../../../shared/enums/roles.enum";
import { IUser } from "../models/user.model";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: string;
  avatar?: string;
  organizationId?: string;
  organizationName?: string;
  isPersonalWorkspace?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: Role;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export function toSafeUser(user: IUser): SafeUser {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    organizationId: user.organizationId?.toString(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}
