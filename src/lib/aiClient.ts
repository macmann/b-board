import OpenAI from "openai";

const REQUEST_TIMEOUT_MS = 20000;
const MAX_PROMPT_CHARS = 20000;
const MAX_RESPONSE_CHARS = 50000;

const defaultModel = process.env.AI_MODEL_DEFAULT;

const aiClient = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
});

type ChatJsonParams = {
  model?: string | null;
  system?: string;
  user: string;
  temperature?: number | null;
};

const ensurePromptSize = (system?: string, user?: string) => {
  const totalLength = (system?.length ?? 0) + (user?.length ?? 0);

  if (totalLength > MAX_PROMPT_CHARS) {
    throw new Error("AI prompt too large to process");
  }
};

export async function chatJson<T = unknown>({
  model,
  system,
  user,
  temperature,
}: ChatJsonParams): Promise<T> {
  ensurePromptSize(system, user);

  const modelToUse = model ?? defaultModel;

  if (!modelToUse) {
    throw new Error("No AI model configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const completion = await aiClient.chat.completions.create(
      {
        model: modelToUse,
        temperature: temperature ?? undefined,
        messages: [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          { role: "user" as const, content: user },
        ],
      },
      { signal: controller.signal, timeout: REQUEST_TIMEOUT_MS }
    );

    const content = completion.choices?.[0]?.message?.content ?? "";

    if (!content || typeof content !== "string") {
      throw new Error("AI response did not contain text content");
    }

    if (content.length > MAX_RESPONSE_CHARS) {
      throw new Error("AI response too large to parse");
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error("Failed to parse AI response as JSON");
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out");
    }

    throw error as Error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default aiClient;
