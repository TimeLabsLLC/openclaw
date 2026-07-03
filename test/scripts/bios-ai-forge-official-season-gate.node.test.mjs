import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBiosAiForgeOfficialSeasonGate } from "../../scripts/bios-ai-forge-official-season-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI Forge Arena official season release gate", () => {
  it("accepts official season truth only with packaged local proving proof inputs", async () => {
    const result = await verifyBiosAiForgeOfficialSeasonGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
      },
      packagedState: {
        validatedSurfaces: ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
      },
      uxSmoke: {
        scenarios: ["forge-arena-local-proving-ground"],
      },
    });

    assert.equal(result.forgeArenaOfficialSeasonGate, "complete");
    assert.ok(
      result.packagedUxCoverage.includes(
        "official rankings use BOSS judging authority and survive local state mutation",
      ),
    );
    assert.ok(
      result.blockedBypassCoverage.includes(
        "Official season truth cannot be JS-only projection from local artifacts",
      ),
    );
  });
});
