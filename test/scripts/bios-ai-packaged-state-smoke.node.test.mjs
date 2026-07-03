import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { smokeBiosAiPackagedState } from "../../scripts/bios-ai-packaged-state-smoke.mjs";

describe("BIOS AI packaged state smoke", () => {
  it("covers profile-owned memory, dream, and brainstem restart-continuity surfaces", async () => {
    const result = await smokeBiosAiPackagedState();

    for (const surface of [
      "memory-active-state",
      "memory-event-log",
      "memory-daily-notes",
      "durable-memory",
      "dream-history",
      "brainstem-state",
      "brainstem-restart-continuity",
      "circadian-dream-history-readback",
    ]) {
      assert.ok(
        result.validatedSurfaces.includes(surface),
        `Expected packaged state smoke to validate ${surface}`,
      );
    }
  });
});
