import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiElectronInstallerArtifactGate } from "../../scripts/bios-ai-electron-installer-artifact-gate.mjs";

async function writeFixtureFile(root, relativePath, content = "fixture\n") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function writeStagedInstallerAppFixture(stageRoot) {
  await writeFixtureFile(stageRoot, "dist/index.html");
  await writeFixtureFile(stageRoot, "electron/main.mjs");
  await writeFixtureFile(stageRoot, "resources/bin/llama-server.exe");
}

describe("BIOS AI Electron installer artifact gate", () => {
  it("passes when current-user NSIS config builds the expected installer artifact", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-installer-pass-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");

    const report = await verifyBiosAiElectronInstallerArtifactGate(fixtureRoot, {
      outputRoot,
      writeReport: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedInstallerAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      runProcess: async () => {
        await writeFixtureFile("", path.join(outputRoot, "BIOS AI Setup 0.1.0.exe"));
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "built", stderr: "" };
      },
    });

    assert.equal(report.status, "pass");
    const config = report.checks[0].config;
    assert.equal(config.oneClick, true);
    assert.equal(config.perMachine, false);
    assert.equal(config.allowElevation, false);
    assert.equal(config.shortcutName, "BIOS AI");
    assert.equal(config.createDesktopShortcut, "always");
    assert.deepEqual(report.config.extraResources, [{ from: "resources/bin", to: "bin" }]);
  });

  it("blocks when the installer executable is not produced", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-installer-missing-")),
    );

    const report = await verifyBiosAiElectronInstallerArtifactGate(fixtureRoot, {
      writeReport: false,
      throwOnFailure: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedInstallerAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      runProcess: async () => ({
        status: "pass",
        exitCode: 0,
        timedOut: false,
        stdout: "built without installer",
        stderr: "",
      }),
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
  });
});
