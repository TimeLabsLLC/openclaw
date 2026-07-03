import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeBiosAiRegistrationTargets,
  verifyBiosAiWindowsRegistrationProof,
} from "../../scripts/bios-ai-windows-registration-proof.mjs";

describe("BIOS AI Windows registration proof", () => {
  it("blocks stale smoke install targets", () => {
    const analysis = analyzeBiosAiRegistrationTargets(
      ["C:\\tmp\\bios-ai-installer-smoke\\Program\\BIOS AI.exe"],
      {
        releaseExePath: "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bios-ai.exe",
        setupExePath:
          "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bundle\\nsis\\BIOS AI.exe",
      },
    );

    assert.equal(analysis.status, "blocked");
    assert.equal(analysis.forbiddenTargets.length, 1);
  });

  it("accepts a real installed app target outside development and smoke folders", () => {
    const analysis = analyzeBiosAiRegistrationTargets(
      ["C:\\Users\\midni\\AppData\\Local\\Programs\\BIOS AI\\BIOS AI.exe"],
      {
        releaseExePath: "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bios-ai.exe",
        setupExePath:
          "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bundle\\nsis\\BIOS AI.exe",
      },
    );

    assert.equal(analysis.status, "verified");
    assert.deepEqual(analysis.forbiddenTargets, []);
    assert.equal(analysis.currentInstallTargets.length, 1);
  });

  it("blocks split-brain registration across stale and current installed app targets", () => {
    const analysis = analyzeBiosAiRegistrationTargets(
      [
        "C:\\Program Files\\BIOS AI\\bios-ai.exe",
        "C:\\Users\\midni\\AppData\\Local\\BIOS AI Current\\BIOS AI.exe",
      ],
      {
        releaseExePath: "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bios-ai.exe",
        setupExePath:
          "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bundle\\nsis\\BIOS AI.exe",
      },
    );

    assert.equal(analysis.status, "split_brain");
    assert.equal(analysis.splitBrainTargets.length, 2);
  });

  it("fails release proof when a registered target points at a stale smoke app", async () => {
    await assert.rejects(
      () =>
        verifyBiosAiWindowsRegistrationProof("E:\\repo", {
          buildIdentity: {
            releaseExePath: "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bios-ai.exe",
            setupExePath:
              "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bundle\\nsis\\BIOS AI.exe",
          },
          targets: ["C:\\tmp\\bios-ai-installer-smoke\\Program\\BIOS AI.exe"],
        }),
      /stale development or smoke target/,
    );
  });

  it("fails release proof when Windows registration exposes multiple app targets", async () => {
    await assert.rejects(
      () =>
        verifyBiosAiWindowsRegistrationProof("E:\\repo", {
          buildIdentity: {
            releaseExePath: "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bios-ai.exe",
            setupExePath:
              "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bundle\\nsis\\BIOS AI.exe",
          },
          targets: [
            "C:\\Program Files\\BIOS AI\\bios-ai.exe",
            "C:\\Users\\midni\\AppData\\Local\\BIOS AI Current\\BIOS AI.exe",
          ],
        }),
      /multiple installed app targets/,
    );
  });
});
