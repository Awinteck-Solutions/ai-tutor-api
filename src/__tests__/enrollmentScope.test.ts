import { EnrollmentScopeService } from "../shared/services/enrollmentScope.service";

describe("EnrollmentScopeService.applySubjectFilter", () => {
  it("does not filter when scope is null", () => {
    const filter = { organizationId: "org1" };
    const result = EnrollmentScopeService.applySubjectFilter(filter, null);
    expect(result).toEqual({ organizationId: "org1" });
    expect(result.subjectId).toBeUndefined();
  });

  it("applies empty filter when no subject ids", () => {
    const filter = { organizationId: "org1" };
    const result = EnrollmentScopeService.applySubjectFilter(filter, []);
    expect(result.subjectId).toEqual({ $in: [] });
  });

  it("applies subject id list when provided", () => {
    const filter = { organizationId: "org1" };
    const result = EnrollmentScopeService.applySubjectFilter(filter, [
      "507f1f77bcf86cd799439011",
    ]);
    expect(result.subjectId).toBeDefined();
    expect((result.subjectId as { $in: unknown[] }).$in).toHaveLength(1);
  });
});
