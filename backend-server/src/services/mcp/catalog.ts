import type { SearchHit } from "../../types";

export interface ToolCatalogEntry {
  server: string;
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface ToolCall {
  server: string;
  name: string;
  arguments: Record<string, unknown>;
  reason: string;
}

export function describeTools(tools: ToolCatalogEntry[]): string {
  const shown = tools.slice(0, 30).map((tool) => {
    const description = tool.description.replace(/\s+/g, " ").trim();
    return `${tool.server}/${tool.name}: ${description} Arguments: ${schemaArguments(tool.inputSchema)}.`;
  });
  if (tools.length > 30) shown.push(`${tools.length - 30} more tools are not listed.`);
  return shown.join("\n");
}

export function toolCitation(choice: ToolCall, text: string, attempt: number): SearchHit {
  const clean = text.replace(/\u0000/g, "").trim();
  const content = clean.length <= 4000 ? clean : `${clean.slice(0, 3997)}...`;
  return {
    chunkId: `tool:${choice.server}:${choice.name}:${attempt}`,
    documentId: "mcp",
    documentName: `${choice.server}/${choice.name}`,
    category: "tool",
    pageStart: null,
    pageEnd: null,
    content,
    score: 1,
  };
}

function schemaArguments(schema: unknown): string {
  if (!schema || typeof schema !== "object") return "none";
  const record = schema as { properties?: Record<string, { type?: string; enum?: unknown[] }>; required?: string[] };
  const properties = record.properties;
  if (!properties) return "none";
  const required = new Set(record.required ?? []);
  const parts = Object.entries(properties).map(([key, value]) => {
    const kind = Array.isArray(value?.enum) ? value.enum.map(String).join("|") : value?.type || "value";
    return `${key}${required.has(key) ? "" : "?"}: ${kind}`;
  });
  return parts.join(", ") || "none";
}
