import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { smokeBiosAiPackagedState } from "../../scripts/bios-ai-packaged-state-smoke.mjs";
import { verifyBiosAiPhase14ReleaseGate } from "../../scripts/bios-ai-phase14-release-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI Phase 14 release gate", () => {
  it("asserts consumer shell clarity, canonical tests, packaged UX proof, and bypass blocking", async () => {
    const packagedState = await smokeBiosAiPackagedState(repoRoot);
    const result = await verifyBiosAiPhase14ReleaseGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: path.join(
          repoRoot,
          "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
        ),
      },
      packagedState,
      uxSmoke: {
        scenarios: [
          "settings-control-plane",
          "diagnostics-recovery-surface",
          "legacy-ready-without-profile",
        ],
      },
    });

    assert.equal(result.phase14ReleaseGate, "complete");
    assert.ok(result.packagedExeProof.endsWith(".exe"));
    assert.ok(result.packagedUxCoverage.includes("diagnostics-recovery runtime blocked clarity"));
    assert.ok(result.blockedBypassCoverage.includes("native-profile-only ready shell"));
    assert.ok(result.canonicalTests.includes("shell-summary"));
  });
});
