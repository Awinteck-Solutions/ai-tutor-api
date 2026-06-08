/**
 * Inspect teacher ↔ subject assignments in MongoDB.
 * Usage: npx ts-node scripts/diagnose-teacher-subjects.ts [teacherEmail]
 */
import mongoose from "mongoose";
import { env } from "../src/config/env";
import User from "../src/Features/auth/models/user.model";
import Subject from "../src/Features/academic/models/subject.model";
import { EnrollmentScopeService } from "../src/shared/services/enrollmentScope.service";
import { Role } from "../src/shared/enums/roles.enum";
import { Status } from "../src/shared/enums/status.enum";

async function main() {
  const emailArg = process.argv[2];
  await mongoose.connect(env.dbUrl);

  const teachers = emailArg
    ? await User.find({ email: emailArg.toLowerCase(), role: Role.TEACHER })
    : await User.find({ role: Role.TEACHER }).limit(5);

  if (!teachers.length) {
    console.log("No teacher users found.");
    await mongoose.disconnect();
    return;
  }

  for (const teacher of teachers) {
    const teacherId = teacher._id.toString();
    const orgId = teacher.organizationId?.toString() ?? "(none)";

    console.log("\n--- Teacher ---");
    console.log({ id: teacherId, email: teacher.email, organizationId: orgId });

    const rawSubjects = await Subject.find({
      teacherIds: { $exists: true, $ne: [] },
    }).select("name organizationId teacherIds status");

    const containingTeacher = rawSubjects.filter((s) =>
      (s.teacherIds ?? []).some((id) => id.toString() === teacherId)
    );

    console.log(`Subjects in DB with this teacher in teacherIds: ${containingTeacher.length}`);
    for (const s of containingTeacher) {
      console.log("  -", {
        subjectId: s._id.toString(),
        name: s.name,
        subjectOrg: s.organizationId?.toString(),
        status: s.status,
        teacherIds: (s.teacherIds ?? []).map((id) => id.toString()),
      });
    }

    if (orgId !== "(none)") {
      const viaService = await EnrollmentScopeService.getTeacherSubjectIds(
        teacherId,
        orgId
      );
      console.log(`getTeacherSubjectIds(teacher, profile org): ${viaService.length}`, viaService);

      const legacyQuery = await Subject.find({
        organizationId: orgId,
        teacherIds: teacherId,
        status: Status.ACTIVE,
      }).select("_id name");
      console.log(`Legacy query (string org + string teacherIds): ${legacyQuery.length}`);

      const oidQuery = await Subject.find({
        organizationId: new mongoose.Types.ObjectId(orgId),
        teacherIds: new mongoose.Types.ObjectId(teacherId),
        status: Status.ACTIVE,
      }).select("_id name");
      console.log(`ObjectId query: ${oidQuery.length}`);

      if (containingTeacher.length > 0 && viaService.length === 0) {
        const mismatch = containingTeacher.filter(
          (s) => s.organizationId?.toString() !== orgId
        );
        if (mismatch.length) {
          console.log(
            "⚠️  Teacher is assigned on subject(s) in a DIFFERENT organization than user.organizationId:"
          );
          mismatch.forEach((s) =>
            console.log(`     subject org ${s.organizationId} vs user org ${orgId}`)
          );
        }
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
