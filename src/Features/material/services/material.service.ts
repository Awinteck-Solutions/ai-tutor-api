import { SELF_STUDY_SUBJECT_CODE } from "../../../shared/constants/selfStudy.constants";
import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { MaterialType } from "../../../shared/enums/materialType.enum";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { MaterialProcessingStage } from "../../../shared/enums/materialProcessingStage.enum";
import { ActivityType } from "../../../shared/enums/activityType.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { EnrollmentScopeService } from "../../../shared/services/enrollmentScope.service";
import { AuditService } from "../../../shared/services/audit.service";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";
import {
  generateFileKey,
  sanitizeFilename,
  titleFromFilename,
} from "../../../helpers/uploader";
import { R2StorageService } from "../../../services/storage/r2.service";
import { QdrantService } from "../../../services/qdrant/qdrant.service";
import {
  enqueueJob,
  JobType,
  ProcessMaterialJobData,
} from "../../../services/queue/job.queue";
import { MATERIAL_QUEUE } from "../../../services/qdrant/qdrant.constants";
import Subject from "../../academic/models/subject.model";
import Topic from "../../academic/models/topic.model";
import { IMaterial } from "../models/material.model";
import Material from "../models/material.model";
import MaterialChunk from "../models/materialChunk.model";
import MaterialProcessingLog from "../models/materialProcessingLog.model";
import {
  MaterialChunkResponse,
  MaterialResponse,
  toChunkResponse,
  toMaterialResponse,
  UploadPdfInput,
  UploadTextInput,
  UploadYoutubeInput,
} from "../dto/material.dto";
import { JwtPayload } from "../../../types/express.d";
import { AcademicHierarchyService } from "../../../shared/services/academicHierarchy.service";

export class MaterialService {
  private static async resolveTopicFields(
    organizationId: string,
    topicId: string
  ) {
    const placement = await AcademicHierarchyService.resolveTopic(
      topicId,
      organizationId
    );
    return {
      topicId: placement.topicId,
      subjectId: placement.subjectId,
      academicYearId: placement.academicYearId,
    };
  }

  static async uploadPdf(
    user: JwtPayload,
    input: UploadPdfInput,
    file: Express.Multer.File
  ): Promise<MaterialResponse> {
    await this.assertUploadAccess(user, input.organizationId);

    if (file.mimetype !== "application/pdf") {
      throw new AppError("Only PDF files are allowed", 400);
    }

    const key = generateFileKey(input.organizationId, sanitizeFilename(file.originalname));
    const { url } = await R2StorageService.upload(
      key,
      file.buffer,
      file.mimetype
    );

    const topicFields = await this.resolveTopicFields(
      input.organizationId,
      input.topicId
    );

    const title =
      input.title?.trim() || titleFromFilename(file.originalname);

    const material = await Material.create({
      organizationId: input.organizationId,
      ...topicFields,
      uploadedBy: user.sub,
      title,
      description: input.description,
      subjectName: input.subjectName,
      tags: input.tags ?? [],
      type: MaterialType.PDF,
      processingStatus: ProcessingStatus.PENDING,
      processingStage: MaterialProcessingStage.UPLOADED,
      fileName: sanitizeFilename(file.originalname),
      mimeType: file.mimetype,
      fileSize: file.size,
      r2Key: key,
      r2Url: url,
    });

    await this.enqueueProcessing(material._id.toString(), input.organizationId);

    const updated = await Material.findById(material._id);
    return toMaterialResponse(updated!);
  }

  static async uploadText(
    user: JwtPayload,
    input: UploadTextInput
  ): Promise<MaterialResponse> {
    await this.assertUploadAccess(user, input.organizationId);

    const topicFields = await this.resolveTopicFields(
      input.organizationId,
      input.topicId
    );

    const material = await Material.create({
      organizationId: input.organizationId,
      ...topicFields,
      uploadedBy: user.sub,
      title: input.title,
      description: input.description,
      subjectName: input.subjectName,
      tags: input.tags ?? [],
      type: MaterialType.TEXT,
      processingStatus: ProcessingStatus.PENDING,
      processingStage: MaterialProcessingStage.UPLOADED,
      rawText: input.content,
    });

    await this.enqueueProcessing(material._id.toString(), input.organizationId);
    return toMaterialResponse(material);
  }

  static async uploadYoutube(
    user: JwtPayload,
    input: UploadYoutubeInput
  ): Promise<MaterialResponse> {
    await this.assertUploadAccess(user, input.organizationId);

    const topicFields = await this.resolveTopicFields(
      input.organizationId,
      input.topicId
    );

    const material = await Material.create({
      organizationId: input.organizationId,
      ...topicFields,
      uploadedBy: user.sub,
      title: input.title,
      description: input.description,
      subjectName: input.subjectName,
      tags: input.tags ?? [],
      type: MaterialType.YOUTUBE,
      processingStatus: ProcessingStatus.PENDING,
      processingStage: MaterialProcessingStage.UPLOADED,
      sourceUrl: input.youtubeUrl,
    });

    await this.enqueueProcessing(material._id.toString(), input.organizationId);
    return toMaterialResponse(material);
  }

  static async getById(
    user: JwtPayload,
    materialId: string
  ): Promise<MaterialResponse> {
    const material = await this.findMaterialOrFail(materialId);
    await this.assertReadAccess(user, material);
    return toMaterialResponse(material);
  }

  static async list(
    user: JwtPayload,
    query: {
      organizationId: string;
      topicId?: string;
      subjectId?: string;
      page?: number;
      limit?: number;
      processingStatus?: string;
      type?: string;
      search?: string;
    }
  ) {
    await AccessControlService.assertOrgRead(user, query.organizationId);

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId: query.organizationId,
      status: { $ne: Status.DELETED },
    };

    if (query.topicId) filter.topicId = query.topicId;
    if (query.subjectId) filter.subjectId = query.subjectId;
    if (query.processingStatus) filter.processingStatus = query.processingStatus;
    if (query.type) filter.type = query.type;

    const searchFilter = buildTextSearchFilter(query.search, ["title", "name"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const subjectScope = await EnrollmentScopeService.resolveSubjectScope(
      user,
      query.organizationId
    );
    if (subjectScope !== null && !query.subjectId) {
      EnrollmentScopeService.applySubjectFilter(filter, subjectScope);
    }

    if (!query.topicId && !query.subjectId) {
      const selfStudySubject = await Subject.findOne({
        organizationId: query.organizationId,
        code: SELF_STUDY_SUBJECT_CODE,
        status: Status.ACTIVE,
      }).select("_id");
      if (selfStudySubject) {
        const selfStudyTopicIds = await Topic.find({
          subjectId: selfStudySubject._id,
          status: Status.ACTIVE,
        }).distinct("_id");
        if (selfStudyTopicIds.length) {
          filter.topicId = { $nin: selfStudyTopicIds };
        }
      }
    }

    const [items, total] = await Promise.all([
      Material.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Material.countDocuments(filter),
    ]);

    return {
      items: items.map(toMaterialResponse),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
  static async getChunks(
    user: JwtPayload,
    materialId: string
  ): Promise<MaterialChunkResponse[]> {
    const material = await this.findMaterialOrFail(materialId);
    await this.assertReadAccess(user, material);

    if (material.processingStatus !== ProcessingStatus.COMPLETED) {
      throw new AppError("Material processing is not complete", 422);
    }

    const chunks = await MaterialChunk.find({ materialId })
      .sort({ chunkIndex: 1 })
      .limit(200);

    return chunks.map(toChunkResponse);
  }

  static async archive(user: JwtPayload, materialId: string): Promise<MaterialResponse> {
    const material = await this.findMaterialOrFail(materialId);
    await AccessControlService.assertOrgUpload(user, material.organizationId.toString());

    material.status = Status.INACTIVE;
    await material.save();

    await AuditService.log({
      organizationId: material.organizationId.toString(),
      userId: user.sub,
      activityType: ActivityType.ARCHIVE,
      description: `Archived material ${material.title}`,
      resourceType: "Material",
      resourceId: materialId,
    });

    return toMaterialResponse(material);
  }

  static async getProcessingLogs(user: JwtPayload, materialId: string) {
    const material = await this.findMaterialOrFail(materialId);
    await AccessControlService.assertOrgRead(user, material.organizationId.toString());

    return MaterialProcessingLog.find({ materialId })
      .sort({ createdAt: 1 })
      .limit(100);
  }

  static async reprocess(
    user: JwtPayload,
    materialId: string
  ): Promise<MaterialResponse> {
    const material = await this.findMaterialOrFail(materialId);
    await this.assertUploadAccess(user, material.organizationId.toString());

    material.processingStatus = ProcessingStatus.PENDING;
    material.processingStage = MaterialProcessingStage.UPLOADED;
    material.errorMessage = undefined;
    await material.save();

    await AuditService.log({
      organizationId: material.organizationId.toString(),
      userId: user.sub,
      activityType: ActivityType.MATERIAL_REPROCESS,
      description: `Requeued material ${material.title}`,
      resourceType: "Material",
      resourceId: materialId,
    });

    await this.enqueueProcessing(
      material._id.toString(),
      material.organizationId.toString()
    );

    return toMaterialResponse(material);
  }

  static async delete(user: JwtPayload, materialId: string): Promise<void> {
    const material = await this.findMaterialOrFail(materialId);
    await this.assertUploadAccess(user, material.organizationId.toString());

    if (material.r2Key) {
      try {
        await R2StorageService.delete(material.r2Key);
      } catch (error) {
        console.warn(`Failed to delete R2 object ${material.r2Key}:`, error);
      }
    }

    await QdrantService.deleteMaterialVectors(material._id.toString());
    await MaterialChunk.deleteMany({ materialId: material._id });

    material.status = Status.DELETED;
    material.processingStatus = ProcessingStatus.FAILED;
    material.processingStage = MaterialProcessingStage.FAILED;
    await material.save();

    await AuditService.log({
      organizationId: material.organizationId.toString(),
      userId: user.sub,
      activityType: ActivityType.DELETE,
      description: `Deleted material ${material.title}`,
      resourceType: "Material",
      resourceId: materialId,
    });
  }

  private static async enqueueProcessing(
    materialId: string,
    organizationId: string
  ): Promise<void> {
    try {
      const jobId = await enqueueJob<ProcessMaterialJobData>(
        MATERIAL_QUEUE,
        JobType.PROCESS_MATERIAL,
        { materialId, organizationId }
      );

      await Material.findByIdAndUpdate(materialId, {
        processingStatus: ProcessingStatus.QUEUED,
        jobId,
      });
    } catch (error) {
      await Material.findByIdAndUpdate(materialId, {
        processingStatus: ProcessingStatus.FAILED,
        errorMessage:
          "Failed to queue processing job. Ensure Redis is running.",
      });
      throw new AppError(
        "Processing queue unavailable. Ensure Redis is running.",
        503
      );
    }
  }

  private static async findMaterialOrFail(materialId: string) {
    const material = await Material.findOne({
      _id: materialId,
      status: { $ne: Status.DELETED },
    });
    if (!material) {
      throw new AppError("Material not found", 404);
    }
    return material;
  }

  private static async assertUploadAccess(
    user: JwtPayload,
    organizationId: string
  ): Promise<void> {
    return AccessControlService.assertOrgUpload(user, organizationId);
  }

  private static async assertReadAccess(
    user: JwtPayload,
    material: IMaterial
  ): Promise<void> {
    const organizationId = material.organizationId.toString();
    await AccessControlService.assertOrgRead(user, organizationId);

    if (user.role !== Role.STUDENT) return;

    if (material.uploadedBy.toString() === user.sub) return;

    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      user.sub,
      organizationId
    );
    if (
      subjectIds.length === 0 ||
      !subjectIds.includes(material.subjectId.toString())
    ) {
      throw new AppError("You do not have access to this material", 403);
    }
  }
}
