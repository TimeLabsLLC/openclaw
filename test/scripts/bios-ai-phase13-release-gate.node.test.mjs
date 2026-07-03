import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { smokeBiosAiPackagedState } from "../../scripts/bios-ai-packaged-state-smoke.mjs";
import { verifyBiosAiPhase13ReleaseGate } from "../../scripts/bios-ai-phase13-release-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI Phase 13 release gate", () => {
  it("asserts Windows package proof, doctor coverage, packaged state, and explicit platform lanes", async () => {
    const packagedState = await smokeBiosAiPackagedState(repoRoot);
    const result = await verifyBiosAiPhase13ReleaseGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: path.join(
          repoRoot,
          "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
        ),
        installerScriptPath: path.join(
          repoRoot,
          "aether-canvas/src-tauri/target/release/nsis/x64/installer.nsi",
        ),
      },
      packagedState,
      platform: "win32",
    });

    assert.equal(result.windowsReleaseGate, "complete");
    assert.equal(result.installerProof.installMode, "both");
    assert.equal(result.installerProof.installerHooks, "installer-hooks/bios-ai-boxed-lane.nsh");
    assert.ok(result.packagedStateSurfaces.includes("brainstem-restart-continuity"));
    assert.ok(result.uxCoverage.includes("resume-runtime-setup"));
    assert.ok(result.doctorCoverage.includes("sandbox-substrate"));
    assert.equal(result.platformLanes.windows.status, "proved-by-release-smoke");
    assert.equal(result.platformLanes.macos.status, "blocked-until-darwin-host");
    assert.equal(result.platformLanes.linux.status, "blocked-until-linux-host");
  });
});
