import type { SearchHit } from "../types";

const SYSTEM_PROMPT = `You answer questions about medical documents for someone reviewing the uploaded source files.

Rules:
- Use only the numbered sources in the user message.
- Cite every factual statement with the source number, like [1].
- If the sources do not contain the answer, say that the uploaded documents do not state it.
- Do not invent doses, diagnoses, thresholds, or recommendations.
- This is document question-answering, not medical advice.`;

export function buildMessages(question: string, hits: SearchHit[]): { role: "system" | "user"; content: string }[] {
  const sources = hits
    .map((hit, index) => `[${index + 1}] ${hit.documentName}${pageLabel(hit.pageStart, hit.pageEnd)}\n${hit.content}`)
    .join("\n\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Sources:\n${sources}\n\nQuestion: ${question}`,
    },
  ];
}

function pageLabel(start: number | null, end: number | null): string {
  if (start == null) return "";
  if (end == null || end === start) return `, page ${start}`;
  return `, pages ${start}-${end}`;
}
