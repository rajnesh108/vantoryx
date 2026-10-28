import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadDataset } from "../src/evaluation/dataset";
import { FIXTURE_PASSAGES, rankFixture, searchFixture } from "../src/evaluation/fixture";
import {
  answerQuality,
  buildReport,
  factCoverage,
  recallAtK,
  retryAddedChunks,
  scoreCase,
  scoreFailure,
  usageCost,
  type MeasuredRun,
} from "../src/evaluation/metrics";
import { completeChat, estimateTokens, trackLlmUsage } from "../src/services/llm";
import { abstainAnswer, decideOutcome } from "../src/services/outcome";
import type { EvalCase } from "../src/evaluation/dataset";
import type { LlmUsage } from "../src/services/llm";
import type { SearchHit } from "../src/types";

const rates = { promptUsdPerMillion: 2, completionUsdPerMillion: 8 };

describe("answer outcome", () => {
  it("abstains when nothing was retrieved or the grade failed", () => {
    assert.equal(decideOutcome(0, false), "not_found");
    assert.equal(decideOutcome(0, true), "not_found");
    assert.equal(decideOutcome(2, false), "insufficient_evidence");
    assert.equal(decideOutcome(2, null), "answered");
    assert.equal(decideOutcome(2, true), "answered");
    assert.equal(abstainAnswer("insufficient_evidence", 0).includes("no answer was generated"), true);
    assert.equal(abstainAnswer("insufficient_evidence", 0).includes("6.5"), false);
  });
});

describe("evaluation dataset and fixture", () => {
  it("ships two questions of each type, labeled against the fixture passages", () => {
    const cases = loadDataset();
    assert.equal(cases.filter((item) => item.type === "simple").length, 2);
    assert.equal(cases.filter((item) => item.type === "multi_hop").length, 2);
    assert.equal(cases.filter((item) => item.type === "unanswerable").length, 2);
    for (const item of cases) {
      if (item.type === "unanswerable") {
        assert.equal(item.expectedOutcome, "insufficient_evidence");
        assert.deepEqual(item.relevantPhrases, []);
        assert.deepEqual(item.expectedFacts, []);
        continue;
      }
      assert.equal(item.expectedOutcome, "answered");
      assert.ok(item.relevantPhrases.length > 0);
      assert.ok(item.expectedFacts.length > 0);
      for (const phrase of item.relevantPhrases) {
        assert.ok(
          FIXTURE_PASSAGES.some((passage) => passage.content.includes(phrase)),
          phrase
        );
      }
    }
  });

  it("ranks the HIV passage first and still does not contain an HbA1c result", () => {
    const ranked = rankFixture("What HbA1c result does the note list for people living with HIV?");
    assert.equal(ranked[0]?.chunkId, "fixture-ipt-hiv");
    assert.equal(
      ranked.some((hit) => hit.content.toLowerCase().includes("hba1c")),
      false
    );
    const medicine = rankFixture("What first-line medicine does the note name for type 2 diabetes?");
    assert.equal(medicine[0]?.chunkId, "fixture-metformin");
    assert.deepEqual(rankFixture("the and for"), []);
  });

  it("keeps passages from separate queries after fusion", () => {
    const hits = searchFixture(["people living with HIV", "chunk overlap"], 5);
    assert.ok(hits.some((hit) => hit.chunkId === "fixture-ipt-hiv"));
    assert.ok(hits.some((hit) => hit.chunkId === "fixture-overlap"));
  });
});

describe("evaluation metrics", () => {
  it("scores recall, facts, abstention, and retries", () => {
    assert.equal(recallAtK(["Isoniazid preventive treatment"], ["isoniazid preventive"], 1), 1);
    assert.equal(recallAtK(["only treatment"], ["isoniazid", "household contacts"], 1), 0);
    assert.equal(recallAtK(["alpha isoniazid", "beta contacts"], ["isoniazid", "contacts"], 1), 0.5);
    assert.equal(recallAtK(["anything"], [], 5), null);
    assert.equal(factCoverage("Isoniazid is listed.", ["isoniazid"]), 1);
    assert.equal(factCoverage("No medicine is named.", ["isoniazid"]), 0);
    assert.equal(
      answerQuality({
        expected: "insufficient_evidence",
        actual: "insufficient_evidence",
        answer: abstainAnswer("insufficient_evidence", 0),
        expectedFacts: [],
        forbidden: ["10 mg"],
      }),
      1
    );
    assert.equal(
      answerQuality({
        expected: "insufficient_evidence",
        actual: "answered",
        answer: "The note lists 10 mg.",
        expectedFacts: [],
        forbidden: ["10 mg"],
      }),
      0
    );
    assert.equal(retryAddedChunks([{ queries: ["a"], chunkIds: ["1"], scores: [1] }]), null);
    assert.equal(
      retryAddedChunks([
        { queries: ["a"], chunkIds: ["1"], scores: [1] },
        { queries: ["b"], chunkIds: ["1"], scores: [1] },
      ]),
      false
    );
    assert.equal(
      retryAddedChunks([
        { queries: ["a"], chunkIds: ["1"], scores: [1] },
        { queries: ["b"], chunkIds: ["2", "1"], scores: [1, 1] },
      ]),
      true
    );
    assert.equal(usageCost({ promptTokens: 1_000_000, completionTokens: 500_000 }, rates), 6);
  });

  it("summarizes a hybrid and agentic run and flags the gaps", () => {
    const gain = { ...baseCase("gain-case", "simple"), relevantPhrases: ["isoniazid", "household contacts"] };
    const retry = baseCase("retry-case", "simple");
    const missing = baseCase("hba1c-hiv", "unanswerable", "insufficient_evidence");
    const usage = blankUsage();
    const agenticRecall = scoreCase({
      evalCase: retry,
      mode: "agentic",
      k: 1,
      latencyMs: 400,
      usage,
      rates,
      run: measured({
        outcome: "answered",
        answer: "Isoniazid is listed.",
        attempts: 2,
        citations: [hit("fixture-ipt-hiv", "Isoniazid preventive treatment for a six month course")],
        retrievals: [
          { queries: ["hiv"], chunkIds: ["other"], scores: [1] },
          { queries: ["isoniazid"], chunkIds: ["other"], scores: [1] },
        ],
      }),
    });
    assert.equal(agenticRecall.retries, 1);
    assert.equal(agenticRecall.retryAddedChunks, false);
    assert.equal(agenticRecall.recallAtK, 1);

    const hybridMiss = scoreCase({
      evalCase: gain,
      mode: "hybrid",
      k: 1,
      latencyMs: 80,
      usage,
      rates,
      run: measured({
        outcome: "answered",
        answer: "Isoniazid is listed.",
        citations: [hit("fixture-ipt-hiv", "isoniazid only")],
      }),
    });
    const agenticHit = scoreCase({
      evalCase: gain,
      mode: "agentic",
      k: 2,
      latencyMs: 90,
      usage,
      rates,
      run: measured({
        outcome: "answered",
        answer: "Isoniazid is listed for household contacts.",
        citations: [hit("a", "isoniazid"), hit("b", "household contacts")],
      }),
    });
    assert.equal(hybridMiss.recallAtK, 0.5);
    assert.equal(agenticHit.recallAtK, 1);

    const unsupported = scoreCase({
      evalCase: missing,
      mode: "hybrid",
      k: 5,
      latencyMs: 50,
      usage,
      rates,
      run: measured({ outcome: "answered", answer: "The passages do not say.", citations: [hit("fixture-ipt-hiv", "HIV")] }),
    });
    assert.equal(unsupported.answerQuality, 0);
    assert.equal(unsupported.sufficiencyCorrect, false);
    assert.equal(unsupported.recallAtK, null);

    const failed = scoreFailure({
      evalCase: retry,
      mode: "hybrid",
      latencyMs: 10,
      usage,
      rates,
      error: "Database is unavailable",
    });
    const report = buildReport({
      source: "fixture",
      k: 5,
      generatedAt: "2026-10-28T00:00:00.000Z",
      cases: [hybridMiss, agenticHit, unsupported, agenticRecall, failed],
    });
    assert.equal(report.summary.find((row) => row.mode === "hybrid" && row.type === "all")?.count, 2);
    assert.ok(report.findings.some((finding) => finding.kind === "agentic_recall_gain" && finding.caseId === "gain-case"));
    assert.ok(report.findings.some((finding) => finding.kind === "unsupported_answer"));
    assert.ok(report.findings.some((finding) => finding.kind === "retry_no_gain" && finding.caseId === "retry-case"));
  });

  it("flags hybrid parity when quality matches at a lower latency", () => {
    const item = {
      ...baseCase("diabetes-medicine", "simple"),
      relevantPhrases: ["Metformin is the first-line medicine"],
      expectedFacts: ["metformin"],
    };
    const usage = blankUsage();
    const report = buildReport({
      source: "fixture",
      k: 5,
      generatedAt: "2026-10-28T00:00:00.000Z",
      cases: [
        scoreCase({
          evalCase: item,
          mode: "hybrid",
          k: 5,
          latencyMs: 100,
          usage,
          rates,
          run: measured({ outcome: "answered", answer: "Metformin is named.", citations: [hit("fixture-metformin", "Metformin is the first-line medicine")] }),
        }),
        scoreCase({
          evalCase: item,
          mode: "agentic",
          k: 5,
          latencyMs: 900,
          usage: { ...usage, calls: 4 },
          rates,
          run: measured({ outcome: "answered", answer: "Metformin is named.", citations: [hit("fixture-metformin", "Metformin is the first-line medicine")] }),
        }),
      ],
    });
    assert.deepEqual(
      report.findings.map((finding) => finding.kind),
      ["hybrid_parity"]
    );
    const all = report.summary.find((row) => row.mode === "agentic" && row.type === "all");
    assert.equal(all?.meanLlmCalls, 4);
    assert.equal(all?.meanRecall, 1);
  });
});

describe("token accounting", () => {
  it("records reported usage and estimates a failed call", async () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcde"), 2);
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        jsonResponse({
          choices: [{ message: { content: "answer" } }],
          model: "test-model",
          usage: { prompt_tokens: 11, completion_tokens: 3 },
        });
      const tracked = await trackLlmUsage(() => completeChat([{ role: "user", content: "hello" }], 0));
      assert.equal(tracked.ok, true);
      if (tracked.ok) {
        assert.equal(tracked.result.text, "answer");
        assert.equal(tracked.usage.calls, 1);
        assert.equal(tracked.usage.promptTokens, 11);
        assert.equal(tracked.usage.completionTokens, 3);
        assert.equal(tracked.usage.estimated, false);
      }

      globalThis.fetch = async () => jsonResponse({ error: "down" }, 500);
      const failed = await trackLlmUsage(() => completeChat([{ role: "user", content: "hello" }], 0));
      assert.equal(failed.ok, false);
      assert.equal(failed.usage.calls, 1);
      assert.equal(failed.usage.estimated, true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

function baseCase(id: string, type: EvalCase["type"], expectedOutcome: EvalCase["expectedOutcome"] = "answered"): EvalCase {
  return {
    id,
    type,
    question: "Question",
    expectedOutcome,
    relevantPhrases: type === "unanswerable" ? [] : ["Isoniazid preventive treatment for a six month course"],
    expectedFacts: type === "unanswerable" ? [] : ["isoniazid"],
    forbidden: ["10 mg"],
  };
}

function measured(partial: Partial<MeasuredRun> & Pick<MeasuredRun, "answer" | "outcome">): MeasuredRun {
  return {
    model: "test",
    citations: [],
    queries: ["question"],
    attempts: 1,
    gradedSufficient: partial.outcome === "answered",
    gradeReason: null,
    retrievals: [{ queries: ["question"], chunkIds: partial.citations?.map((item) => item.chunkId) ?? [], scores: [1] }],
    ...partial,
  };
}

function hit(chunkId: string, content: string): SearchHit {
  return {
    chunkId,
    documentId: "fixture",
    documentName: "fixture.txt",
    category: "who",
    pageStart: 1,
    pageEnd: 1,
    content,
    score: 1,
  };
}

function blankUsage(): LlmUsage {
  return { calls: 1, promptTokens: 10, completionTokens: 5, estimated: false };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
