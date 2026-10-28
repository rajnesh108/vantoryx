import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeChat, usageFromError, withLlmUsage } from "../src/services/llm";
import { buildObservation, createObservationLog, summarizeObservations } from "../src/services/observe";
import type { LlmUsage } from "../src/services/llm";

const rates = { promptUsdPerMillion: 2, completionUsdPerMillion: 4 };
const usage: LlmUsage = { calls: 3, promptTokens: 1_000_000, completionTokens: 500_000, estimated: false };

describe("observations", () => {
  it("prices a request and keeps the newest traces", () => {
    const first = buildObservation({
      question: `  ${"dose ".repeat(80)}`,
      path: "agent",
      outcome: "answered",
      latencyMs: 100,
      retrieveMs: 40,
      generateMs: 60,
      usage,
      rates,
      model: "llama3.1",
      citationCount: 2,
      attempts: 1,
      sufficient: true,
      error: null,
      id: "one",
      now: "2026-10-28T00:00:00.000Z",
    });
    assert.equal(first.usage.costUsd, 4);
    assert.ok(first.question.length <= 240);
    assert.ok(first.question.endsWith("..."));

    const log = createObservationLog(2);
    log.add(first);
    log.add(trace("two", 200));
    log.add(trace("three", 300));
    assert.deepEqual(
      log.list(10).map((item) => item.id),
      ["three", "two"]
    );
    const summary = log.summary();
    assert.equal(summary.count, 2);
    assert.equal(summary.meanLatencyMs, 250);
    assert.equal(summary.byPath.agent, 2);
    assert.equal(summary.totalCostUsd, 8);
    assert.equal(summarizeObservations([]).meanLatencyMs, null);
  });

  it("keeps token counts when the model call fails", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => jsonResponse({ error: "down" }, 500);
      await withLlmUsage(() => completeChat([{ role: "user", content: "hello" }], 0));
      assert.fail("the model call should fail");
    } catch (error) {
      const failed = usageFromError(error);
      assert.equal(failed.calls, 1);
      assert.equal(failed.estimated, true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

function trace(id: string, latencyMs: number) {
  return buildObservation({
    question: id,
    path: "agent",
    outcome: "answered",
    latencyMs,
    retrieveMs: 1,
    generateMs: 1,
    usage,
    rates,
    model: null,
    citationCount: 0,
    attempts: null,
    sufficient: null,
    error: null,
    id,
    now: "2026-10-28T00:00:00.000Z",
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
