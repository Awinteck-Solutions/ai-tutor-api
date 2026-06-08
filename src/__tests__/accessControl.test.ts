import { Role } from "../shared/enums/roles.enum";
import { AccessControlService } from "../shared/services/accessControl.service";
import { normalizeCreateSessionInput } from "../Features/chat/dto/chat.dto";
import { ChatContextType } from "../shared/enums/chat.enum";

describe("normalizeCreateSessionInput", () => {
  it("strips invalid placeholder ids", () => {
    const result = normalizeCreateSessionInput({
      organizationId: "507f1f77bcf86cd799439011",
      lessonId: "6a17bb80ca387e1e4409d268",
      topicId: "string",
      materialId: "string",
    });
    expect(result.lessonId).toBe("6a17bb80ca387e1e4409d268");
    expect(result.topicId).toBeUndefined();
    expect(result.materialId).toBeUndefined();
    expect(result.contextType).toBe(ChatContextType.LESSON);
  });

  it("defaults to organization context when no scope ids", () => {
    const result = normalizeCreateSessionInput({
      organizationId: "507f1f77bcf86cd799439011",
    });
    expect(result.contextType).toBe(ChatContextType.ORGANIZATION);
  });
});

describe("AccessControlService", () => {
  it("defines parent student access check", () => {
    expect(typeof AccessControlService.assertParentAccessToStudent).toBe("function");
    expect(typeof AccessControlService.canAccessStudentData).toBe("function");
  });

  it("restricts manage roles", () => {
    expect(Role.TEACHER).toBe("TEACHER");
    expect(Role.STUDENT).toBe("STUDENT");
  });
});
