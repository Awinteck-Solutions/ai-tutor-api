import mongoose from "mongoose";
import { Status } from "../enums/status.enum";
import AcademicYear from "../../Features/academic/models/academicYear.model";
import Subject from "../../Features/academic/models/subject.model";
import Topic from "../../Features/academic/models/topic.model";
import {
  SELF_STUDY_SUBJECT_CODE,
  SELF_STUDY_SUBJECT_NAME,
  SELF_STUDY_TOPIC_NAME,
} from "../constants/selfStudy.constants";

export class SelfStudyPlacementService {
  static async ensureGeneralPlacement(organizationId: string) {
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    let academicYear = await AcademicYear.findOne({
      organizationId: orgOid,
      status: Status.ACTIVE,
    }).sort({ createdAt: -1 });

    if (!academicYear) {
      academicYear = await AcademicYear.create({
        organizationId: orgOid,
        name: "Default",
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        status: Status.ACTIVE,
      });
    }

    let subject = await Subject.findOne({
      organizationId: orgOid,
      code: SELF_STUDY_SUBJECT_CODE,
      status: Status.ACTIVE,
    });

    if (!subject) {
      subject = await Subject.create({
        organizationId: orgOid,
        academicYearId: academicYear._id,
        name: SELF_STUDY_SUBJECT_NAME,
        code: SELF_STUDY_SUBJECT_CODE,
        description:
          "Personal self-study workspace — not shown in school catalogs",
        order: 9999,
        status: Status.ACTIVE,
      });
    }

    let topic = await Topic.findOne({
      subjectId: subject._id,
      name: SELF_STUDY_TOPIC_NAME,
      status: Status.ACTIVE,
    });

    if (!topic) {
      topic = await Topic.create({
        organizationId: orgOid,
        subjectId: subject._id,
        name: SELF_STUDY_TOPIC_NAME,
        order: 0,
        status: Status.ACTIVE,
      });
    }

    return {
      subjectId: subject._id,
      topicId: topic._id,
      academicYearId: academicYear._id,
    };
  }
}
