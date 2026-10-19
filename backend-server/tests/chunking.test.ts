import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkPages } from "../src/services/chunking";

describe("chunkPages", () => {
  it("keeps a short page as one chunk", () => {
    const chunks = chunkPages([{ page: 3, text: "Hemoglobin 13.5 g/dL" }]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, "Hemoglobin 13.5 g/dL");
    assert.equal(chunks[0].pageStart, 3);
    assert.equal(chunks[0].pageEnd, 3);
  });

  it("skips pages with no text", () => {
    const chunks = chunkPages([
      { page: 1, text: "   \n" },
      { page: 2, text: "Sodium 140 mmol/L" },
    ]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].pageStart, 2);
  });

  it("splits on paragraph boundaries", () => {
    const alpha = "Alpha ".repeat(30).trim();
    const beta = "Beta ".repeat(30).trim();
    const chunks = chunkPages([{ page: 4, text: `${alpha}\n\n${beta}` }], {
      chunkSize: 200,
      overlap: 0,
      minChunkSize: 20,
    });
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].content.includes("Beta"), false);
    assert.equal(chunks[1].content.includes("Beta"), true);
    assert.equal(chunks[0].pageStart, 4);
  });

  it("prefixes the next chunk with overlap from the previous one", () => {
    const text = `${"A".repeat(300)}${"B".repeat(300)}`;
    const chunks = chunkPages([{ page: 2, text }], {
      chunkSize: 300,
      overlap: 20,
      minChunkSize: 50,
    });
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].content, "A".repeat(300));
    assert.equal(chunks[1].content.startsWith("A".repeat(20)), true);
    assert.equal(chunks[1].content.includes("B"), true);
    assert.equal(chunks[1].pageStart, 2);
    assert.equal(chunks[1].pageEnd, 2);
  });

  it("merges a short following page into the previous chunk", () => {
    const chunks = chunkPages(
      [
        { page: 1, text: "A".repeat(250) },
        { page: 2, text: "Note." },
      ],
      { chunkSize: 1000, overlap: 0, minChunkSize: 200 }
    );
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].pageStart, 1);
    assert.equal(chunks[0].pageEnd, 2);
    assert.equal(chunks[0].content.includes("Note."), true);
  });
});
