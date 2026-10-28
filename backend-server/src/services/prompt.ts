import type { SearchHit } from "../types";

const SYSTEM_PROMPT = `You answer questions about medical documents for someone reviewing the uploaded source files.

Rules:
- Use only the numbered sources in the user message.
- Cite every factual statement with the source number, like [1].
- If the sources do not contain the answer, say that the uploaded documents do not state it.
- Do not invent doses, diagnoses, thresholds, or recommendations.
- This is document question-answering, not medical advice.`;

const SYSTEM_PROMPT_WITH_TOOLS = `You answer questions using the numbered sources. A source marked as a tool result is a calculation from a configured tool.

Rules:
- Use only the numbered sources in the user message.
- Cite every factual statement with the source number, like [1].
- If the sources do not contain the answer, say that the available sources do not state it.
- Do not invent doses, diagnoses, thresholds, or recommendations.
- Do not treat a tool result as a diagnosis or a treatment recommendation.
- This is document question-answering, not medical advice.`;

export function buildMessages(question: string, hits: SearchHit[]): { role: "system" | "user"; content: string }[] {
  const hasTool = hits.some((hit) => hit.category === "tool");
  const sources = hits
    .map((hit, index) => `[${index + 1}] ${sourceHeading(hit)}\n${hit.content}`)
    .join("\n\n");

  return [
    { role: "system", content: hasTool ? SYSTEM_PROMPT_WITH_TOOLS : SYSTEM_PROMPT },
    {
      role: "user",
      content: `Sources:\n${sources}\n\nQuestion: ${question}`,
    },
  ];
}

function sourceHeading(hit: SearchHit): string {
  if (hit.category === "tool") return `${hit.documentName} (tool result)`;
  return `${hit.documentName}${pageLabel(hit.pageStart, hit.pageEnd)}`;
}

function pageLabel(start: number | null, end: number | null): string {
  if (start == null) return "";
  if (end == null || end === start) return `, page ${start}`;
  return `, pages ${start}-${end}`;
}
