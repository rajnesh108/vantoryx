import { config } from "../config";
import { trackLlmUsage } from "../services/llm";
import type { EvalCase } from "./dataset";
import { compileEvalGraph, executeQuestion } from "./execute";
import { buildReport, scoreCase, scoreFailure, type CaseScore, type EvalMode, type EvalReport, type EvalSource, type TokenRates } from "./metrics";

export async function runEvaluation(options: {
  source: EvalSource;
  modes: EvalMode[];
  cases: EvalCase[];
  k: number;
  rates?: TokenRates;
  now?: () => string;
}): Promise<EvalReport> {
  const rates = options.rates ?? {
    promptUsdPerMillion: config.eval.promptUsdPerMillion,
    completionUsdPerMillion: config.eval.completionUsdPerMillion,
  };
  const graph = options.modes.includes("agentic") ? compileEvalGraph(options.source) : null;
  const rows: CaseScore[] = [];
  for (const evalCase of options.cases) {
    for (const mode of options.modes) {
      const started = Date.now();
      console.log(`[evaluation] ${options.source} ${mode} ${evalCase.id}`);
      const tracked = await trackLlmUsage(() => executeQuestion(options.source, mode, evalCase, graph));
      const latencyMs = Date.now() - started;
      if (!tracked.ok) {
        rows.push(scoreFailure({ evalCase, mode, latencyMs, usage: tracked.usage, rates, error: tracked.error }));
        continue;
      }
      rows.push(
        scoreCase({
          evalCase,
          mode,
          k: options.k,
          latencyMs,
          usage: tracked.usage,
          rates,
          run: tracked.result,
        })
      );
    }
  }
  return buildReport({
    source: options.source,
    k: options.k,
    cases: rows,
    generatedAt: (options.now ?? (() => new Date().toISOString()))(),
  });
}
