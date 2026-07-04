import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiElectronPackageArtifactGate } from "../../scripts/bios-ai-electron-package-artifact-gate.mjs";

async function writeFixtureFile(root, relativePath, content = "fixture\n") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

function packagedExePath(outputRoot) {
  if (process.platform === "win32") {
    return path.join(outputRoot, "win-unpacked", "BIOS AI.exe");
  }
  if (process.platform === "darwin") {
    return path.join(outputRoot, "mac", "BIOS AI.app", "Contents", "MacOS", "Electron");
  }
  return path.join(outputRoot, "linux-unpacked", "bios-ai");
}

function packagedSidecarPath(outputRoot) {
  if (process.platform === "darwin") {
    return path.join(
      outputRoot,
      "mac",
      "BIOS AI.app",
      "Contents",
      "Resources",
      "bin",
      "llama-server",
    );
  }
  const unpackedDir = process.platform === "win32" ? "win-unpacked" : "linux-unpacked";
  return path.join(
    outputRoot,
    unpackedDir,
    "resources",
    "bin",
    process.platform === "win32" ? "llama-server.exe" : "llama-server",
  );
}

function packagedSidecarCompanionPath(outputRoot) {
  if (process.platform !== "win32") {
    return null;
  }
  return path.join(outputRoot, "win-unpacked", "resources", "bin", "llama-common.dll");
}

async function writeStagedAppFixture(stageRoot) {
  await writeFixtureFile(stageRoot, "dist/index.html");
  await writeFixtureFile(stageRoot, "electron/main.mjs");
  await writeFixtureFile(
    stageRoot,
    path.join(
      "resources",
      "bin",
      process.platform === "win32" ? "llama-server.exe" : "llama-server",
    ),
  );
  if (process.platform === "win32") {
    await writeFixtureFile(stageRoot, path.join("resources", "bin", "llama-common.dll"));
  }
}

async function writeElectronDistributionFixture(dependencyRoot) {
  const executableName = process.platform === "win32" ? "electron.exe" : "electron";
  await writeFixtureFile(
    dependencyRoot,
    path.join("node_modules", "electron", "dist", executableName),
  );
}

async function writePackagedArtifactFixture(outputRoot) {
  await writeFixtureFile("", packagedExePath(outputRoot));
  await writeFixtureFile("", packagedSidecarPath(outputRoot));
  const companionPath = packagedSidecarCompanionPath(outputRoot);
  if (companionPath) {
    await writeFixtureFile("", companionPath);
  }
}

describe("BIOS AI Electron package artifact gate", () => {
  it("stages a dependency-stable package contract so package proof cannot install inside the app stage", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-contract-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");

    await writeFixtureFile(fixtureRoot, "aether-canvas/dist/index.html");
    await writeFixtureFile(fixtureRoot, "aether-canvas/electron/main.mjs");
    await writeFixtureFile(
      fixtureRoot,
      path.join(
        "aether-canvas",
        "src-tauri",
        "resources",
        "bin",
        process.platform === "win32" ? "llama-server.exe" : "llama-server",
      ),
    );
    const dependencyRoot = path.join(fixtureRoot, "deps");
    await writeElectronDistributionFixture(dependencyRoot);

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      outputRoot,
      env: { AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT: dependencyRoot },
      writeReport: false,
      throwOnFailure: false,
      runLaunchSmoke: false,
      packageApp: async (actualDependencyRoot, stageRoot, actualOutputRoot) => {
        assert.equal(actualDependencyRoot, dependencyRoot);
        await writePackagedArtifactFixture(actualOutputRoot);
        const args = ["--config", path.join(stageRoot, "electron-builder.json")];
        const options = { cwd: stageRoot };
        const packageJson = JSON.parse(
          await readFile(path.join(options.cwd, "package.json"), "utf8"),
        );
        const configPath = args.at(args.indexOf("--config") + 1);
        const builderConfig = JSON.parse(await readFile(configPath, "utf8"));

        assert.equal(packageJson.packageManager, "pnpm@10.33.2");
        assert.deepEqual(packageJson.dependencies, {});
        assert.deepEqual(packageJson.devDependencies, {});
        assert.equal(builderConfig.npmRebuild, false);
        assert.equal(builderConfig.nodeGypRebuild, false);
        assert.equal(builderConfig.buildDependenciesFromSource, false);
      },
    });

    assert.equal(report.status, "pass");
  });

  it("passes when the staged app builds and the packaged executable launches cleanly", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-pass-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      outputRoot,
      writeReport: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        await writePackagedArtifactFixture(actualOutputRoot);
      },
      runProcess: async (_command, _args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE) {
          assert.ok(options.env.BIOS_AI_ELECTRON_USER_DATA_DIR);
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
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "built", stderr: "" };
      },
    });

    assert.equal(report.status, "pass");
    assert.ok(report.checks.some((check) => check.name === "Packaged BIOS AI executable exists"));
    assert.ok(
      report.checks.some(
        (check) => check.name === "Packaged BIOS AI includes the llama.cpp runtime companion files",
      ),
    );
  });

  it("uses the native Electron executable inside macOS app bundles", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-macos-executable-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");
    const executablePath = path.join(
      outputRoot,
      "mac",
      "BIOS AI.app",
      "Contents",
      "MacOS",
      "Electron",
    );
    const sidecarPath = path.join(
      outputRoot,
      "mac",
      "BIOS AI.app",
      "Contents",
      "Resources",
      "bin",
      "llama-server",
    );
    await writeFixtureFile(fixtureRoot, "aether-canvas/dist/index.html");
    await writeFixtureFile(fixtureRoot, "aether-canvas/electron/main.mjs");
    await writeFixtureFile(
      fixtureRoot,
      path.join("aether-canvas", "src-tauri", "resources", "bin", "llama-server"),
    );

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      platform: "darwin",
      outputRoot,
      writeReport: false,
      runLaunchSmoke: false,
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        assert.equal(actualOutputRoot, outputRoot);
        await writeFixtureFile("", executablePath);
        await writeFixtureFile("", sidecarPath);
      },
    });

    assert.equal(report.status, "pass");
    assert.equal(report.checks[2].executablePath, executablePath);
  });

  it("copies macOS Electron support files into app and framework resources", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-macos-support-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");
    const stageRoot = path.join(fixtureRoot, "stage");
    const dependencyRoot = path.join(fixtureRoot, "deps");
    await writeFixtureFile(stageRoot, "dist/index.html");
    await writeFixtureFile(stageRoot, "electron/main.mjs");
    await writeFixtureFile(stageRoot, path.join("resources", "bin", "llama-server"));
    await writeFixtureFile(
      dependencyRoot,
      "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    );
    await writeFixtureFile(
      dependencyRoot,
      "node_modules/electron/dist/Electron.app/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist",
    );
    await writeFixtureFile(dependencyRoot, "node_modules/electron/dist/icudtl.dat", "icu");

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      platform: "darwin",
      stageRoot,
      outputRoot,
      env: { AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT: dependencyRoot },
      writeReport: false,
      runLaunchSmoke: false,
      stageApp: async () => {},
      writeBuilderConfig: async () => path.join(stageRoot, "electron-builder.json"),
    });

    assert.equal(report.status, "pass");
    assert.equal(
      await readFile(
        path.join(
          outputRoot,
          "mac",
          "BIOS AI.app",
          "Contents",
          "Frameworks",
          "Electron Framework.framework",
          "Resources",
          "icudtl.dat",
        ),
        "utf8",
      ),
      "icu",
    );
    assert.equal(
      await readFile(
        path.join(outputRoot, "mac", "BIOS AI.app", "Contents", "Resources", "icudtl.dat"),
        "utf8",
      ),
      "icu",
    );
  });

  it("passes no-sandbox to packaged Linux launch smoke", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-linux-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");
    const launchArgs = [];

    await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      platform: "linux",
      outputRoot,
      writeReport: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeFixtureFile(stageRoot, "dist/index.html");
        await writeFixtureFile(stageRoot, "electron/main.mjs");
        await writeFixtureFile(stageRoot, path.join("resources", "bin", "llama-server"));
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        await writeFixtureFile("", path.join(actualOutputRoot, "linux-unpacked", "bios-ai"));
        await writeFixtureFile(
          "",
          path.join(actualOutputRoot, "linux-unpacked", "resources", "bin", "llama-server"),
        );
      },
      runProcess: async (_command, args, options = {}) => {
        launchArgs.push(args);
        if (options.env?.BIOS_AI_ELECTRON_SMOKE) {
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
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
      },
    });

    assert.equal(launchArgs[0][0], "--no-sandbox");
  });

  it("blocks when electron-builder does not produce the executable artifact", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-missing-exe-")),
    );

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      writeReport: false,
      throwOnFailure: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async () => {},
      runProcess: async () => ({
        status: "pass",
        exitCode: 0,
        timedOut: false,
        stdout: "built without exe",
        stderr: "",
      }),
    });

    assert.equal(report.status, "blocked");
    assert.equal(
      report.checks.find((check) => check.name === "Packaged BIOS AI executable exists").status,
      "fail",
    );
  });

  it("blocks when the packaged app launch emits an IPC handler error", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-handler-error-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      outputRoot,
      writeReport: false,
      throwOnFailure: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        await writePackagedArtifactFixture(actualOutputRoot);
      },
      runProcess: async (_command, _args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE) {
          assert.ok(options.env.BIOS_AI_ELECTRON_USER_DATA_DIR);
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
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "built", stderr: "" };
      },
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
  });

  it("blocks when the packaged app smoke omits sidecar proof", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-no-sidecar-proof-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      outputRoot,
      writeReport: false,
      throwOnFailure: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        await writePackagedArtifactFixture(actualOutputRoot);
      },
      runProcess: async (_command, _args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({ status: "pass", appName: "BIOS AI" }),
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "built", stderr: "" };
      },
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
    assert.match(report.checks.at(-1).missing[0], /sidecar proof/i);
  });

  it("blocks when the packaged app exits without a passing smoke report", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-no-report-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      outputRoot,
      writeReport: false,
      throwOnFailure: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        await writePackagedArtifactFixture(actualOutputRoot);
      },
      runProcess: async (_command, _args, options = {}) => {
        if (options.env?.BIOS_AI_ELECTRON_SMOKE) {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "built", stderr: "" };
      },
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
  });

  it("blocks instead of trusting a stale packaged launch smoke report", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-package-stale-report-")),
    );
    const outputRoot = path.join(fixtureRoot, "out");
    const staleReport = path.join(
      fixtureRoot,
      "runtime",
      "outputs",
      "bios-ai-electron-packaged-launch-smoke.json",
    );
    await writeFixtureFile(
      "",
      staleReport,
      JSON.stringify({ status: "pass", sidecarProof: { status: "pass" } }),
    );

    const report = await verifyBiosAiElectronPackageArtifactGate(fixtureRoot, {
      outputRoot,
      writeReport: false,
      throwOnFailure: false,
      stageApp: async (_repoRoot, stageRoot) => {
        await writeStagedAppFixture(stageRoot);
      },
      writeBuilderConfig: async (stageRoot) => {
        await writeFixtureFile(stageRoot, "electron-builder.json", "{}");
        return path.join(stageRoot, "electron-builder.json");
      },
      packageApp: async (_dependencyRoot, _stageRoot, actualOutputRoot) => {
        await writePackagedArtifactFixture(actualOutputRoot);
      },
      runProcess: async () => ({
        status: "fail",
        exitCode: null,
        timedOut: true,
        stdout: "",
        stderr: "",
      }),
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).status, "fail");
    assert.equal(report.checks.at(-1).smokeReport.status, "fail");
  });
});
