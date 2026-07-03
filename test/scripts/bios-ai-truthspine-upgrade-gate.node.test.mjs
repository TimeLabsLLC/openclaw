import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { smokeBiosAiPackagedState } from "../../scripts/bios-ai-packaged-state-smoke.mjs";
import { verifyBiosAiTruthSpineUpgradeGate } from "../../scripts/bios-ai-truthspine-upgrade-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI TruthSpine upgrade release gate", () => {
  it("asserts native session updates, UI truth, packaged UX proof, and bypass blocking", async () => {
    const packagedState = await smokeBiosAiPackagedState(repoRoot);
    const result = await verifyBiosAiTruthSpineUpgradeGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: path.join(
          repoRoot,
          "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
        ),
      },
      packagedState,
      uxSmoke: {
        scenarios: ["truthspine-session-update"],
      },
    });

    assert.equal(result.truthSpineUpgradeGate, "complete");
    assert.ok(result.packagedExeProof.endsWith(".exe"));
    assert.ok(
      result.packagedUxCoverage.includes(
        "truthspine-session-update records candidate and accepted decision through Tauri",
      ),
    );
    assert.ok(
      result.blockedBypassCoverage.includes(
        "local supervisor chat turns use record_bios_truth_session_update",
      ),
    );
    assert.ok(result.canonicalTests.includes("bios_truth_spine native Rust tests"));
  });

  it("awaits lazy proof helper results before asserting the release gate", async () => {
    const result = await verifyBiosAiTruthSpineUpgradeGate(repoRoot, {
      buildIdentity: Promise.resolve({
        productName: "BIOS AI",
        setupExePath: path.join(repoRoot, ".artifacts/desktop-shell/proof/BIOS AI Setup.exe"),
      }),
      packagedState: Promise.resolve({
        validatedSurfaces: [
          "profiles",
          "memory-active-state",
          "provider-config",
          "profile-owned-worker-truth",
        ],
      }),
      uxSmoke: Promise.resolve({
        scenarios: ["truthspine-session-update"],
      }),
    });

    assert.equal(result.truthSpineUpgradeGate, "complete");
    assert.ok(result.packagedExeProof.endsWith(".exe"));
  });
});
