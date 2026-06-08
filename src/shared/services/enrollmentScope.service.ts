import mongoose from "mongoose";
import { Role } from "../enums/roles.enum";
import { Status } from "../enums/status.enum";
import { JwtPayload } from "../../types/express.d";
import CourseEnrollment from "../../Features/academic/models/courseEnrollment.model";
import Subject from "../../Features/academic/models/subject.model";

/**
 * Returns subject IDs the user may access, or null if no subject filter applies (admin / super admin).
 * Returns [] when the user has no enrollments/assignments and should see no subject-scoped content.
 */
export class EnrollmentScopeService {
  static async resolveSubjectScope(
    user: JwtPayload,
    organizationId: string
  ): Promise<string[] | null> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.SCHOOL_ADMIN) {
      return null;
    }

    if (user.role === Role.STUDENT) {
      return this.getStudentSubjectIds(user.sub, organizationId);
    }

    if (user.role === Role.TEACHER) {
      return this.getTeacherSubjectIds(user.sub, organizationId);
    }

    return null;
  }

  static applySubjectFilter(
    filter: Record<string, unknown>,
    subjectIds: string[] | null
  ): Record<string, unknown> {
    if (subjectIds === null) {
      return filter;
    }

    filter.subjectId =
      subjectIds.length > 0
        ? { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) }
        : { $in: [] };

    return filter;
  }

  static async getStudentSubjectIds(
    studentId: string,
    organizationId: string
  ): Promise<string[]> {
    const enrollments = await CourseEnrollment.find({
      studentId,
      organizationId,
      status: Status.ACTIVE,
    }).select("subjectId");

    return enrollments.map((e) => e.subjectId.toString());
  }

  static async getTeacherSubjectIds(
    teacherId: string,
    organizationId: string
  ): Promise<string[]> {
    if (!teacherId?.trim() || !organizationId?.trim()) return [];

    let orgOid: mongoose.Types.ObjectId;
    let teacherOid: mongoose.Types.ObjectId;
    try {
      orgOid = new mongoose.Types.ObjectId(organizationId);
      teacherOid = new mongoose.Types.ObjectId(teacherId);
    } catch {
      return [];
    }

    const subjects = await Subject.find({
      organizationId: orgOid,
      status: Status.ACTIVE,
      $or: [{ teacherIds: teacherOid }, { teacherIds: teacherId }],
    }).select("_id");

    return subjects.map((s) => s._id.toString());
  }
}
