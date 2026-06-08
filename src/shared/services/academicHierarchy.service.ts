import { AppError } from "../errors/AppError";
import { Status } from "../enums/status.enum";
import AcademicYear from "../../Features/academic/models/academicYear.model";
import Subject from "../../Features/academic/models/subject.model";
import Topic from "../../Features/academic/models/topic.model";

export interface TopicPlacement {
  topicId: string;
  subjectId: string;
  academicYearId: string;
  organizationId: string;
}

export class AcademicHierarchyService {
  static async resolveTopic(
    topicId: string,
    organizationId: string
  ): Promise<TopicPlacement> {
    const topic = await Topic.findOne({
      _id: topicId,
      organizationId,
      status: Status.ACTIVE,
    });
    if (!topic) {
      throw new AppError("Topic not found in this organization", 404);
    }

    const subject = await Subject.findOne({
      _id: topic.subjectId,
      organizationId,
      status: Status.ACTIVE,
    });
    if (!subject) {
      throw new AppError("Subject not found for topic", 404);
    }

    return {
      topicId: topic._id.toString(),
      subjectId: subject._id.toString(),
      academicYearId: subject.academicYearId.toString(),
      organizationId,
    };
  }

  static async resolveSubject(
    subjectId: string,
    organizationId: string
  ): Promise<{ subjectId: string; academicYearId: string; organizationId: string }> {
    const subject = await Subject.findOne({
      _id: subjectId,
      organizationId,
      status: Status.ACTIVE,
    });
    if (!subject) {
      throw new AppError("Subject not found in this organization", 404);
    }

    return {
      subjectId: subject._id.toString(),
      academicYearId: subject.academicYearId.toString(),
      organizationId,
    };
  }

  static async resolveAcademicYear(
    academicYearId: string,
    organizationId: string
  ): Promise<void> {
    const year = await AcademicYear.findOne({
      _id: academicYearId,
      organizationId,
      status: Status.ACTIVE,
    });
    if (!year) {
      throw new AppError("Academic year not found in this organization", 404);
    }
  }

  static async getTopicIdsForSubject(subjectId: string): Promise<string[]> {
    const topics = await Topic.find({ subjectId, status: Status.ACTIVE }).select("_id");
    return topics.map((t) => t._id.toString());
  }

  static async getSubjectIdsForAcademicYear(academicYearId: string): Promise<string[]> {
    const subjects = await Subject.find({ academicYearId, status: Status.ACTIVE }).select("_id");
    return subjects.map((s) => s._id.toString());
  }
}
