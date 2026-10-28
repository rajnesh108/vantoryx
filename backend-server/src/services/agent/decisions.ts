import { z } from "zod";
import type { ToolCall, ToolCatalogEntry } from "../mcp/catalog";
import type { SearchHit } from "../../types";

const QUERY_LIMIT = 300;

const planSchema = z.object({
  queries: z.array(z.string()).optional().default([]),
  reason: z.string().optional(),
});

const routeSchema = z.object({
  categories: z.array(z.string()).optional().default([]),
  reason: z.string().optional(),
});

const gradeSchema = z.object({
  sufficient: z.boolean(),
  reason: z.string().optional(),
});

const rewriteSchema = z.object({
  query: z.string(),
});

const toolChoiceSchema = z.object({
  call: z.boolean(),
  server: z.string().optional(),
  name: z.string().optional(),
  tool: z.string().optional(),
  arguments: z.union([z.record(z.unknown()), z.string()]).optional(),
  reason: z.string().optional(),
});

export function readJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model response did not contain a JSON object");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

export function normalizeQueries(raw: string[], fallback: string, limit: number): string[] {
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const item of raw) {
    const query = item.replace(/\s+/g, " ").trim().slice(0, QUERY_LIMIT);
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    queries.push(query);
    if (queries.length >= limit) break;
  }
  if (queries.length > 0) return queries;
  const backup = fallback.replace(/\s+/g, " ").trim().slice(0, QUERY_LIMIT);
  return backup ? [backup] : [];
}

export function selectCategories(raw: string[], allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  const picked: string[] = [];
  for (const item of raw) {
    const category = item.trim().toLowerCase();
    if (!allowedSet.has(category) || picked.includes(category)) continue;
    picked.push(category);
  }
  return picked.length > 0 ? picked : [...allowed];
}

export function retrievalScope(
  documentIds: string[],
  requestedCategories: string[],
  allowedCategories: string[],
  routedCategories: string[]
): { documentIds: string[]; categories: string[] } {
  const narrowed = routedCategories.length > 0 && routedCategories.length < allowedCategories.length;
  const categories = requestedCategories.length > 0 || narrowed ? routedCategories : [];
  return { documentIds, categories };
}

export function shouldRewrite(sufficient: boolean, attempts: number, maxRetries: number): boolean {
  return !sufficient && attempts <= maxRetries;
}

export function isRepeatedQuery(query: string, previous: string[]): boolean {
  const key = query.trim().toLowerCase();
  if (!key) return true;
  return previous.some((item) => item.trim().toLowerCase() === key);
}

export function preferIncoming(existing: SearchHit[], incoming: SearchHit[], limit = Number.POSITIVE_INFINITY): SearchHit[] {
  const seen = new Set<string>();
  const ordered: SearchHit[] = [];
  for (const hit of [...incoming, ...existing]) {
    if (seen.has(hit.chunkId)) continue;
    seen.add(hit.chunkId);
    ordered.push(hit);
    if (ordered.length >= limit) break;
  }
  return ordered;
}

export function brief(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

export function parsePlan(text: string, question: string, limit: number): { queries: string[]; reason: string } {
  const parsed = planSchema.parse(readJsonObject(text));
  return {
    queries: normalizeQueries(parsed.queries, question, limit),
    reason: brief(parsed.reason || "Search the question as written."),
  };
}

export function parseRoute(text: string, allowed: string[]): { categories: string[]; reason: string } {
  const parsed = routeSchema.parse(readJsonObject(text));
  return {
    categories: selectCategories(parsed.categories, allowed),
    reason: brief(parsed.reason || "Search every allowed collection."),
  };
}

export function parseGrade(text: string): { sufficient: boolean; reason: string } {
  const parsed = gradeSchema.parse(readJsonObject(text));
  return {
    sufficient: parsed.sufficient,
    reason: brief(parsed.reason || (parsed.sufficient ? "The passages cover the question." : "The passages do not cover the question.")),
  };
}

export function parseRewrite(text: string): { query: string } {
  const parsed = rewriteSchema.parse(readJsonObject(text));
  const [query] = normalizeQueries([parsed.query], "", 1);
  if (!query) throw new Error("Model response did not contain a search query");
  return { query };
}

export function questionMayNeedTool(question: string): boolean {
  const text = question.toLowerCase();
  if (!/\d/.test(text)) return false;
  if (/\bbmi\b|body mass index/.test(text)) return true;
  if (/\b(?:kg|kilograms?)\b/.test(text) && /\b(?:cm|centimet(?:er|re)s?|meters?|metres?)\b/.test(text)) return true;
  if (/mmol|mg\/dl/.test(text)) return true;
  if (/celsius|fahrenheit|degrees?\s*[cf]\b|°\s*[cf]\b/.test(text)) return true;
  return false;
}

export function parseToolChoice(text: string, catalog: ToolCatalogEntry[]): { call: ToolCall | null; reason: string } {
  const parsed = toolChoiceSchema.parse(readJsonObject(text));
  const reason = brief(parsed.reason || "");
  if (!parsed.call) return { call: null, reason: reason || "No configured tool applies." };
  const named = namedTool(parsed);
  const known = named !== null && catalog.some((tool) => tool.server === named.server && tool.name === named.name);
  if (!named || !known) return { call: null, reason: "The model named a tool that is not connected." };
  const args = toolArguments(parsed.arguments);
  if (!args) return { call: null, reason: "The tool arguments could not be read." };
  return {
    call: { server: named.server, name: named.name, arguments: args, reason: reason || "The tool can compute the requested number." },
    reason,
  };
}

export function appendCitation(existing: SearchHit[], hit: SearchHit): SearchHit[] {
  if (existing.some((item) => item.chunkId === hit.chunkId)) return existing;
  return [...existing, hit];
}

function namedTool(parsed: { server?: string; name?: string; tool?: string }): { server: string; name: string } | null {
  const server = parsed.server?.trim();
  const name = parsed.name?.trim();
  if (server && name) return { server, name };
  const combined = parsed.tool?.trim();
  if (!combined) return null;
  const slash = combined.indexOf("/");
  if (slash <= 0 || slash === combined.length - 1) return null;
  return { server: combined.slice(0, slash).trim(), name: combined.slice(slash + 1).trim() };
}

function toolArguments(value: Record<string, unknown> | string | undefined): Record<string, unknown> | null {
  let record = value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!isPlainRecord(parsed)) return null;
      record = parsed;
    } catch {
      return null;
    }
  }
  if (record === undefined) return {};
  if (!isPlainRecord(record)) return null;
  let encoded: string;
  try {
    encoded = JSON.stringify(record);
  } catch {
    return null;
  }
  if (encoded.length > 4000) return null;
  const parsed = JSON.parse(encoded) as unknown;
  if (!isPlainRecord(parsed) || Object.keys(parsed).length > 20) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    clean[key] = item;
  }
  return clean;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
