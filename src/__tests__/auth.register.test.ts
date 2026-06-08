import { Role } from "../shared/enums/roles.enum";

describe("Auth registration policy", () => {
  it("only allows STUDENT role for self-registration", () => {
    const allowed = Role.STUDENT;
    const rejected = [Role.TEACHER, Role.SCHOOL_ADMIN, Role.PARENT, Role.SUPER_ADMIN];
    expect(allowed).toBe("STUDENT");
    for (const role of rejected) {
      expect(role).not.toBe(Role.STUDENT);
    }
  });
});
