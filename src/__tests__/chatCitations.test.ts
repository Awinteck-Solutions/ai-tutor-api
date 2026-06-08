import { toChatMessageResponse } from "../Features/chat/dto/chat.dto";
import { ChatMessageRole } from "../shared/enums/chat.enum";

describe("toChatMessageResponse citations", () => {
  it("maps sources to citations with materialName and page", () => {
    const message = {
      _id: { toString: () => "msg1" },
      sessionId: { toString: () => "sess1" },
      role: ChatMessageRole.ASSISTANT,
      content: "Photosynthesis uses sunlight.",
      sources: [
        {
          materialId: "mat1",
          materialName: "Biology PDF",
          chunkIndex: 3,
          page: 2,
          score: 0.92,
          preview: "Plants convert light...",
        },
      ],
      createdAt: new Date(),
    };

    const response = toChatMessageResponse(message as never);
    expect(response.answer).toBe("Photosynthesis uses sunlight.");
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]).toMatchObject({
      materialId: "mat1",
      materialName: "Biology PDF",
      page: 2,
    });
  });
});
