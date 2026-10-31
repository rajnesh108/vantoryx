import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "../config";
import { HttpError } from "../lib/http";
import {
  defaultModel,
  probeLocalLlm,
  providerLabel,
  resolveLlmBaseUrl,
  type LlmProvider,
} from "./localLlm";

export interface ChatTarget {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface LlmOption {
  provider: LlmProvider;
  label: string;
  model: string;
  available: boolean;
  detail: string | null;
}

export interface LlmCatalog {
  provider: LlmProvider;
  model: string;
  options: LlmOption[];
}

const choiceStore = new AsyncLocalStorage<ChatTarget>();

export function activeChatTarget(): ChatTarget {
  return choiceStore.getStore() ?? targetFromConfig();
}

export function withChatTarget<T>(target: ChatTarget, fn: () => Promise<T>): Promise<T> {
  return choiceStore.run(target, fn);
}

export function chatTargetFor(provider: LlmProvider, model: string): ChatTarget {
  const name = model.trim();
  if (!name || name.length > 200) throw new HttpError(400, "Choose a model.");
  if (provider === "openai" && !openAiKey()) {
    throw new HttpError(400, "OpenAI needs OPENAI_API_KEY on the server.");
  }
  return {
    provider,
    model: name,
    baseUrl: provider === config.llm.provider ? config.llm.baseUrl : resolveLlmBaseUrl(provider, undefined),
    apiKey: keyFor(provider),
    timeoutMs: config.llm.timeoutMs,
  };
}

export async function listLlmOptions(fetchImpl?: typeof fetch): Promise<LlmCatalog> {
  const llamaModel =
    config.llm.provider === "llamacpp" ? config.llm.model : config.llm.gguf ? defaultModel("llamacpp", config.llm.gguf) : "GGUF model";
  const [ollama, llama, openai] = await Promise.all([
    probed("ollama", config.llm.provider === "ollama" ? config.llm.model : "llama3.1", fetchImpl),
    probed("llamacpp", llamaModel, fetchImpl),
    openAiOptions(fetchImpl),
  ]);
  return {
    provider: config.llm.provider,
    model: config.llm.model,
    options: [...ollama, ...llama, ...openai],
  };
}

function targetFromConfig(): ChatTarget {
  return {
    provider: config.llm.provider,
    model: config.llm.model,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    timeoutMs: config.llm.timeoutMs,
  };
}

function keyFor(provider: LlmProvider): string {
  if (provider === "openai") return openAiKey();
  if (provider === "ollama") return config.llm.provider === "ollama" ? config.llm.apiKey : "ollama";
  return "";
}

function openAiKey(): string {
  const dedicated = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (dedicated) return dedicated;
  return config.llm.provider === "openai" ? config.llm.apiKey : "";
}

async function probed(provider: "ollama" | "llamacpp", model: string, fetchImpl?: typeof fetch): Promise<LlmOption[]> {
  const baseUrl = provider === config.llm.provider ? config.llm.baseUrl : resolveLlmBaseUrl(provider, undefined);
  const probe = await probeLocalLlm({
    provider,
    model,
    baseUrl,
    apiKey: keyFor(provider),
    timeoutMs: 3000,
    fetchImpl,
  });
  if (probe.status === "unavailable" || probe.models.length === 0) {
    return [{ provider, label: providerLabel(provider), model, available: false, detail: probe.detail ?? "The server is not running." }];
  }
  return probe.models.map((listed) => ({
    provider,
    label: providerLabel(provider),
    model: listed,
    available: true,
    detail: null,
  }));
}

async function openAiOptions(fetchImpl?: typeof fetch): Promise<LlmOption[]> {
  const key = openAiKey();
  const model = config.llm.provider === "openai" ? config.llm.model : "gpt-4o-mini";
  if (!key) {
    return [{ provider: "openai", label: "OpenAI", model, available: false, detail: "Add OPENAI_API_KEY on the server." }];
  }
  const probe = await probeLocalLlm({
    provider: "openai",
    model,
    baseUrl: resolveLlmBaseUrl("openai", undefined),
    apiKey: key,
    timeoutMs: 3000,
    fetchImpl,
  });
  if (probe.status === "unavailable" || probe.models.length === 0) {
    return [{ provider: "openai", label: "OpenAI", model, available: false, detail: probe.detail ?? "OpenAI did not list models." }];
  }
  return probe.models.map((listed) => ({
    provider: "openai",
    label: "OpenAI",
    model: listed,
    available: true,
    detail: null,
  }));
}
