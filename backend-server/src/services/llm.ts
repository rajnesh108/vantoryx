import { z } from "zod";
import { config } from "../config";
import { buildMessages } from "./prompt";
import type { SearchHit } from "../types";

const completionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable().optional(),
      }),
    })
  ),
  model: z.string().optional(),
});

export async function generateAnswer(
  question: string,
  hits: SearchHit[]
): Promise<{ text: string; model: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.llm.apiKey) {
    headers.Authorization = `Bearer ${config.llm.apiKey}`;
  }

  const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.llm.model,
      temperature: 0.1,
      messages: buildMessages(question, hits),
    }),
    signal: AbortSignal.timeout(config.llm.timeoutMs),
  });

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : text || response.statusText;
    throw new Error(detail || "Language model request failed");
  }

  const parsed = completionSchema.parse(body);
  const answer = parsed.choices[0]?.message.content?.trim();
  if (!answer) {
    throw new Error("Language model returned an empty answer");
  }
  return { text: answer, model: parsed.model || config.llm.model };
}
