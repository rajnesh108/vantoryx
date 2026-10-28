import type { SearchHit } from "../types";
import { generateAnswer } from "./llm";

export type AnswerOutcome = "answered" | "not_found" | "insufficient_evidence";

export function decideOutcome(citationCount: number, sufficient: boolean | null): AnswerOutcome {
  if (citationCount === 0) return "not_found";
  if (sufficient === false) return "insufficient_evidence";
  return "answered";
}

export function abstainAnswer(outcome: Exclude<AnswerOutcome, "answered">, categoryCount: number): string {
  if (outcome === "not_found") {
    const scope = categoryCount > 0 ? " in the selected categories" : "";
    return `No indexed passages${scope} matched this question. A ready document in that scope is required before search can return passages.`;
  }
  return "The retrieved passages do not state enough to answer this question, so no answer was generated. The citations below are the closest matching text.";
}

export async function answerFromCitations(
  question: string,
  citations: SearchHit[]
): Promise<{ text: string; model: string | null }> {
  try {
    const generated = await generateAnswer(question, citations);
    return { text: generated.text, model: generated.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Language model request failed";
    const plural = citations.length === 1 ? "" : "s";
    return {
      text: `Retrieved ${citations.length} relevant passage${plural}, but the language model could not be reached (${message}). The citations below are the closest matching text. Check LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY.`,
      model: null,
    };
  }
}
