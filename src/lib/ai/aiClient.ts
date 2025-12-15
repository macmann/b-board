import OpenAI from "openai";

const REQUEST_TIMEOUT_MS = 20000;
const MAX_PROMPT_CHARS = 20000;
const MAX_RESPONSE_CHARS = 50000;
const RESPONSE_SNIPPET_LENGTH = 200;

const defaultModel = process.env.AI_MODEL_DEFAULT;

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
});

export type ChatJsonArgs = {
  model?: string | null;
  temperature?: number | null;
  system?: string;
  user: string;
  timeoutMs?: number;
};

function truncateToLength(value: string | undefined | null, maxLength: number) {
  if (!value) return value ?? undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function enforcePromptSize(system?: string, user?: string) {
  const safeSystem = truncateToLength(system, MAX_PROMPT_CHARS);
  const remaining = MAX_PROMPT_CHARS - (safeSystem?.length ?? 0);
  const safeUser = truncateToLength(user, Math.max(remaining, 0));

  return {
    system: safeSystem,
    user: safeUser ?? "",
  };
}

function parseJsonSafely<T>(rawContent: string): T {
  const trimmed = rawContent.trim();

  if (!trimmed) {
    throw new Error("AI response was empty");
  }

  const contentToParse = extractFirstJsonObject(trimmed);

  try {
    return JSON.parse(contentToParse) as T;
  } catch (error) {
    const snippet = contentToParse.slice(0, RESPONSE_SNIPPET_LENGTH);
    throw new Error(`Failed to parse AI response as JSON. Received: ${snippet}`);
  }
}

export function extractFirstJsonObject(text: string): string {
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue to best-effort extraction
  }

  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("AI response did not include JSON content");
  }

  let depth = 0;
  for (let i = firstBrace; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return trimmed.slice(firstBrace, i + 1);
    }
  }

  throw new Error("AI response contained incomplete JSON");
}

export async function chatJson(args: ChatJsonArgs): Promise<unknown>;
export async function chatJson<T>(args: ChatJsonArgs): Promise<T>;
export async function chatJson<T = unknown>({
  model,
  temperature,
  system,
  user,
  timeoutMs,
}: ChatJsonArgs): Promise<T> {
  const { system: safeSystem, user: safeUser } = enforcePromptSize(system, user);

  const modelToUse = model ?? defaultModel;
  if (!modelToUse) {
    throw new Error("No AI model configured");
  }

  const controller = new AbortController();
  const requestTimeout = timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

  try {
    const baseMessages = [
      { role: "system" as const, content: "Return ONLY valid JSON. No markdown." },
      ...(safeSystem ? [{ role: "system" as const, content: safeSystem }] : []),
      { role: "user" as const, content: safeUser },
    ];

    const params: Parameters<typeof openai.chat.completions.create>[0] = {
      model: modelToUse,
      temperature: temperature ?? undefined,
      messages: baseMessages,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error The installed OpenAI SDK may or may not support response_format
      response_format: { type: "json_object" },
    };

    const completion = await openai.chat.completions.create(params, {
      signal: controller.signal,
      timeout: requestTimeout,
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("AI response did not contain text content");
    }

    if (content.length > MAX_RESPONSE_CHARS) {
      throw new Error("AI response too large to parse");
    }

    return parseJsonSafely<T>(content);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out");
    }

    throw error as Error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function chatText(args: ChatJsonArgs): Promise<string> {
  const result = await chatJson<{ result: string }>(args);
  if (typeof result === "string") return result;
  if (typeof (result as { result?: string }).result === "string") {
    return (result as { result: string }).result;
  }
  throw new Error("AI response was not text");
}
