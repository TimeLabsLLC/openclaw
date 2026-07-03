import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiElectronInstallRegistrationGate } from "../../scripts/bios-ai-electron-install-registration-gate.mjs";

async function writeFixtureFile(root, relativePath, content = "fixture\n") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("BIOS AI Electron install registration gate", () => {
  it("blocks by default instead of mutating the host", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-install-blocked-")),
    );
    const installerPath = path.join(fixtureRoot, "BIOS AI Setup 0.1.0.exe");
    await writeFixtureFile("", installerPath);

    const report = await verifyBiosAiElectronInstallRegistrationGate(fixtureRoot, {
      installerPath,
      writeReport: false,
      throwOnFailure: false,
      env: {},
    });

    assert.equal(report.status, "blocked");
    assert.match(report.checks.at(-1).missing[0], /ALLOW_HOST_MUTATION=1/i);
  });

  it("proves install, HKCU registration, launch, uninstall, and cleanup when explicitly allowed", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-install-pass-")),
    );
    const installerPath = path.join(fixtureRoot, "BIOS AI Setup 0.1.0.exe");
    const installRoot = path.join(fixtureRoot, "bios-ai-electron-shell");
    const installedExe = path.join(installRoot, "BIOS AI.exe");
    const installedSidecar = path.join(installRoot, "resources", "bin", "llama-server.exe");
    const uninstaller = path.join(installRoot, "Uninstall BIOS AI.exe");
    await writeFixtureFile("", installerPath);

    const snapshots = [
      { Registrations: [], Desktop: fixtureRoot, ShortcutPath: path.join(fixtureRoot, "BIOS AI.lnk"), ShortcutExists: false },
      {
        Registrations: [
          {
            Root: "HKCU",
            DisplayName: "BIOS AI 0.1.0",
            InstallLocation: null,
            DisplayIcon: `${installedExe},0`,
            UninstallString: `"${uninstaller}"`,
            QuietUninstallString: `"${uninstaller}" /S`,
          },
        ],
        Desktop: fixtureRoot,
        ShortcutPath: path.join(fixtureRoot, "BIOS AI.lnk"),
        ShortcutExists: true,
      },
      { Registrations: [], Desktop: fixtureRoot, ShortcutPath: path.join(fixtureRoot, "BIOS AI.lnk"), ShortcutExists: false },
    ];

    const report = await verifyBiosAiElectronInstallRegistrationGate(fixtureRoot, {
      installerPath,
      writeReport: false,
      env: { BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_HOST_MUTATION: "1" },
      readSnapshot: async () => snapshots.shift(),
      runProcess: async (command, _args, options = {}) => {
        if (command === installerPath) {
          await writeFixtureFile("", installedExe);
          await writeFixtureFile("", installedSidecar);
          await writeFixtureFile("", uninstaller);
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        if (command === installedExe) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({ status: "pass", appName: "BIOS AI", sidecarProof: { status: "pass" } }),
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        if (command === uninstaller) {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return { status: "fail", exitCode: 1, timedOut: false, stdout: "", stderr: "unexpected" };
      },
    });

    assert.equal(report.status, "pass");
    assert.ok(
      report.checks.some(
        (check) => check.name === "Install registers exactly one HKCU BIOS AI app and no HKLM BIOS AI app",
      ),
    );
  });

  it("blocks host mutation when a BIOS AI registration or shortcut already exists", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-install-preexisting-")),
    );
    const installerPath = path.join(fixtureRoot, "BIOS AI Setup 0.1.0.exe");
    await writeFixtureFile("", installerPath);

    const report = await verifyBiosAiElectronInstallRegistrationGate(fixtureRoot, {
      installerPath,
      writeReport: false,
      throwOnFailure: false,
      env: { BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_HOST_MUTATION: "1" },
      readSnapshot: async () => ({
        Registrations: [{ Root: "HKCU", DisplayName: "BIOS AI", InstallLocation: "C:\\Existing" }],
        Desktop: fixtureRoot,
        ShortcutPath: path.join(fixtureRoot, "BIOS AI.lnk"),
        ShortcutExists: true,
      }),
      runProcess: async () => {
        throw new Error("installer should not run when preexisting BIOS AI state is present");
      },
    });

    assert.equal(report.status, "blocked");
    assert.match(report.checks.at(-1).missing[0], /preexisting BIOS AI/i);
  });

  it("can run overwrite proof and restore preexisting BIOS AI state", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-install-restore-")),
    );
    const installerPath = path.join(fixtureRoot, "BIOS AI Setup 0.1.0.exe");
    const oldRoot = path.join(fixtureRoot, "old");
    const oldExe = path.join(oldRoot, "BIOS AI.exe");
    const installRoot = path.join(fixtureRoot, "bios-ai-electron-shell");
    const installedExe = path.join(installRoot, "BIOS AI.exe");
    const installedSidecar = path.join(installRoot, "resources", "bin", "llama-server.exe");
    const uninstaller = path.join(installRoot, "Uninstall BIOS AI.exe");
    const shortcutPath = path.join(fixtureRoot, "BIOS AI.lnk");
    await writeFixtureFile("", installerPath);
    await writeFixtureFile("", oldExe);

    const before = {
      Registrations: [
        {
          Root: "HKCU",
          DisplayName: "BIOS AI",
          InstallLocation: oldRoot,
          DisplayIcon: `"${oldExe}"`,
          UninstallString: `"${oldExe}"`,
        },
      ],
      Desktop: fixtureRoot,
      ShortcutPath: shortcutPath,
      ShortcutExists: true,
      ShortcutTarget: oldExe,
    };
    const afterInstall = {
      Registrations: [
        {
          Root: "HKCU",
          DisplayName: "BIOS AI 0.1.0",
          InstallLocation: null,
          DisplayIcon: `${installedExe},0`,
          UninstallString: `"${uninstaller}"`,
          QuietUninstallString: `"${uninstaller}" /S`,
        },
      ],
      Desktop: fixtureRoot,
      ShortcutPath: shortcutPath,
      ShortcutExists: true,
      ShortcutTarget: installedExe,
    };
    const afterUninstall = {
      Registrations: [],
      Desktop: fixtureRoot,
      ShortcutPath: shortcutPath,
      ShortcutExists: false,
      ShortcutTarget: null,
    };
    const snapshots = [before, afterInstall, afterUninstall, before];

    const report = await verifyBiosAiElectronInstallRegistrationGate(fixtureRoot, {
      installerPath,
      writeReport: false,
      env: {
        BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_HOST_MUTATION: "1",
        BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_OVERWRITE: "1",
      },
      readSnapshot: async () => snapshots.shift(),
      restoreSnapshot: async () => ({
        status: "pass",
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: "",
      }),
      runProcess: async (command, _args, options = {}) => {
        if (command === installerPath) {
          await writeFixtureFile("", installedExe);
          await writeFixtureFile("", installedSidecar);
          await writeFixtureFile("", uninstaller);
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        if (command === installedExe) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({ status: "pass", appName: "BIOS AI", sidecarProof: { status: "pass" } }),
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        if (command === uninstaller) {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return { status: "fail", exitCode: 1, timedOut: false, stdout: "", stderr: "unexpected" };
      },
    });

    assert.equal(report.status, "pass");
    assert.ok(
      report.checks.some(
        (check) => check.name === "Proof run restores the preexisting BIOS AI registration and desktop shortcut",
      ),
    );
  });

  it("waits for delayed NSIS cleanup before restoring preexisting state", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-install-delayed-cleanup-")),
    );
    const installerPath = path.join(fixtureRoot, "BIOS AI Setup 0.1.0.exe");
    const oldRoot = path.join(fixtureRoot, "old");
    const oldExe = path.join(oldRoot, "BIOS AI.exe");
    const installRoot = path.join(fixtureRoot, "bios-ai-electron-shell");
    const installedExe = path.join(installRoot, "BIOS AI.exe");
    const installedSidecar = path.join(installRoot, "resources", "bin", "llama-server.exe");
    const uninstaller = path.join(installRoot, "Uninstall BIOS AI.exe");
    const shortcutPath = path.join(fixtureRoot, "BIOS AI.lnk");
    await writeFixtureFile("", installerPath);
    await writeFixtureFile("", oldExe);

    const before = {
      Registrations: [
        {
          Root: "HKCU",
          DisplayName: "BIOS AI",
          InstallLocation: oldRoot,
          DisplayIcon: `"${oldExe}"`,
          UninstallString: `"${oldExe}"`,
        },
      ],
      Desktop: fixtureRoot,
      ShortcutPath: shortcutPath,
      ShortcutExists: true,
      ShortcutTarget: oldExe,
    };
    const afterInstall = {
      Registrations: [
        {
          Root: "HKCU",
          DisplayName: "BIOS AI 0.1.0",
          InstallLocation: null,
          DisplayIcon: `${installedExe},0`,
          UninstallString: `"${uninstaller}"`,
          QuietUninstallString: `"${uninstaller}" /S`,
        },
      ],
      Desktop: fixtureRoot,
      ShortcutPath: shortcutPath,
      ShortcutExists: true,
      ShortcutTarget: installedExe,
    };
    const delayedAfterUninstall = {
      ...afterInstall,
      ShortcutExists: false,
      ShortcutTarget: null,
    };
    const cleanedAfterUninstall = {
      Registrations: [],
      Desktop: fixtureRoot,
      ShortcutPath: shortcutPath,
      ShortcutExists: false,
      ShortcutTarget: null,
    };
    const snapshots = [before, afterInstall, delayedAfterUninstall, cleanedAfterUninstall, before];

    const report = await verifyBiosAiElectronInstallRegistrationGate(fixtureRoot, {
      installerPath,
      writeReport: false,
      snapshotPollMs: 1,
      env: {
        BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_HOST_MUTATION: "1",
        BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_OVERWRITE: "1",
      },
      readSnapshot: async () => snapshots.shift(),
      restoreSnapshot: async () => ({
        status: "pass",
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: "",
      }),
      runProcess: async (command, _args, options = {}) => {
        if (command === installerPath) {
          await writeFixtureFile("", installedExe);
          await writeFixtureFile("", installedSidecar);
          await writeFixtureFile("", uninstaller);
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        if (command === installedExe) {
          await writeFixtureFile(
            "",
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            JSON.stringify({ status: "pass", appName: "BIOS AI", sidecarProof: { status: "pass" } }),
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        if (command === uninstaller) {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        return { status: "fail", exitCode: 1, timedOut: false, stdout: "", stderr: "unexpected" };
      },
    });

    assert.equal(report.status, "pass");
    const cleanupCheck = report.checks.find((check) =>
      check.name.startsWith("Uninstall removes Electron proof registration"),
    );
    assert.equal(cleanupCheck.cleanupWait.attempts, 2);
  });
});
