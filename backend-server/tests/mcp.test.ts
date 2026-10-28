import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { parseToolChoice } from "../src/services/agent/decisions";
import { buildMessages } from "../src/services/prompt";
import { bodyMassIndex, convertGlucose, convertTemperature } from "../src/services/mcp/calculate";
import { describeTools, toolCitation } from "../src/services/mcp/catalog";
import { bundledCalculatorServer, parseMcpServers } from "../src/services/mcp/servers";
import { openMcpSession } from "../src/services/mcp/session";
import type { SearchHit } from "../src/types";

describe("calculator tools", () => {
  it("converts glucose, temperature, and BMI without interpreting them", () => {
    const glucose = convertGlucose(5.6, "mmol/L", "mg/dL");
    assert.equal(glucose.ok, true);
    if (glucose.ok) assert.match(glucose.text, /100\.9 mg\/dL/);

    const temperature = convertTemperature(37, "C", "F");
    assert.equal(temperature.ok, true);
    if (temperature.ok) assert.match(temperature.text, /98\.6 F/);

    const bmi = bodyMassIndex(70, 175);
    assert.equal(bmi.ok, true);
    if (bmi.ok) assert.match(bmi.text, /= 22\.9/);

    assert.equal(convertGlucose(0, "mmol/L", "mg/dL").ok, false);
  });
});

describe("MCP server config", () => {
  const cwd = path.resolve(".");

  it("keeps the bundled server when MCP_SERVERS is unset and accepts an http server", () => {
    const fallback = [bundledCalculatorServer(cwd)];
    assert.equal(parseMcpServers(undefined, { cwd, fallback })[0]?.name, "calculators");
    const parsed = parseMcpServers(
      JSON.stringify([{ name: "guidelines", transport: "http", url: "http://127.0.0.1:3000/mcp", headers: { Authorization: "Bearer local" } }]),
      { cwd, fallback }
    );
    assert.equal(parsed[0]?.transport, "http");
    if (parsed[0]?.transport === "http") assert.equal(parsed[0].headers.Authorization, "Bearer local");
  });

  it("rejects a command the chat request could confuse with a shell line", () => {
    assert.throws(
      () => parseMcpServers(JSON.stringify([{ name: "calc", transport: "stdio", command: "node\n-e" }]), { cwd, fallback: [] }),
      /single-line/
    );
    assert.throws(
      () => parseMcpServers(JSON.stringify([{ name: "docs", transport: "http", url: "file:///tmp/server" }]), { cwd, fallback: [] }),
      /http/
    );
  });
});

describe("tool catalog", () => {
  it("describes arguments and marks a tool result as a source", () => {
    const text = describeTools([
      {
        server: "calculators",
        name: "convert-glucose",
        description: "Convert glucose",
        inputSchema: {
          type: "object",
          properties: { value: { type: "number" }, from: { enum: ["mmol/L", "mg/dL"] } },
          required: ["value", "from"],
        },
      },
    ]);
    assert.match(text, /calculators\/convert-glucose/);
    assert.match(text, /value: number/);
    assert.match(text, /from: mmol\/L\|mg\/dL/);

    const hit = toolCitation(
      { server: "calculators", name: "convert-glucose", arguments: {}, reason: "Convert." },
      "5.6 mmol/L = 100.9 mg/dL.",
      1
    );
    const messages = buildMessages("Convert 5.6 mmol/L", [hit, documentHit()]);
    assert.match(messages[0]?.content ?? "", /tool result/);
    assert.match(messages[1]?.content ?? "", /calculators\/convert-glucose \(tool result\)/);
    const documentsOnly = buildMessages("What does WHO say?", [documentHit()]);
    assert.doesNotMatch(documentsOnly[0]?.content ?? "", /tool result/);
  });

  it("reads a fenced tool choice", () => {
    const choice = parseToolChoice(
      '```json\n{"call":false,"reason":"The question asks for a dose."}\n```',
      [{ server: "calculators", name: "convert-glucose", description: "Convert", inputSchema: {} }]
    );
    assert.equal(choice.call, null);
    assert.match(choice.reason, /dose/);
  });
});

describe("MCP stdio session", () => {
  it("lists the calculator tools and calls convert-glucose", { timeout: 60_000 }, async () => {
    const session = await openMcpSession([bundledCalculatorServer(path.resolve(__dirname, ".."))], 20_000);
    try {
      assert.deepEqual(
        session.tools.map((tool) => tool.name).sort(),
        ["body-mass-index", "convert-glucose", "convert-temperature"]
      );
      const text = await session.call({
        server: "calculators",
        name: "convert-glucose",
        arguments: { value: 5.6, from: "mmol/L", to: "mg/dL" },
        reason: "test",
      });
      assert.match(text, /100\.9 mg\/dL/);
      await assert.rejects(
        () =>
          session.call({
            server: "calculators",
            name: "convert-glucose",
            arguments: { value: 0, from: "mmol/L", to: "mg/dL" },
            reason: "test",
          }),
        /greater than 0/
      );
    } finally {
      await session.close();
    }
  });
});

function documentHit(): SearchHit {
  return {
    chunkId: "passage",
    documentId: "doc",
    documentName: "guide.pdf",
    category: "who",
    pageStart: 2,
    pageEnd: 2,
    content: "A passage.",
    score: 1,
  };
}
