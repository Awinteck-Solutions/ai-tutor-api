import crypto from "crypto";
import { Role } from "../../../shared/enums/roles.enum";
import { TokenService } from "../../../helpers/tokenizer";
import { Status } from "../../../shared/enums/status.enum";
import { InviteStatus } from "../../../shared/enums/inviteStatus.enum";
import { ActivityType } from "../../../shared/enums/activityType.enum";
import { NotificationType } from "../../../shared/enums/notificationType.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { AuditService } from "../../../shared/services/audit.service";
import { JwtPayload } from "../../../types/express.d";
import { env } from "../../../config/env";
import { inviteEmail, sendMail } from "../../../helpers/emailer";
import User from "../../auth/models/user.model";
import Organization from "../models/organization.model";
import OrganizationInvite from "../models/organizationInvite.model";
import ParentStudentLink from "../../../shared/models/parentStudentLink.model";
import Subject from "../../academic/models/subject.model";
import CourseEnrollment from "../../academic/models/courseEnrollment.model";
import { NotificationService } from "../../notification/services/notification.service";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";

export class OrganizationMemberService {
  static async listMembers(
    user: JwtPayload,
    organizationId: string,
    query: { page?: number; limit?: number; search?: string; role?: string } = {}
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const memberIds = [
      org.ownerId,
      ...org.teachers,
      ...org.students,
      ...org.parents,
    ];

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { _id: { $in: memberIds } };
    if (query.role) filter.role = query.role;

    const searchFilter = buildTextSearchFilter(query.search, [
      "firstName",
      "lastName",
      "email",
    ]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("firstName lastName email role status avatar organizationId createdAt")
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      items: users.map((u) => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        status: u.status,
        avatar: u.avatar,
        isOwner: u._id.toString() === org.ownerId.toString(),
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async inviteMember(
    user: JwtPayload,
    organizationId: string,
    input: { email: string; role: Role.TEACHER | Role.STUDENT | Role.PARENT }
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const existing = await OrganizationInvite.findOne({
      organizationId,
      email: input.email.toLowerCase(),
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    });
    if (existing) {
      throw new AppError("Pending invite already exists for this email", 409);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const invite = await OrganizationInvite.create({
      organizationId,
      email: input.email.toLowerCase(),
      role: input.role,
      token,
      invitedBy: user.sub,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const inviteUrl = `${env.frontendBaseUrl.replace(/\/$/, "")}/organizations/invites/accept?token=${token}`;
    await sendMail(
      input.email,
      `Invitation to join ${org.name}`,
      inviteEmail(org.name, inviteUrl, input.role)
    );

    await AuditService.log({
      organizationId,
      userId: user.sub,
      activityType: ActivityType.INVITE_SENT,
      description: `Invited ${input.email} as ${input.role}`,
      metadata: { email: input.email, role: input.role },
    });

    return { id: invite._id.toString(), email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
  }

  static async listInvites(
    user: JwtPayload,
    organizationId: string,
    query: { page?: number; limit?: number; search?: string; role?: string } = {}
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId,
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    };
    if (query.role) filter.role = query.role;

    const searchFilter = buildTextSearchFilter(query.search, ["email"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [invites, total] = await Promise.all([
      OrganizationInvite.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("email role expiresAt createdAt invitedBy status"),
      OrganizationInvite.countDocuments(filter),
    ]);

    return {
      items: invites.map((invite) => ({
        id: invite._id.toString(),
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        invitedBy: invite.invitedBy?.toString(),
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async createMemberDirect(
    user: JwtPayload,
    organizationId: string,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      role: Role.TEACHER | Role.STUDENT | Role.PARENT | Role.SCHOOL_ADMIN;
    }
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new AppError("Email already registered", 409);
    }

    const member = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      password: TokenService.hashPassword(input.password),
      role: input.role,
      organizationId: org._id,
      status: Status.ACTIVE,
    });

    if (input.role === Role.SCHOOL_ADMIN) {
      // org admin — no array push unless also teacher/student/parent
    } else {
      const field =
        input.role === Role.TEACHER
          ? "teachers"
          : input.role === Role.STUDENT
            ? "students"
            : "parents";
      const ids = org[field].map((id) => id.toString());
      if (!ids.includes(member._id.toString())) {
        org[field].push(member._id);
        await org.save();
      }
    }

    await AuditService.log({
      organizationId,
      userId: user.sub,
      activityType: ActivityType.MEMBER_ADD,
      description: `Created member ${member.email} as ${input.role}`,
      resourceType: "User",
      resourceId: member._id.toString(),
    });

    return {
      id: member._id.toString(),
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
      status: member.status,
    };
  }

  static async listAssignments(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertAdmin(user, organizationId);

    const [subjects, enrollments, parentLinks] = await Promise.all([
      Subject.find({ organizationId, status: Status.ACTIVE })
        .select("name code teacherIds")
        .populate("teacherIds", "firstName lastName email"),
      CourseEnrollment.find({ organizationId, status: Status.ACTIVE })
        .populate("studentId", "firstName lastName email")
        .populate("subjectId", "name code"),
      ParentStudentLink.find({ organizationId, status: Status.ACTIVE })
        .populate("parentId", "firstName lastName email")
        .populate("studentId", "firstName lastName email"),
    ]);

    type PopulatedUser = { _id: { toString(): string }; firstName: string; lastName: string; email: string };

    const teacherAssignments = subjects.flatMap((subject) => {
      const teachers = (subject.teacherIds ?? []) as unknown as PopulatedUser[];
      return teachers.map((teacher) => ({
        subjectId: subject._id.toString(),
        subjectName: subject.name,
        subjectCode: subject.code,
        teacherId: teacher._id.toString(),
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        teacherEmail: teacher.email,
      }));
    });

    const studentEnrollments = enrollments.map((enrollment) => {
      const student = enrollment.studentId as unknown as PopulatedUser;
      const subject = enrollment.subjectId as unknown as { _id: { toString(): string }; name: string; code?: string };
      return {
        enrollmentId: enrollment._id.toString(),
        subjectId: subject?._id?.toString(),
        subjectName: subject?.name,
        subjectCode: subject?.code,
        studentId: student?._id?.toString(),
        studentName: student ? `${student.firstName} ${student.lastName}` : undefined,
        studentEmail: student?.email,
      };
    });

    const parentLinksOut = parentLinks.map((link) => {
      const parent = link.parentId as unknown as PopulatedUser;
      const student = link.studentId as unknown as PopulatedUser;
      return {
        linkId: link._id.toString(),
        parentId: parent?._id?.toString(),
        parentName: parent ? `${parent.firstName} ${parent.lastName}` : undefined,
        parentEmail: parent?.email,
        studentId: student?._id?.toString(),
        studentName: student ? `${student.firstName} ${student.lastName}` : undefined,
        studentEmail: student?.email,
      };
    });

    return {
      teacherAssignments,
      studentEnrollments,
      parentLinks: parentLinksOut,
    };
  }

  static async previewInvite(token: string) {
    const invite = await OrganizationInvite.findOne({
      token,
      status: InviteStatus.PENDING,
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new AppError("Invalid or expired invitation", 400);
    }

    const org = await Organization.findById(invite.organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const existingUser = await User.findOne({ email: invite.email });

    return {
      email: invite.email,
      role: invite.role,
      organizationName: org.name,
      expiresAt: invite.expiresAt,
      requiresRegistration: !existingUser,
    };
  }

  static async acceptInvite(input: {
    token: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }) {
    const invite = await OrganizationInvite.findOne({
      token: input.token,
      status: InviteStatus.PENDING,
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new AppError("Invalid or expired invitation", 400);
    }

    let member = await User.findOne({ email: invite.email });
    if (!member) {
      if (!input.firstName || !input.lastName || !input.password) {
        throw new AppError("Account details required to accept invitation", 400);
      }
      member = await User.create({
        firstName: input.firstName,
        lastName: input.lastName,
        email: invite.email,
        password: TokenService.hashPassword(input.password),
        role: invite.role,
        organizationId: invite.organizationId,
      });
    } else {
      member.organizationId = invite.organizationId;
      member.role = invite.role;
      await member.save();
    }

    const org = await Organization.findById(invite.organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const field = invite.role === Role.TEACHER ? "teachers" : invite.role === Role.STUDENT ? "students" : "parents";
    const ids = org[field].map((id) => id.toString());
    if (!ids.includes(member._id.toString())) {
      org[field].push(member._id);
      await org.save();
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.acceptedAt = new Date();
    await invite.save();

    await NotificationService.create({
      userId: member._id.toString(),
      organizationId: org._id.toString(),
      type: NotificationType.INVITATION,
      title: `Welcome to ${org.name}`,
      body: `You have joined ${org.name} as ${invite.role}.`,
    });

    return { userId: member._id.toString(), organizationId: org._id.toString(), role: invite.role };
  }

  static async suspendMember(
    user: JwtPayload,
    organizationId: string,
    userId: string,
    suspend = true
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);
    if (org.ownerId.toString() === userId) {
      throw new AppError("Cannot suspend organization owner", 400);
    }

    const member = await User.findOne({ _id: userId, organizationId });
    if (!member) throw new AppError("Member not found", 404);

    member.status = suspend ? Status.SUSPENDED : Status.ACTIVE;
    await member.save();

    await AuditService.log({
      organizationId,
      userId: user.sub,
      activityType: suspend ? ActivityType.MEMBER_SUSPEND : ActivityType.MEMBER_ADD,
      description: suspend
        ? `Suspended member ${member.email}`
        : `Reactivated member ${member.email}`,
      resourceType: "User",
      resourceId: userId,
    });

    return { userId, status: member.status };
  }

  static async linkParentToStudent(
    user: JwtPayload,
    organizationId: string,
    parentId: string,
    studentId: string
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const [parent, student] = await Promise.all([
      User.findOne({ _id: parentId, organizationId, role: Role.PARENT }),
      User.findOne({ _id: studentId, organizationId, role: Role.STUDENT }),
    ]);
    if (!parent || !student) {
      throw new AppError("Parent or student not found in organization", 404);
    }

    const link = await ParentStudentLink.findOneAndUpdate(
      { organizationId, parentId, studentId },
      { status: Status.ACTIVE },
      { upsert: true, new: true }
    );

    return { parentId, studentId, linkId: link._id.toString() };
  }

  static async assignTeacherToSubject(
    user: JwtPayload,
    organizationId: string,
    subjectId: string,
    teacherId: string
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const [subject, teacher] = await Promise.all([
      Subject.findOne({ _id: subjectId, organizationId }),
      User.findOne({ _id: teacherId, organizationId, role: Role.TEACHER }),
    ]);
    if (!subject || !teacher) {
      throw new AppError("Subject or teacher not found", 404);
    }

    if (!subject.teacherIds) {
      subject.teacherIds = [];
    }
    const ids = subject.teacherIds.map((id) => id.toString());
    if (!ids.includes(teacherId)) {
      subject.teacherIds.push(teacher._id);
      await subject.save();
    }

    await AuditService.log({
      organizationId,
      userId: user.sub,
      activityType: ActivityType.ASSIGNMENT,
      description: `Assigned teacher ${teacher.email} to subject ${subject.name}`,
    });

    return subject;
  }

  static async enrollStudent(
    user: JwtPayload,
    organizationId: string,
    subjectId: string,
    studentId: string
  ) {
    await AccessControlService.assertAdmin(user, organizationId);

    const [subject, student] = await Promise.all([
      Subject.findOne({ _id: subjectId, organizationId }),
      User.findOne({ _id: studentId, organizationId, role: Role.STUDENT }),
    ]);
    if (!subject || !student) {
      throw new AppError("Subject or student not found", 404);
    }

    const enrollment = await CourseEnrollment.findOneAndUpdate(
      { subjectId, studentId },
      { organizationId, status: Status.ACTIVE, enrolledAt: new Date() },
      { upsert: true, new: true }
    );

    await AuditService.log({
      organizationId,
      userId: user.sub,
      activityType: ActivityType.ASSIGNMENT,
      description: `Enrolled student ${student.email} in ${subject.name}`,
    });

    return enrollment;
  }
}
