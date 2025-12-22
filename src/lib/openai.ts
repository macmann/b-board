import OpenAI from "openai";

let cachedOpenAIClient: OpenAI | null = null;

function getOpenAIClient() {
  if (cachedOpenAIClient) return cachedOpenAIClient;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  cachedOpenAIClient = new OpenAI({
    apiKey,
  });

  return cachedOpenAIClient;
}

export default getOpenAIClient;
export { getOpenAIClient };
