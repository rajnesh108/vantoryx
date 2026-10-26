import { buildApp } from "./app";
import { config } from "./config";
import { migrate } from "./db/migrate";
import { pool } from "./db/pool";
import { ensureAdmin } from "./db/users";
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
      `LLM: ${config.llm.model} @ ${config.llm.baseUrl} (api key ${config.llm.apiKey ? "set" : "not set"})`
    );
    console.log(
      config.agentEnabled
        ? `Agent: LangGraph retrieval, ${config.agentMaxRetries} ${config.agentMaxRetries === 1 ? "retry" : "retries"}`
        : "Agent: off, hybrid retrieval only"
    );
  });
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
