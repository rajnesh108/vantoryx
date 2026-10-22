import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fuseByReciprocalRank } from "../src/services/fusion";

describe("fuseByReciprocalRank", () => {
  it("ranks a chunk that appears in both lists above a chunk that appears in one", () => {
    const fused = fuseByReciprocalRank([
      [{ chunkId: "a" }, { chunkId: "b" }],
      [{ chunkId: "b" }, { chunkId: "c" }],
    ]);
    assert.deepEqual(
      fused.map((hit) => hit.chunkId),
      ["b", "a", "c"]
    );
  });

  it("keeps the earlier rank ahead of a later one in a single list", () => {
    const fused = fuseByReciprocalRank([[{ chunkId: "first" }, { chunkId: "second" }]]);
    assert.equal(fused[0].chunkId, "first");
    assert.ok(fused[0].score > fused[1].score);
  });

  it("returns no hits when every list is empty", () => {
    assert.deepEqual(fuseByReciprocalRank([[], []]), []);
  });
});
