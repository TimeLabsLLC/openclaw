import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBiosAiForgeLocalProvingGate } from "../../scripts/bios-ai-forge-local-proving-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI Forge Arena local proving release gate", () => {
  it("accepts the local proving ground only when packaged proof inputs include the UX scenario", async () => {
    const result = await verifyBiosAiForgeLocalProvingGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
      },
      packagedState: {
        validatedSurfaces: ["profiles", "memory-active-state", "profile-owned-worker-truth"],
      },
      uxSmoke: {
        scenarios: ["forge-arena-local-proving-ground"],
      },
    });

    assert.equal(result.forgeArenaLocalProvingGate, "complete");
    assert.deepEqual(result.packagedUxCoverage, [
      "forge-arena-local-proving-ground loads seeded bots through native local Arena state",
      "Run Local Proof records and renders a judged BOSS proving round",
      "Learning bridge, worker governance, and reflex candidate text render after the proving round",
      "Local publish, co-build, and replay actions record replayable local participation",
    ]);
    assert.ok(
      result.blockedBypassCoverage.includes(
        "Arena learning cannot be score-only because measurement history and learning bridge are release-gated",
      ),
    );
    assert.ok(
      result.blockedBypassCoverage.includes(
        "Local participation cannot silently fall back to gateway-only challenge creation when native local Arena is active",
      ),
    );
  });
});
