import path from "path";

const SERVER_NAME = /^[a-z][a-z0-9_-]{0,40}$/;

export interface McpStdioServer {
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  cwd: string;
}

export interface McpHttpServer {
  name: string;
  transport: "http";
  url: string;
  headers: Record<string, string>;
}

export type McpServerConfig = McpStdioServer | McpHttpServer;

export function bundledCalculatorServer(backendDir: string): McpStdioServer {
  return {
    name: "calculators",
    transport: "stdio",
    command: process.execPath,
    args: [
      path.join(backendDir, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(backendDir, "src", "mcp", "calculators.ts"),
    ],
    cwd: backendDir,
  };
}

export function parseMcpServers(
  raw: string | undefined,
  options: { cwd: string; fallback: McpServerConfig[] }
): McpServerConfig[] {
  if (raw === undefined || raw.trim() === "") return options.fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("MCP_SERVERS must be a JSON array");
  }
  if (!Array.isArray(parsed)) throw new Error("MCP_SERVERS must be a JSON array");
  if (parsed.length > 8) throw new Error("MCP_SERVERS accepts at most 8 servers");
  const names = new Set<string>();
  return parsed.map((item, index) => parseServer(item, index, names, options.cwd));
}

function parseServer(item: unknown, index: number, names: Set<string>, cwd: string): McpServerConfig {
  const label = `MCP_SERVERS[${index}]`;
  if (!isRecord(item)) throw new Error(`${label} must be an object`);
  const name = requiredString(item.name, `${label}.name`);
  if (!SERVER_NAME.test(name)) {
    throw new Error(`${label}.name must be lowercase letters, numbers, hyphens, or underscores`);
  }
  if (names.has(name)) throw new Error(`${label}.name duplicates ${name}`);
  names.add(name);
  const transport = requiredString(item.transport, `${label}.transport`);
  if (transport === "stdio") return parseStdio(item, label, name, cwd);
  if (transport === "http") return parseHttp(item, label, name);
  throw new Error(`${label}.transport must be stdio or http`);
}

function parseStdio(item: Record<string, unknown>, label: string, name: string, defaultCwd: string): McpStdioServer {
  const command = requiredString(item.command, `${label}.command`);
  if (command.length > 300) throw new Error(`${label}.command is too long`);
  const args = stringList(item.args, `${label}.args`, 20, 500);
  const cwdValue = item.cwd === undefined ? defaultCwd : requiredString(item.cwd, `${label}.cwd`);
  return { name, transport: "stdio", command, args, cwd: path.resolve(cwdValue) };
}

function parseHttp(item: Record<string, unknown>, label: string, name: string): McpHttpServer {
  const urlText = requiredString(item.url, `${label}.url`);
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error(`${label}.url must be an http or https URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label}.url must start with http:// or https://`);
  }
  if (url.username || url.password) {
    throw new Error(`${label}.url must not include a username or password. Put the credential in headers.`);
  }
  return { name, transport: "http", url: url.toString(), headers: parseHeaders(item.headers, `${label}.headers`) };
}

function parseHeaders(value: unknown, label: string): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const entries = Object.entries(value);
  if (entries.length > 8) throw new Error(`${label} accepts at most 8 headers`);
  const headers: Record<string, string> = {};
  for (const [key, header] of entries) {
    if (!/^[A-Za-z0-9-]+$/.test(key)) throw new Error(`${label} has an invalid header name`);
    if (typeof header !== "string" || header.trim() === "" || header.length > 500 || /[\r\n]/.test(header)) {
      throw new Error(`${label}.${key} must be a single-line string`);
    }
    headers[key] = header;
  }
  return headers;
}

function stringList(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings`);
  if (value.length > maxItems) throw new Error(`${label} accepts at most ${maxItems} items`);
  return value.map((item, index) => {
    const text = requiredString(item, `${label}[${index}]`);
    if (text.length > maxLength) throw new Error(`${label}[${index}] is too long`);
    return text;
  });
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const text = value.trim();
  if (!text || /[\r\n\0]/.test(value)) throw new Error(`${label} must be a single-line string`);
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
