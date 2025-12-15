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
      expect.objectContaining({
        model: "gpt-default",
        temperature: 0.5,
        messages: [
          { role: "system", content: "Return ONLY valid JSON. No markdown." },
          { role: "system", content: "Return JSON" },
          { role: "user", content: "Provide a JSON response" },
        ],
        response_format: { type: "json_object" },
      }),
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
    ).rejects.toThrow(/JSON/);
  });

  it("defaults to the latest lightweight model when none is configured", async () => {
    delete process.env.AI_MODEL_DEFAULT;
    const { chatJson } = await import("../aiClient");

    await chatJson({
      user: "Provide a JSON response",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" }),
      expect.anything()
    );
  });
});

describe("extractFirstJsonObject", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the JSON when the response is already valid JSON", async () => {
    const { extractFirstJsonObject } = await import("../aiClient");

    expect(extractFirstJsonObject('{"foo":1}')).toEqual('{"foo":1}');
  });

  it("extracts the first JSON object from surrounding text", async () => {
    const { extractFirstJsonObject } = await import("../aiClient");

    expect(
      extractFirstJsonObject("Sure, here is the JSON: {\"foo\":1,\"bar\":[2,3]}. Anything else?")
    ).toEqual('{"foo":1,"bar":[2,3]}');
  });

  it("throws when no JSON object can be parsed", async () => {
    const { extractFirstJsonObject } = await import("../aiClient");

    expect(() => extractFirstJsonObject("No JSON here")).toThrow(/JSON/);
  });
});
