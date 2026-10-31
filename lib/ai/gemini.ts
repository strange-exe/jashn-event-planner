import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Server-only: imported by API routes, never by client components, so the key
// never reaches the browser.

export const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const TIMEOUT_MS = 20_000;

export class AiUnavailableError extends Error {}

/** The one SDK method we use, so tests can pass a fake. */
export interface GenerateClient {
  models: {
    generateContent(req: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }): Promise<{ text?: string }>;
  };
}

let cached: GenerateClient | null = null;

function defaultClient(): GenerateClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiUnavailableError("GEMINI_API_KEY is not set");
  cached ??= new GoogleGenAI({ apiKey });
  return cached;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function models(): string[] {
  const fromEnv = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_MODELS;
}

/**
 * Asks Gemini for JSON matching `schema` and validates the answer. Tries each
 * model in turn on overload or bad output; auth and request errors stop early
 * because another model would fail the same way.
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  client: GenerateClient = defaultClient(),
): Promise<{ data: T; model: string }> {
  const jsonSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  let lastError: unknown;
  for (const model of models()) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          temperature: 0.7,
          maxOutputTokens: 4096,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      const parsed = schema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) return { data: parsed.data, model };
      lastError = new Error(`Invalid model output: ${z.prettifyError(parsed.error)}`);
    } catch (e) {
      lastError = e;
      if (e instanceof ApiError && [400, 401, 403].includes(e.status)) break;
    }
  }
  throw new AiUnavailableError(lastError instanceof Error ? lastError.message : "Model unavailable");
}
