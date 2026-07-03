import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ELECTRON_SHELL_SPIKE_COMMANDS,
  recommendedDesktopShell,
} from "../../aether-canvas/electron/bridge-contract.mjs";
import { verifyBiosAiDesktopShellDecisionGate } from "../../scripts/bios-ai-desktop-shell-decision-gate.mjs";

describe("BIOS AI desktop shell decision gate", () => {
  it("recommends Electron shell with native sidecars from the current evidence score", () => {
    const decision = recommendedDesktopShell();

    assert.equal(decision.recommendation, "move_to_electron_shell_with_native_sidecars");
    assert.ok(decision.score.electron > decision.score.tauri);
  });

  it("passes when the Electron spike owns a secure Tauri-compatible shell bridge", async () => {
    const report = await verifyBiosAiDesktopShellDecisionGate(undefined, {
      writeReport: false,
    });

    assert.equal(report.status, "pass");
    assert.equal(report.recommendation, "move_to_electron_shell_with_native_sidecars");
    assert.ok(report.commandSlice.includes("bios_runtime_status"));
    assert.ok(report.commandSlice.includes("load_forge_arena_local_state"));
    assert.ok(report.commandSlice.includes("load_bios_local_connector_status"));
    assert.ok(report.commandSlice.includes("bios_local_tool_registry"));
  });

  it("keeps renderer capability inventory calls on the Electron bridge allowlist", () => {
    assert.ok(ELECTRON_SHELL_SPIKE_COMMANDS.includes("load_bios_local_connector_status"));
    assert.ok(ELECTRON_SHELL_SPIKE_COMMANDS.includes("bios_local_tool_registry"));
  });

  it("does not recommend migration when criteria no longer beat Tauri", () => {
    const decision = recommendedDesktopShell([
      { id: "native_os_control", tauri: 5, electron: 1, reason: "fixture" },
      { id: "security_defaults", tauri: 5, electron: 1, reason: "fixture" },
    ]);

    assert.equal(decision.recommendation, "stay_on_tauri_until_electron_proof_wins");
  });
});
