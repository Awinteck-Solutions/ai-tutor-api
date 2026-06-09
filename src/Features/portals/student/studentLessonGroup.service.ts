import mongoose from "mongoose";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { JwtPayload } from "../../../types/express.d";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import Lesson from "../../lesson/models/lesson.model";
import LessonGroup from "../../lesson/models/lessonGroup.model";

export class StudentLessonGroupService {
  static async list(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const ownerOid = new mongoose.Types.ObjectId(user.sub);

    const groups = await LessonGroup.find({
      organizationId: orgOid,
      ownerId: ownerOid,
      status: Status.ACTIVE,
    }).sort({ order: 1, createdAt: 1 });

    const groupIds = groups.map((g) => g._id);
    const lessonCounts = await Lesson.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      {
        $match: {
          organizationId: orgOid,
          ownerId: ownerOid,
          isPersonal: true,
          status: Status.ACTIVE,
          groupId: { $in: groupIds },
        },
      },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      lessonCounts.map((row) => [row._id.toString(), row.count])
    );

    const ungroupedCount = await Lesson.countDocuments({
      organizationId: orgOid,
      ownerId: ownerOid,
      isPersonal: true,
      status: Status.ACTIVE,
      $or: [{ groupId: { $exists: false } }, { groupId: null }],
    });

    return {
      groups: groups.map((g) => ({
        id: g._id.toString(),
        title: g.title,
        description: g.description,
        order: g.order,
        lessonCount: countMap.get(g._id.toString()) ?? 0,
      })),
      ungroupedCount,
    };
  }

  static async create(
    user: JwtPayload,
    organizationId: string,
    input: { title: string; description?: string }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const title = input.title?.trim();
    if (!title || title.length < 2) {
      throw new AppError("Group title must be at least 2 characters", 400);
    }

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const ownerOid = new mongoose.Types.ObjectId(user.sub);

    const maxOrder = await LessonGroup.findOne({
      organizationId: orgOid,
      ownerId: ownerOid,
      status: Status.ACTIVE,
    })
      .sort({ order: -1 })
      .select("order");

    const group = await LessonGroup.create({
      organizationId: orgOid,
      ownerId: ownerOid,
      title,
      description: input.description?.trim(),
      order: (maxOrder?.order ?? -1) + 1,
      status: Status.ACTIVE,
    });

    return {
      id: group._id.toString(),
      title: group.title,
      description: group.description,
      order: group.order,
      lessonCount: 0,
    };
  }

  static async update(
    user: JwtPayload,
    organizationId: string,
    groupId: string,
    input: { title?: string; description?: string; order?: number }
  ) {
    const group = await this.assertGroupAccess(user, organizationId, groupId);

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length < 2) {
        throw new AppError("Group title must be at least 2 characters", 400);
      }
      group.title = title;
    }
    if (input.description !== undefined) {
      group.description = input.description.trim() || undefined;
    }
    if (input.order !== undefined) {
      group.order = input.order;
    }
    await group.save();

    return {
      id: group._id.toString(),
      title: group.title,
      description: group.description,
      order: group.order,
    };
  }

  static async delete(
    user: JwtPayload,
    organizationId: string,
    groupId: string
  ) {
    const group = await this.assertGroupAccess(user, organizationId, groupId);

    await Lesson.updateMany(
      { groupId: group._id, ownerId: group.ownerId },
      { $unset: { groupId: "", groupOrder: "" } }
    );

    group.status = Status.DELETED;
    await group.save();

    return { id: groupId, message: "Group deleted" };
  }

  static async assignLesson(
    user: JwtPayload,
    organizationId: string,
    lessonId: string,
    input: { groupId?: string | null; groupOrder?: number }
  ) {
    const lesson = await this.assertPersonalLesson(user, organizationId, lessonId);

    if (input.groupId === null || input.groupId === undefined || input.groupId === "") {
      lesson.groupId = undefined;
      lesson.groupOrder = 0;
      await lesson.save();
      return {
        lessonId,
        groupId: null,
        groupTitle: null,
        message: "Lesson removed from group",
      };
    }

    const group = await this.assertGroupAccess(user, organizationId, input.groupId);

    let groupOrder = input.groupOrder;
    if (groupOrder === undefined) {
      const maxOrder = await Lesson.findOne({
        groupId: group._id,
        status: Status.ACTIVE,
      })
        .sort({ groupOrder: -1 })
        .select("groupOrder");
      groupOrder = (maxOrder?.groupOrder ?? -1) + 1;
    }

    lesson.groupId = group._id;
    lesson.groupOrder = groupOrder;
    await lesson.save();

    return {
      lessonId,
      groupId: group._id.toString(),
      groupTitle: group.title,
      groupOrder: lesson.groupOrder,
      message: "Lesson added to group",
    };
  }

  static async listGroupLessons(
    user: JwtPayload,
    organizationId: string,
    groupId: string
  ) {
    await this.assertGroupAccess(user, organizationId, groupId);

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const ownerOid = new mongoose.Types.ObjectId(user.sub);
    const groupOid = new mongoose.Types.ObjectId(groupId);

    const lessons = await Lesson.find({
      organizationId: orgOid,
      ownerId: ownerOid,
      isPersonal: true,
      groupId: groupOid,
      status: Status.ACTIVE,
    })
      .sort({ groupOrder: 1, createdAt: -1 })
      .select("title summary generationStatus groupOrder createdAt studentLevel");

    return lessons.map((l) => ({
      id: l._id.toString(),
      title: l.title,
      summary: l.summary,
      generationStatus: l.generationStatus,
      groupOrder: l.groupOrder ?? 0,
      studentLevel: l.studentLevel,
      createdAt: l.createdAt,
    }));
  }

  private static async assertGroupAccess(
    user: JwtPayload,
    organizationId: string,
    groupId: string
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const group = await LessonGroup.findOne({
      _id: groupId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ownerId: new mongoose.Types.ObjectId(user.sub),
      status: Status.ACTIVE,
    });

    if (!group) {
      throw new AppError("Lesson group not found", 404);
    }

    return group;
  }

  private static async assertPersonalLesson(
    user: JwtPayload,
    organizationId: string,
    lessonId: string
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const lesson = await Lesson.findOne({
      _id: lessonId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ownerId: new mongoose.Types.ObjectId(user.sub),
      isPersonal: true,
      status: Status.ACTIVE,
    });

    if (!lesson) {
      throw new AppError("Personal lesson not found", 404);
    }

    return lesson;
  }
}
