import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiElectronRuntimePackageGate } from "../../scripts/bios-ai-electron-runtime-package-gate.mjs";

async function writeFixtureFile(root, relativePath, content = "fixture\n") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function createAppFixture(root) {
  for (const file of [
    "aether-canvas/electron/main.mjs",
    "aether-canvas/electron/preload.cjs",
    "aether-canvas/electron/spike-runtime.mjs",
    "aether-canvas/electron/worker-runtime.mjs",
    "aether-canvas/dist/index.html",
  ]) {
    await writeFixtureFile(root, file);
  }
}

async function createRuntimeFixture(root, platform = process.platform) {
  const files = [
    "node_modules/electron/path.txt",
    platform === "win32"
      ? "node_modules/electron/dist/electron.exe"
      : "node_modules/electron/dist/electron",
    platform === "win32"
      ? "node_modules/.bin/electron-builder.CMD"
      : "node_modules/.bin/electron-builder",
  ];
  for (const file of files) {
    await writeFixtureFile(root, file);
  }
  await writeFixtureFile(
    root,
    "node_modules/electron/package.json",
    JSON.stringify({ version: "42.2.0" }),
  );
  await writeFixtureFile(
    root,
    "node_modules/electron-builder/package.json",
    JSON.stringify({ version: "26.8.1" }),
  );
}

describe("BIOS AI Electron runtime package gate", () => {
  it("blocks when Electron runtime files and app files are missing", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-runtime-missing-")),
    );

    const report = await verifyBiosAiElectronRuntimePackageGate(fixtureRoot, {
      writeReport: false,
      throwOnFailure: false,
      runVersionChecks: false,
      runLaunchSmoke: false,
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks[0].status, "fail");
    assert.equal(report.checks[1].status, "fail");
    assert.ok(
      report.checks[0].missing.some((entry) => entry.file === "node_modules/electron/package.json"),
    );
    assert.ok(
      report.checks[1].missing.some((entry) => entry.file === "aether-canvas/dist/index.html"),
    );
  });

  it("reports missing Electron runtime file labels instead of object placeholders", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-runtime-message-")),
    );

    await assert.rejects(
      () =>
        verifyBiosAiElectronRuntimePackageGate(fixtureRoot, {
          writeReport: false,
          runVersionChecks: false,
          runLaunchSmoke: false,
        }),
      (error) => {
        assert.match(
          error.message,
          /Electron runtime package: node_modules\/electron\/package\.json/,
        );
        assert.doesNotMatch(error.message, /\[object Object\]/);
        return true;
      },
    );
  });

  it("passes when Electron, builder, and hidden app launch smoke are proved", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-runtime-pass-")),
    );
    await createAppFixture(fixtureRoot);
    await createRuntimeFixture(fixtureRoot);

    const report = await verifyBiosAiElectronRuntimePackageGate(fixtureRoot, {
      writeReport: false,
      runProcess: async (_command, args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE_REPORT) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({
              status: "pass",
              appName: "BIOS AI",
              sidecarProof: { status: "pass" },
            }),
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return {
          status: "pass",
          exitCode: 0,
          timedOut: false,
          stdout: args.includes("--version") ? "v42.2.0\n26.8.1\n" : "",
          stderr: "",
        };
      },
    });

    assert.equal(report.status, "pass");
    assert.equal(
      report.checks.every((check) => check.status === "pass"),
      true,
    );
  });

  it("passes the no-sandbox flag for Linux hosted runner Electron probes", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-runtime-linux-")),
    );
    await createAppFixture(fixtureRoot);
    await createRuntimeFixture(fixtureRoot, "linux");
    const calls = [];

    await verifyBiosAiElectronRuntimePackageGate(fixtureRoot, {
      platform: "linux",
      writeReport: false,
      runProcess: async (_command, args, options = {}) => {
        calls.push(args);
        if (options.env?.BIOS_AI_ELECTRON_SMOKE_REPORT) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({
              status: "pass",
              appName: "BIOS AI",
              sidecarProof: { status: "pass" },
            }),
          );
        }
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "v42.2.0\n", stderr: "" };
      },
    });

    assert.deepEqual(calls[0], ["--no-sandbox", "--version"]);
    assert.equal(calls[1][0], "--no-sandbox");
    assert.match(calls[1][1], /aether-canvas[\\/]+electron[\\/]+main\.mjs$/);
  });

  it("keeps the gate blocked when launch smoke cannot prove the BIOS renderer loaded", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-runtime-launch-fail-")),
    );
    await createAppFixture(fixtureRoot);
    await createRuntimeFixture(fixtureRoot);

    const report = await verifyBiosAiElectronRuntimePackageGate(fixtureRoot, {
      writeReport: false,
      throwOnFailure: false,
      runProcess: async (_command, _args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE_REPORT) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({ status: "fail", error: "renderer did not load" }),
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "v42.2.0\n", stderr: "" };
      },
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
  });

  it("keeps the gate blocked when Electron reports renderer IPC handler errors", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-runtime-handler-fail-")),
    );
    await createAppFixture(fixtureRoot);
    await createRuntimeFixture(fixtureRoot);

    const report = await verifyBiosAiElectronRuntimePackageGate(fixtureRoot, {
      writeReport: false,
      throwOnFailure: false,
      runProcess: async (_command, _args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE_REPORT) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({
              status: "pass",
              appName: "BIOS AI",
              sidecarProof: { status: "pass" },
            }),
          );
          return {
            status: "pass",
            exitCode: 0,
            timedOut: false,
            stdout: "",
            stderr: "Error occurred in handler for 'bios-ai:invoke'",
          };
        }
        return {
          status: "pass",
          exitCode: 0,
          timedOut: false,
          stdout: "v42.2.0\n26.8.1\n",
          stderr: "",
        };
      },
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
  });
});
