import { env } from "../../../config/env";
import { passwordResetEmail, sendMail, welcomeEmail } from "../../../helpers/emailer";
import { TokenService } from "../../../helpers/tokenizer";
import { Role } from "../../../shared/enums/roles.enum";
import { AppError } from "../../../shared/errors/AppError";
import {
  AuthResponse,
  AuthTokens,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SafeUser,
  toSafeUser,
  UpdateProfileInput,
} from "../dto/auth.dto";
import RefreshToken from "../models/refreshToken.model";
import User, { IUser } from "../models/user.model";
import Organization from "../../organization/models/organization.model";
import { StudentWorkspaceService } from "../../../shared/services/studentWorkspace.service";

async function enrichSafeUser(user: IUser): Promise<SafeUser> {
  const base = toSafeUser(user);
  if (!user.organizationId) {
    return { ...base, isPersonalWorkspace: false };
  }

  const org = await Organization.findById(user.organizationId).select(
    "name isPersonalWorkspace"
  );

  return {
    ...base,
    organizationName: org?.name,
    isPersonalWorkspace: Boolean(org?.isPersonalWorkspace),
  };
}

export class AuthService {
  static async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw new AppError("Email already registered", 409);
    }

    if (input.role && input.role !== Role.STUDENT) {
      throw new AppError(
        "Only student self-registration is allowed. Staff accounts require an invitation.",
        403
      );
    }

    const user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: TokenService.hashPassword(input.password),
      role: Role.STUDENT,
    });

    await StudentWorkspaceService.provisionPersonalWorkspace(user);

    const refreshed = await User.findById(user._id);
    const activeUser = refreshed ?? user;

    const tokens = await this.issueTokens(activeUser);
    await sendMail(activeUser.email, "Welcome to Adesia", welcomeEmail(activeUser.firstName));

    return { user: await enrichSafeUser(activeUser), tokens };
  }

  static async login(input: LoginInput): Promise<AuthResponse> {
    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Account is not active", 403);
    }

    const isValid = TokenService.comparePassword(input.password, user.password);
    if (!isValid) {
      throw new AppError("Invalid email or password", 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.issueTokens(user);
    return { user: await enrichSafeUser(user), tokens };
  }

  static async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string };
    try {
      payload = TokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }

    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError("Refresh token expired or revoked", 401);
    }

    const user = await User.findById(payload.sub);
    if (!user || user.status !== "ACTIVE") {
      throw new AppError("User not found or inactive", 401);
    }

    await RefreshToken.deleteOne({ _id: stored._id });
    return this.issueTokens(user);
  }

  static async logout(refreshToken: string): Promise<void> {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  static async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email }).select(
      "+passwordResetToken +passwordResetExpires"
    );
    if (!user) {
      return;
    }

    const { token, hash } = TokenService.generateResetToken();
    user.passwordResetToken = hash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${env.apiBaseUrl}/auth/reset-password?token=${token}`;
    await sendMail(
      user.email,
      "Reset your password",
      passwordResetEmail(user.firstName, resetUrl)
    );
  }

  static async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hash = TokenService.hashResetToken(input.token);
    const user = await User.findOne({
      passwordResetToken: hash,
      passwordResetExpires: { $gt: new Date() },
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    user.password = TokenService.hashPassword(input.newPassword);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await RefreshToken.deleteMany({ userId: user._id });
  }

  static async getProfile(userId: string): Promise<SafeUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return await enrichSafeUser(user);
  }

  static async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<SafeUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (input.firstName) user.firstName = input.firstName;
    if (input.lastName) user.lastName = input.lastName;
    if (input.avatar !== undefined) user.avatar = input.avatar;

    await user.save();
    return await enrichSafeUser(user);
  }

  static async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const isValid = TokenService.comparePassword(
      input.currentPassword,
      user.password
    );
    if (!isValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    user.password = TokenService.hashPassword(input.newPassword);
    await user.save();
    await RefreshToken.deleteMany({ userId: user._id });
  }

  private static async issueTokens(user: IUser): Promise<AuthTokens> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString(),
    };

    const accessToken = TokenService.generateAccessToken(payload);
    const refreshToken = TokenService.generateRefreshToken({ sub: payload.sub });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }
}
