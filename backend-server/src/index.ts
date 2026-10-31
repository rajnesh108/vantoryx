import { buildApp } from "./app";
import { config } from "./config";
import { migrate } from "./db/migrate";
import { pool } from "./db/pool";
import { ensureAdmin } from "./db/users";
import { providerLabel } from "./services/localLlm";
import { closeConnectedTools, warmMcp } from "./services/mcp/session";
import { ensureUploadDir } from "./services/storage";

async function main(): Promise<void> {
  await ensureUploadDir();
  await migrate();
  await ensureAdmin(config.admin.username, config.admin.password);
  const app = buildApp();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
    console.log(`Admin user: ${config.admin.username}`);
    console.log(`Uploads: ${config.uploadDir}`);
    console.log(`Embeddings: ${config.embeddingServiceUrl}`);
    console.log(
      `LLM: ${providerLabel(config.llm.provider)} ${config.llm.model}${config.llm.gguf ? ` gguf ${config.llm.gguf}` : ""} @ ${config.llm.baseUrl} (api key ${config.llm.apiKey ? "set" : "not set"})`
    );
    console.log(
      config.agentEnabled
        ? `Agent: LangGraph retrieval, ${config.agentMaxRetries} ${config.agentMaxRetries === 1 ? "retry" : "retries"}`
        : "Agent: off, hybrid retrieval only"
    );
    if (config.mcp.enabled && config.mcp.maxCalls > 0 && config.mcp.servers.length > 0) {
      void warmMcp();
    } else {
      console.log("MCP: off");
    }
  });
}

let stopping = false;

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  try {
    await closeConnectedTools();
    await pool.end();
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

main().catch(async (error) => {
  console.error(error);
  await closeConnectedTools();
  await pool.end();
  process.exit(1);
});
