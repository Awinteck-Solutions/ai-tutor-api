import { SELF_STUDY_SUBJECT_CODE } from "../../../shared/constants/selfStudy.constants";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";
import { JwtPayload } from "../../../types/express.d";
import AcademicYear from "../models/academicYear.model";
import Term from "../models/term.model";
import Subject from "../models/subject.model";
import Topic from "../models/topic.model";
import CourseEnrollment from "../models/courseEnrollment.model";
import mongoose from "mongoose";

export class AcademicService {
  // --- Academic Year ---
  static async createYear(user: JwtPayload, organizationId: string, input: {
    name: string; startDate: string; endDate: string; isCurrent?: boolean;
  }) {
    await AccessControlService.assertAdmin(user, organizationId);
    if (input.isCurrent) {
      await AcademicYear.updateMany({ organizationId }, { isCurrent: false });
    }
    return AcademicYear.create({ organizationId, ...input, startDate: new Date(input.startDate), endDate: new Date(input.endDate) });
  }

  static async listYears(
    user: JwtPayload,
    organizationId: string,
    query: { page?: number; limit?: number; search?: string } = {}
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { organizationId, status: Status.ACTIVE };
    const searchFilter = buildTextSearchFilter(query.search, ["name"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      AcademicYear.find(filter).sort({ startDate: -1 }).skip(skip).limit(limit),
      AcademicYear.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  // --- Term ---
  static async createTerm(user: JwtPayload, organizationId: string, input: {
    academicYearId: string; name: string; startDate: string; endDate: string; order?: number;
  }) {
    await AccessControlService.assertAdmin(user, organizationId);
    return Term.create({
      organizationId,
      academicYearId: input.academicYearId,
      name: input.name,
      order: input.order ?? 0,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    });
  }

  static async listTerms(
    user: JwtPayload,
    organizationId: string,
    academicYearId: string,
    query: { page?: number; limit?: number; search?: string } = {}
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId,
      academicYearId,
      status: Status.ACTIVE,
    };
    const searchFilter = buildTextSearchFilter(query.search, ["name"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      Term.find(filter).sort({ order: 1 }).skip(skip).limit(limit),
      Term.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  // --- Subject ---
  private static async resolveAcademicYearId(
    organizationId: string,
    academicYearId?: string
  ): Promise<string> {
    if (academicYearId) return academicYearId;

    const current = await AcademicYear.findOne({
      organizationId,
      status: Status.ACTIVE,
      isCurrent: true,
    });
    if (current) return current._id.toString();

    const latest = await AcademicYear.findOne({
      organizationId,
      status: Status.ACTIVE,
    }).sort({ startDate: -1 });

    if (!latest) {
      throw new AppError(
        "Create an academic year before adding subjects",
        400
      );
    }

    return latest._id.toString();
  }

  static async createSubject(user: JwtPayload, organizationId: string, input: {
    academicYearId?: string; termId?: string; name: string; code?: string; description?: string; order?: number;
  }) {
    await AccessControlService.assertAdmin(user, organizationId);
    const academicYearId = await this.resolveAcademicYearId(
      organizationId,
      input.academicYearId
    );
    return Subject.create({
      organizationId,
      academicYearId,
      termId: input.termId,
      name: input.name,
      code: input.code,
      description: input.description,
      order: input.order ?? 0,
    });
  }

  static async listSubjects(
    user: JwtPayload,
    organizationId: string,
    query: { academicYearId?: string; page?: number; limit?: number; search?: string } = {}
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
      code: { $ne: SELF_STUDY_SUBJECT_CODE },
    };
    if (query.academicYearId) filter.academicYearId = query.academicYearId;

    const searchFilter = buildTextSearchFilter(query.search, ["name", "code", "description"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      Subject.find(filter).sort({ order: 1 }).skip(skip).limit(limit),
      Subject.countDocuments(filter),
    ]);

    const subjectIds = items.map((s) => s._id);
    const enrollmentCounts = subjectIds.length
      ? await CourseEnrollment.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              subjectId: { $in: subjectIds },
              status: Status.ACTIVE,
            },
          },
          { $group: { _id: "$subjectId", count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(
      enrollmentCounts.map((e) => [e._id.toString(), e.count as number])
    );

    const enriched = items.map((s) => ({
      ...s.toObject(),
      enrolledStudentCount: countMap.get(s._id.toString()) ?? 0,
    }));

    return { items: enriched, meta: buildPaginationMeta(total, page, limit) };
  }

  static async listSubjectEnrollments(
    user: JwtPayload,
    organizationId: string,
    subjectId: string
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const subject = await Subject.findOne({ _id: subjectId, organizationId });
    if (!subject) throw new AppError("Subject not found", 404);

    const enrollments = await CourseEnrollment.find({
      organizationId,
      subjectId,
      status: Status.ACTIVE,
    })
      .populate("studentId", "firstName lastName email")
      .sort({ enrolledAt: -1 });

    type PopulatedStudent = {
      _id: { toString(): string };
      firstName: string;
      lastName: string;
      email: string;
    };

    return {
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      total: enrollments.length,
      students: enrollments
        .map((e) => {
          const student = e.studentId as unknown as PopulatedStudent;
          if (!student?._id) return null;
          return {
            id: student._id.toString(),
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            enrolledAt: e.enrolledAt,
          };
        })
        .filter(Boolean),
    };
  }

  static async updateSubjectOrder(user: JwtPayload, organizationId: string, subjectId: string, order: number) {
    await AccessControlService.assertAdmin(user, organizationId);
    const subject = await Subject.findOne({ _id: subjectId, organizationId });
    if (!subject) throw new AppError("Subject not found", 404);
    subject.order = order;
    await subject.save();
    return subject;
  }

  // --- Topic ---
  static async createTopic(user: JwtPayload, organizationId: string, input: {
    subjectId: string; name: string; description?: string; order?: number;
  }) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const subject = await Subject.findOne({ _id: input.subjectId, organizationId });
    if (!subject) throw new AppError("Subject not found", 404);
    return Topic.create({ organizationId, ...input, order: input.order ?? 0 });
  }

  static async listTopics(
    user: JwtPayload,
    organizationId: string,
    subjectId: string,
    query: { page?: number; limit?: number; search?: string } = {}
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId,
      subjectId,
      status: Status.ACTIVE,
    };
    const searchFilter = buildTextSearchFilter(query.search, ["name", "description"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      Topic.find(filter).sort({ order: 1 }).skip(skip).limit(limit),
      Topic.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  static async reorderTopics(user: JwtPayload, organizationId: string, subjectId: string, orderedIds: string[]) {
    await AccessControlService.assertOrgManage(user, organizationId);
    await Promise.all(
      orderedIds.map((id, index) =>
        Topic.updateOne({ _id: id, organizationId, subjectId }, { order: index })
      )
    );
    return Topic.find({ organizationId, subjectId }).sort({ order: 1 });
  }
}
