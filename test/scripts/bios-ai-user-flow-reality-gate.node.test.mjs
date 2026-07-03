import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { smokeBiosAiPackagedState } from "../../scripts/bios-ai-packaged-state-smoke.mjs";
import {
  BIOS_AI_USER_FLOW_REALITY_SCENARIOS,
  verifyBiosAiUserFlowRealityGate,
} from "../../scripts/bios-ai-user-flow-reality-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI user-flow reality release gate", () => {
  it("requires packaged UI click flows, rerender proof, persistence surfaces, and release wiring", async () => {
    const packagedState = await smokeBiosAiPackagedState(repoRoot);
    const result = await verifyBiosAiUserFlowRealityGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: path.join(
          repoRoot,
          "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
        ),
      },
      windowsRegistrationProof: {
        windowsRegistrationProof: "verified",
      },
      packagedState,
      uxSmoke: {
        scenarios: BIOS_AI_USER_FLOW_REALITY_SCENARIOS,
      },
    });

    assert.equal(result.userFlowRealityGate, "complete");
    assert.ok(result.packagedExeProof.endsWith(".exe"));
    assert.equal(result.windowsRegistrationProof, "verified");
    assert.deepEqual(result.packagedUxCoverage, BIOS_AI_USER_FLOW_REALITY_SCENARIOS);
    assert.ok(
      result.realUserFlowContracts.includes(
        "visible user controls are clicked instead of only calling backend commands",
      ),
    );
    assert.ok(
      result.realUserFlowContracts.includes(
        "boxed-lane repair proves visible latest repair status",
      ),
    );
    assert.ok(
      result.realUserFlowContracts.includes(
        "button-like surfaces share hover raise/grow and press feedback",
      ),
    );
  });
});
