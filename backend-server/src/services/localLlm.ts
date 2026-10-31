export const LLM_PROVIDERS = ["ollama", "llamacpp", "openai"] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export type LlmFamily = "local" | "cloud";

export type LlmReachability = "ok" | "unavailable" | "model-missing";

export interface LlmProbe {
  provider: LlmProvider;
  label: string;
  model: string;
  baseUrl: string;
  status: LlmReachability;
  models: string[];
  detail: string | null;
}

const PROVIDERS: Record<LlmProvider, { baseUrl: string; label: string; family: LlmFamily }> = {
  ollama: { baseUrl: "http://127.0.0.1:11434/v1", label: "Ollama", family: "local" },
  llamacpp: { baseUrl: "http://127.0.0.1:8081/v1", label: "llama.cpp", family: "local" },
  openai: { baseUrl: "https://api.openai.com/v1", label: "OpenAI", family: "cloud" },
};

export function providerLabel(provider: LlmProvider): string {
  return PROVIDERS[provider].label;
}

export function providerFamily(provider: LlmProvider): LlmFamily {
  return PROVIDERS[provider].family;
}

export function parseProvider(raw: string | undefined): LlmProvider {
  const value = (raw ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (value === "" || value === "ollama") return "ollama";
  if (value === "llamacpp" || value === "llama.cpp" || value === "llama-cpp") return "llamacpp";
  if (value === "openai") return "openai";
  throw new Error("LLM_PROVIDER must be ollama, llamacpp, or openai");
}

export function ggufFileName(ggufPath: string): string {
  const trimmed = ggufPath.trim().replace(/\\/g, "/");
  return trimmed.split("/").pop() ?? "";
}

export function defaultModel(provider: LlmProvider, ggufPath: string): string {
  if (provider === "llamacpp" && ggufPath.trim()) return ggufFileName(ggufPath);
  if (provider === "openai") return "gpt-4o-mini";
  return "llama3.1";
}

export function resolveLlmBaseUrl(provider: LlmProvider, rawUrl: string | undefined): string {
  const trimmed = rawUrl?.trim() ?? "";
  const value = (trimmed || PROVIDERS[provider].baseUrl).replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("LLM_BASE_URL must be an http or https URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("LLM_BASE_URL must be an http or https URL");
  }
  return value;
}

export function ollamaTagsUrl(baseUrl: string): string {
  return `${new URL(baseUrl).origin}/api/tags`;
}

export function modelNamesFromOpenAi(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("data" in body)) return [];
  const data = (body as { data: unknown }).data;
  if (!Array.isArray(data)) return [];
  const names: string[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object" || !("id" in item)) continue;
    const id = (item as { id: unknown }).id;
    if (typeof id !== "string") continue;
    const name = id.trim();
    if (name) names.push(name);
  }
  return names;
}

export function modelNamesFromOllamaTags(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("models" in body)) return [];
  const models = (body as { models: unknown }).models;
  if (!Array.isArray(models)) return [];
  const names: string[] = [];
  for (const item of models) {
    if (!item || typeof item !== "object" || !("name" in item)) continue;
    const name = (item as { name: unknown }).name;
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (trimmed) names.push(trimmed);
  }
  return names;
}

export function modelIsLoaded(configured: string, listed: string[]): boolean {
  const wanted = configured.trim().toLowerCase();
  if (!wanted) return false;
  return listed.some((name) => {
    const value = name.trim().toLowerCase();
    const bare = value.split(":")[0] ?? value;
    return value === wanted || bare === wanted;
  });
}

export async function probeLocalLlm(input: {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<LlmProbe> {
  const base = {
    provider: input.provider,
    label: providerLabel(input.provider),
    model: input.model,
    baseUrl: input.baseUrl,
  };
  try {
    const models = await listedModels(input);
    const shown = models.slice(0, 20);
    if (models.length === 0) {
      return { ...base, status: "model-missing", models: shown, detail: "The server listed no models." };
    }
    if (!modelIsLoaded(input.model, models)) {
      return { ...base, status: "model-missing", models: shown, detail: `Load ${input.model} on ${base.label}.` };
    }
    return { ...base, status: "ok", models: shown, detail: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local model server is unreachable";
    return { ...base, status: "unavailable", models: [], detail: clip(message) };
  }
}

async function listedModels(input: {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  if (input.provider === "ollama") {
    try {
      const openai = modelNamesFromOpenAi(await getJson(input, `${input.baseUrl}/models`));
      if (openai.length > 0) return openai;
    } catch {
      // Ollama's native tag list is the fallback when /v1/models is absent.
    }
    return modelNamesFromOllamaTags(await getJson(input, ollamaTagsUrl(input.baseUrl)));
  }
  return modelNamesFromOpenAi(await getJson(input, `${input.baseUrl}/models`));
}

async function getJson(
  input: { apiKey: string; timeoutMs: number; fetchImpl?: typeof fetch },
  url: string
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(url, { headers, signal: AbortSignal.timeout(input.timeoutMs) });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Model list failed (${response.status})`);
  }
  return text ? (JSON.parse(text) as unknown) : null;
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 200 ? clean : `${clean.slice(0, 197)}...`;
}
