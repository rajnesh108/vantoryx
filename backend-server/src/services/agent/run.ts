import { DOCUMENT_CATEGORIES } from "../../categories";
import { config } from "../../config";
import type { AgentTrace, SearchHit } from "../../types";
import { completeChat } from "../llm";
import { rerankHits, searchQueries } from "../retrieval";
import { describeTools } from "../mcp/catalog";
import { callConnectedTool, listConnectedTools } from "../mcp/session";
import { parseGrade, parsePlan, parseRewrite, parseRoute, parseToolChoice } from "./decisions";
import { compileRetrievalGraph, toTrace, type AgentDeps, type RetrievalSnapshot } from "./graph";

const CATEGORY_LABELS: Record<string, string> = {
  who: "World Health Organization",
  mohfw: "Ministry of Health and Family Welfare",
  aiims: "AIIMS",
  icmr: "Indian Council of Medical Research",
  cdc: "CDC",
  nice: "NICE",
  other: "other publishers",
};

export interface AgentRequest {
  question: string;
  documentIds: string[];
  categories: string[];
}

const mcpActive = config.mcp.enabled && config.mcp.maxCalls > 0 && config.mcp.servers.length > 0;

export const retrievalAgentDeps: AgentDeps = {
  maxQueries: config.agentMaxQueries,
  maxRetries: config.agentMaxRetries,
  plan: async (question) => {
    const text = await completeChat(
      [
        {
          role: "system",
          content: `You plan searches over a medical document index. Return JSON only, with this shape: {"queries":["..."],"reason":"..."}.
Write 1 to ${config.agentMaxQueries} short search queries that would find passages answering the user.
Use one query when the question asks for a single fact.
Split independent parts, such as two organizations or two conditions, into separate queries.
Do not answer the question. Do not invent clinical facts.`,
        },
        { role: "user", content: question },
      ],
      0
    );
    return parsePlan(text.text, question, config.agentMaxQueries);
  },
  route: async (question, allowed) => {
    const catalog = allowed.map((category) => `${category} (${CATEGORY_LABELS[category] ?? category})`).join(", ");
    const text = await completeChat(
      [
        {
          role: "system",
          content: `You choose which document collections to search. Return JSON only, with this shape: {"categories":["..."],"reason":"..."}.
Allowed categories: ${catalog}.
Return only categories from that list.
If the question names an organization, keep the matching categories.
If it does not name one, return every allowed category.`,
        },
        { role: "user", content: question },
      ],
      0
    );
    return parseRoute(text.text, allowed);
  },
  search: (queries, scope) => searchQueries(queries, scope),
  rerank: (question, hits) => rerankHits(question, hits),
  grade: async (question, hits) => {
    const sources = hits
      .map((hit, index) => `[${index + 1}] ${excerpt(hit)}`)
      .join("\n\n");
    const toolLine = hits.some((hit) => hit.category === "tool")
      ? " A tool result is evidence for that calculation. It is not a diagnosis or a treatment recommendation."
      : "";
    const text = await completeChat(
      [
        {
          role: "system",
          content: `You check whether retrieved medical passages are enough to answer a question. Return JSON only, with this shape: {"sufficient":true,"reason":"..."}.
Set sufficient to true only when the passages state the facts the question asks for.
Set sufficient to false when they are off topic, empty of the asked fact, or missing a part of a comparison.
Do not use outside knowledge. If you are unsure, set sufficient to false.${toolLine}`,
        },
        { role: "user", content: `Question: ${question}\n\nPassages:\n${sources}` },
      ],
      0
    );
    return parseGrade(text.text);
  },
  rewrite: async (question, queries, gradeReason) => {
    const text = await completeChat(
      [
        {
          role: "system",
          content: `You rewrite a search query for a medical document index. Return JSON only, with this shape: {"query":"..."}.
Use the grade note to add the missing terms.
Keep drug names, doses, and codes that the user wrote.
Do not answer the question. Do not invent clinical facts.`,
        },
        {
          role: "user",
          content: `Question: ${question}\nEarlier searches: ${queries.join("; ")}\nGrade: ${gradeReason}`,
        },
      ],
      0
    );
    return parseRewrite(text.text);
  },
  maxToolCalls: mcpActive ? config.mcp.maxCalls : 0,
  tools: mcpActive
    ? {
        list: () => listConnectedTools(),
        choose: async (question, tools, gradeReason) => {
          try {
            const text = await completeChat(
              [
                {
                  role: "system",
                  content: `You choose at most one configured tool. Return JSON only, with this shape: {"call":false,"reason":"..."} or {"call":true,"server":"...","name":"...","arguments":{},"reason":"..."}.
Call a tool only when it can compute a number the question asks for.
Use only numbers written in the question. Do not guess missing numbers.
Do not answer the question. Do not invent clinical facts.
If none of the tools apply, set call to false.
Tools:
${describeTools(tools)}`,
                },
                {
                  role: "user",
                  content: `Question: ${question}\nGrade: ${gradeReason || "The passages do not cover the question."}`,
                },
              ],
              0
            );
            return parseToolChoice(text.text, tools);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Tool choice failed";
            console.error(`[agent] tool choice failed: ${message}`);
            return { call: null, reason: "The tool choice could not be read." };
          }
        },
        call: (choice) => callConnectedTool(choice),
      }
    : null,
};

const graph = compileRetrievalGraph(retrievalAgentDeps);

export async function runAgenticRetrieval(input: AgentRequest): Promise<{ citations: SearchHit[]; agent: AgentTrace }> {
  const allowed = input.categories.length > 0 ? input.categories : [...DOCUMENT_CATEGORIES];
  const state = (await graph.invoke({
    question: input.question,
    documentIds: input.documentIds,
    requestedCategories: input.categories,
    allowedCategories: allowed,
  })) as RetrievalSnapshot;
  return { citations: state.citations, agent: toTrace(state) };
}

function excerpt(hit: SearchHit): string {
  const text = hit.content.replace(/\s+/g, " ").trim();
  return text.length <= 500 ? text : `${text.slice(0, 497)}...`;
}
