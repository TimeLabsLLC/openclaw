import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { smokeBiosAiPackagedState } from "../../scripts/bios-ai-packaged-state-smoke.mjs";
import { verifyBiosAiPhase15ReleaseGate } from "../../scripts/bios-ai-phase15-release-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI Phase 15 release gate", () => {
  it("asserts no split-brain route truth, canonical tests, packaged UX proof, and bypass blocking", async () => {
    const packagedState = await smokeBiosAiPackagedState(repoRoot);
    const result = await verifyBiosAiPhase15ReleaseGate(repoRoot, {
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
          "legacy-ready-without-profile",
          "stale-saved-route-bypass-blocked",
          "diagnostics-recovery-surface",
        ],
      },
    });

    assert.equal(result.phase15ReleaseGate, "complete");
    assert.ok(result.packagedExeProof.endsWith(".exe"));
    assert.ok(
      result.packagedUxCoverage.includes(
        "stale-saved-route-bypass-blocked refuses saved provider/backend hints",
      ),
    );
    assert.ok(result.blockedBypassCoverage.includes("route_ready-only local capability posture"));
    assert.ok(result.canonicalTests.includes("runtime-transport/client"));
  });
});
