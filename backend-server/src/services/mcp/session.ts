import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { config } from "../../config";
import type { ToolCall, ToolCatalogEntry } from "./catalog";
import type { McpServerConfig } from "./servers";

const RETRY_AFTER_MS = 30_000;

export class ToolResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolResultError";
  }
}

interface LiveServer {
  name: string;
  client: Client;
  tools: ToolCatalogEntry[];
}

export interface McpSession {
  tools: ToolCatalogEntry[];
  call(choice: ToolCall): Promise<string>;
  close(): Promise<void>;
}

let session: McpSession | null = null;
let opening: Promise<McpSession> | null = null;
let failure: { at: number; message: string } | null = null;

export async function openMcpSession(servers: McpServerConfig[], timeoutMs: number): Promise<McpSession> {
  if (servers.length === 0) throw new Error("No MCP servers are configured");
  const live: LiveServer[] = [];
  const errors: string[] = [];
  for (const server of servers) {
    try {
      live.push(await connectServer(server, timeoutMs));
    } catch (error) {
      errors.push(`${server.name}: ${error instanceof Error ? error.message : "connection failed"}`);
    }
  }
  if (live.length === 0) throw new Error(errors.join("; ") || "MCP connection failed");
  if (errors.length > 0) console.error(`[mcp] skipped ${errors.join("; ")}`);
  const tools = live.flatMap((item) => item.tools);
  return {
    tools,
    call: (choice) => callLive(live, choice, timeoutMs),
    close: () => closeLive(live),
  };
}

export async function listConnectedTools(): Promise<{ tools: ToolCatalogEntry[]; error: string | null }> {
  if (!mcpCallsEnabled()) return { tools: [], error: null };
  if (failure && !session && Date.now() - failure.at < RETRY_AFTER_MS) {
    return { tools: [], error: failure.message };
  }
  try {
    const opened = await ensureSession();
    return { tools: opened.tools, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP connection failed";
    failure = { at: Date.now(), message };
    console.error(`[mcp] ${message}`);
    return { tools: [], error: message };
  }
}

export async function callConnectedTool(choice: ToolCall): Promise<string> {
  const current = await ensureSession();
  try {
    return await current.call(choice);
  } catch (error) {
    if (error instanceof ToolResultError) throw error;
    if (session === current) {
      session = null;
      failure = { at: Date.now(), message: error instanceof Error ? error.message : "MCP call failed" };
      await current.close();
    }
    throw error;
  }
}

export async function warmMcp(): Promise<void> {
  const { tools, error } = await listConnectedTools();
  if (error) return;
  const names = tools.map((tool) => `${tool.server}/${tool.name}`).join(", ");
  console.log(`MCP: ${names || "connected, no tools"}`);
}

export async function closeConnectedTools(): Promise<void> {
  const current = session;
  session = null;
  opening = null;
  if (!current) return;
  await Promise.race([current.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
}

async function ensureSession(): Promise<McpSession> {
  if (session) return session;
  if (!opening) {
    opening = openMcpSession(config.mcp.servers, config.mcp.timeoutMs)
      .then((opened) => {
        session = opened;
        failure = null;
        return opened;
      })
      .finally(() => {
        opening = null;
      });
  }
  return opening;
}

function mcpCallsEnabled(): boolean {
  return config.mcp.enabled && config.mcp.maxCalls > 0 && config.mcp.servers.length > 0;
}

async function connectServer(server: McpServerConfig, timeoutMs: number): Promise<LiveServer> {
  const client = new Client({ name: "vantoryx", version: "1.0.0" });
  const transport =
    server.transport === "stdio"
      ? new StdioClientTransport({ command: server.command, args: server.args, cwd: server.cwd })
      : new StreamableHTTPClientTransport(new URL(server.url), {
          requestInit: { headers: server.headers },
        });
  try {
    await client.connect(transport, { signal: AbortSignal.timeout(timeoutMs) });
    const listed = await client.listTools(undefined, { signal: AbortSignal.timeout(timeoutMs) });
    return { name: server.name, client, tools: toCatalog(server.name, listed.tools) };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

function toCatalog(server: string, tools: { name: string; description?: string; inputSchema?: unknown }[]): ToolCatalogEntry[] {
  const seen = new Set<string>();
  const entries: ToolCatalogEntry[] = [];
  for (const tool of tools) {
    const name = tool.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    entries.push({
      server,
      name,
      description: tool.description?.trim() || name,
      inputSchema: tool.inputSchema ?? {},
    });
  }
  return entries;
}

async function callLive(live: LiveServer[], choice: ToolCall, timeoutMs: number): Promise<string> {
  const server = live.find((item) => item.name === choice.server && item.tools.some((tool) => tool.name === choice.name));
  if (!server) throw new ToolResultError("That tool is not connected");
  const result = await server.client.callTool(
    { name: choice.name, arguments: choice.arguments },
    { signal: AbortSignal.timeout(timeoutMs) }
  );
  const text = readToolText(result);
  if (result.isError) throw new ToolResultError(text || "Tool returned an error");
  if (!text) throw new ToolResultError("Tool returned an empty result");
  return text;
}

function readToolText(result: { content?: unknown }): string {
  const blocks = Array.isArray(result.content) ? result.content : [];
  const text = blocks
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as { type?: string; text?: string };
      return record.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .replace(/\u0000/g, "")
    .trim();
  return text.length <= 4000 ? text : `${text.slice(0, 3997)}...`;
}

async function closeLive(live: LiveServer[]): Promise<void> {
  await Promise.all(live.map((item) => item.client.close().catch(() => undefined)));
}
