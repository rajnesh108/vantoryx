import { z } from "zod";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ProviderCompletion {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

const completionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable().optional(),
      }),
    })
  ),
  model: z.string().optional(),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
    })
    .nullish(),
});

export async function completeOpenAiChat(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<ProviderCompletion> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(`${input.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      messages: input.messages,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
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
  return {
    text: parsed.choices[0]?.message.content?.trim() ?? "",
    model: parsed.model || input.model,
    promptTokens: parsed.usage?.prompt_tokens ?? null,
    completionTokens: parsed.usage?.completion_tokens ?? null,
  };
}
