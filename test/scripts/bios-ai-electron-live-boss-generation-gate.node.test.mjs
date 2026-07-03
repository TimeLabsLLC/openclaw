import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiElectronLiveBossGenerationGate } from "../../scripts/bios-ai-electron-live-boss-generation-gate.mjs";

async function writeFixtureFile(root, relativePath, content = "fixture\n") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("BIOS AI Electron live BOSS generation gate", () => {
  it("blocks by default instead of launching a local model", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-live-blocked-")),
    );
    const exe = path.join(fixtureRoot, "BIOS AI.exe");
    const model = path.join(fixtureRoot, "gemma-3-1b-it-Q4_K_M.gguf");
    await writeFixtureFile("", exe);
    await writeFixtureFile("", model);

    const report = await verifyBiosAiElectronLiveBossGenerationGate(fixtureRoot, {
      executablePath: exe,
      modelPath: model,
      writeReport: false,
      throwOnFailure: false,
      env: {},
    });

    assert.equal(report.status, "blocked");
    assert.match(report.checks[0].missing[0], /BIOS_AI_ELECTRON_LIVE_BOSS_PROOF=1/);
  });

  it("passes when the packaged app smoke returns a live BOSS response", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-live-pass-")),
    );
    const exe = path.join(fixtureRoot, "BIOS AI.exe");
    const model = path.join(fixtureRoot, "gemma-3-1b-it-Q4_K_M.gguf");
    await writeFixtureFile("", exe);
    await writeFixtureFile("", model);

    const report = await verifyBiosAiElectronLiveBossGenerationGate(fixtureRoot, {
      executablePath: exe,
      modelPath: model,
      writeReport: false,
      env: { BIOS_AI_ELECTRON_LIVE_BOSS_PROOF: "1" },
      runProcess: async (_command, _args, options = {}) => {
        assert.equal(options.env.BIOS_AI_ELECTRON_SMOKE_COMMAND, "chat_with_local_worker");
        const payload = JSON.parse(options.env.BIOS_AI_ELECTRON_SMOKE_PAYLOAD);
        assert.equal(payload.workerRole, "boss_brain");
        assert.equal(payload.profileId, "electron-live-boss");
        await writeFixtureFile(
          "",
          options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
          JSON.stringify({
            status: "pass",
            commandProof: {
              status: "pass",
              command: "chat_with_local_worker",
              payloadSummary: {
                profileId: "electron-live-boss",
                workerRole: "boss_brain",
                messageCount: 1,
              },
              result: "BIOS AI packaged Electron BOSS generation is working.",
            },
          }),
        );
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
      },
    });

    assert.equal(report.status, "pass");
    assert.equal(report.checks.at(-1).status, "pass");
  });
});
