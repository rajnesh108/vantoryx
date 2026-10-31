import { AsyncLocalStorage } from "node:async_hooks";
import { completeOpenAiChat, type ChatMessage } from "./chatProvider";
import { activeChatTarget } from "./llmChoice";
import { buildMessages } from "./prompt";
import type { SearchHit } from "../types";

export interface LlmUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
}

const usageStore = new AsyncLocalStorage<LlmUsage>();

export function emptyUsage(): LlmUsage {
  return { calls: 0, promptTokens: 0, completionTokens: 0, estimated: false };
}

export async function trackLlmUsage<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; result: T; usage: LlmUsage } | { ok: false; error: string; usage: LlmUsage }> {
  try {
    const measured = await withLlmUsage(fn);
    return { ok: true, result: measured.result, usage: measured.usage };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Language model request failed",
      usage: usageFromError(error),
    };
  }
}

const usageKey = Symbol("llmUsage");

export async function withLlmUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: LlmUsage }> {
  const usage = emptyUsage();
  try {
    const result = await usageStore.run(usage, fn);
    return { result, usage };
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      Object.defineProperty(error, usageKey, { value: usage, enumerable: false });
    }
    throw error;
  }
}

export function usageFromError(error: unknown): LlmUsage {
  if (typeof error === "object" && error !== null && usageKey in error) {
    const usage = (error as { [usageKey]?: LlmUsage })[usageKey];
    if (usage) return usage;
  }
  return emptyUsage();
}

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export async function generateAnswer(
  question: string,
  hits: SearchHit[]
): Promise<{ text: string; model: string }> {
  return completeChat(buildMessages(question, hits), 0.1);
}

export async function completeChat(
  messages: ChatMessage[],
  temperature: number
): Promise<{ text: string; model: string }> {
  const promptText = messages.map((message) => message.content).join("\n");
  let completionText = "";
  let reported: { prompt?: number | null; completion?: number | null } | undefined;
  try {
    const target = activeChatTarget();
    const completion = await completeOpenAiChat({
      baseUrl: target.baseUrl,
      apiKey: target.apiKey,
      model: target.model,
      messages,
      temperature,
      timeoutMs: target.timeoutMs,
    });
    reported = { prompt: completion.promptTokens, completion: completion.completionTokens };
    completionText = completion.text;
    if (!completion.text) {
      throw new Error("Language model returned an empty answer");
    }
    return { text: completion.text, model: completion.model };
  } finally {
    rememberUsage(promptText, completionText, reported);
  }
}

function rememberUsage(
  promptText: string,
  completionText: string,
  reported: { prompt?: number | null; completion?: number | null } | undefined
): void {
  const current = usageStore.getStore();
  if (!current) return;
  current.calls += 1;
  if (reported?.prompt != null && reported.completion != null) {
    current.promptTokens += reported.prompt;
    current.completionTokens += reported.completion;
    return;
  }
  current.estimated = true;
  current.promptTokens += estimateTokens(promptText);
  current.completionTokens += estimateTokens(completionText);
}
