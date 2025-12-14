import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    __esModule: true,
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };

      constructor() {}
    },
  };
});

describe("chatJson", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.AI_MODEL_DEFAULT = "gpt-default";
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"result":true}',
          },
        },
      ],
    });
  });

  it("parses JSON content from AI responses", async () => {
    const { chatJson } = await import("../aiClient");

    const result = await chatJson<{ result: boolean }>({
      user: "Provide a JSON response",
      system: "Return JSON",
      temperature: 0.5,
    });

    expect(result).toEqual({ result: true });
    expect(mockCreate).toHaveBeenCalledWith(
      {
        model: "gpt-default",
        temperature: 0.5,
        messages: [
          { role: "system", content: "Return JSON" },
          { role: "user", content: "Provide a JSON response" },
        ],
      },
      expect.objectContaining({ signal: expect.any(Object), timeout: expect.any(Number) })
    );
  });

  it("throws when the AI response is not valid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "not-json",
          },
        },
      ],
    });

    const { chatJson } = await import("../aiClient");

    await expect(
      chatJson({
        user: "Return JSON",
      })
    ).rejects.toThrow(/parse/i);
  });
});
