import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function defaultInstallerPath(repoRoot) {
  return path.join(
    repoRoot,
    ".artifacts",
    "desktop-shell",
    "bios-ai-electron-installer",
    "BIOS AI Setup 0.1.0.exe",
  );
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        status: "fail",
        exitCode: null,
        timedOut,
        stdout,
        stderr,
        error: error.message,
      });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        status: !timedOut && exitCode === 0 ? "pass" : "fail",
        exitCode,
        timedOut,
        stdout,
        stderr,
      });
    });
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function powershellJson(script) {
  return [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `${script} | ConvertTo-Json -Depth 6 -Compress`,
  ];
}

async function readWindowsRegistrationSnapshot(runner = runProcess) {
  const script = `
$items = @()
foreach ($root in @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')) {
  Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq 'BIOS AI' -or $_.DisplayName -like 'BIOS AI *' } |
    ForEach-Object {
      $items += [pscustomobject]@{
        Root = if ($_.PSPath -like '*HKEY_CURRENT_USER*') { 'HKCU' } else { 'HKLM' }
        Key = $_.PSChildName
        DisplayName = $_.DisplayName
        DisplayVersion = $_.DisplayVersion
        InstallLocation = $_.InstallLocation
        DisplayIcon = $_.DisplayIcon
        UninstallString = $_.UninstallString
        QuietUninstallString = $_.QuietUninstallString
      }
    }
}
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'BIOS AI.lnk'
$shortcutTarget = $null
if (Test-Path $shortcutPath) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcutTarget = $shell.CreateShortcut($shortcutPath).TargetPath
}
[pscustomobject]@{
  Registrations = $items
  Desktop = $desktop
  ShortcutPath = $shortcutPath
  ShortcutExists = Test-Path $shortcutPath
  ShortcutTarget = $shortcutTarget
}`;
  const result = await runner("powershell.exe", powershellJson(script), {
    timeoutMs: 30_000,
  });
  if (result.status !== "pass") {
    return {
      status: "fail",
      error: result.stderr || result.stdout || "registration snapshot failed",
      registrations: [],
    };
  }
  try {
    return {
      status: "pass",
      ...JSON.parse(result.stdout || "{}"),
    };
  } catch (error) {
    return {
      status: "fail",
      error: error.message,
      registrations: [],
    };
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function stripWrappingQuotes(value) {
  return String(value || "").replace(/^"|"$/g, "");
}

function normalizedFilePath(value) {
  return stripWrappingQuotes(value).replace(/\//g, "\\").toLowerCase();
}

function selectProofRegistration(snapshot, before = null) {
  const beforeLocations = new Set(
    normalizeArray(before?.Registrations)
      .map((entry) => normalizedFilePath(entry.InstallLocation || entry.DisplayIcon))
      .filter(Boolean),
  );
  const hkcuRegistrations = normalizeArray(snapshot.Registrations).filter(
    (entry) => entry.Root === "HKCU" && (entry.InstallLocation || entry.DisplayIcon || entry.UninstallString),
  );
  return (
    hkcuRegistrations.find(
      (entry) =>
        /bios-ai-electron-shell/i.test(
          `${entry.InstallLocation || ""} ${entry.DisplayIcon || ""} ${entry.QuietUninstallString || ""} ${entry.UninstallString || ""}`,
        ) ||
        !beforeLocations.has(normalizedFilePath(entry.InstallLocation)) ||
        /uninstall/i.test(String(entry.QuietUninstallString || entry.UninstallString || "")),
    ) || hkcuRegistrations[0]
  );
}

function executableFromDisplayIcon(value) {
  const raw = stripWrappingQuotes(String(value || "").replace(/,0$/, ""));
  if (!raw || !raw.toLowerCase().endsWith(".exe")) {
    return "";
  }
  return raw;
}

function installedExeFromSnapshot(snapshot, before = null) {
  const registration = selectProofRegistration(snapshot, before);
  if (!registration) {
    return "";
  }
  const iconExe = executableFromDisplayIcon(registration.DisplayIcon);
  if (iconExe) {
    return iconExe;
  }
  if (!registration.InstallLocation) {
    return "";
  }
  return path.join(stripWrappingQuotes(registration.InstallLocation), "BIOS AI.exe");
}

function installedSidecarPath(installedExe) {
  if (!installedExe) {
    return null;
  }
  return path.join(
    path.dirname(installedExe),
    "resources",
    "bin",
    process.platform === "win32" ? "llama-server.exe" : "llama-server",
  );
}

function hasElectronProofRegistration(snapshot) {
  return normalizeArray(snapshot?.Registrations).some((entry) =>
    /bios-ai-electron-shell/i.test(
      `${entry.InstallLocation || ""} ${entry.DisplayIcon || ""} ${entry.QuietUninstallString || ""} ${entry.UninstallString || ""}`,
    ),
  );
}

function shortcutMatches(snapshot, expected) {
  return (
    snapshot?.ShortcutExists === expected?.ShortcutExists &&
    normalizedFilePath(snapshot?.ShortcutTarget) === normalizedFilePath(expected?.ShortcutTarget)
  );
}

function registrationsMatch(snapshot, expected) {
  const actual = normalizeArray(snapshot?.Registrations);
  const wanted = normalizeArray(expected?.Registrations);
  if (actual.length !== wanted.length) {
    return false;
  }
  return wanted.every((expectedEntry) =>
    actual.some(
      (actualEntry) =>
        actualEntry.Root === expectedEntry.Root &&
        actualEntry.DisplayName === expectedEntry.DisplayName &&
        normalizedFilePath(actualEntry.DisplayIcon) === normalizedFilePath(expectedEntry.DisplayIcon) &&
        normalizedFilePath(actualEntry.InstallLocation) === normalizedFilePath(expectedEntry.InstallLocation) &&
        normalizedFilePath(actualEntry.UninstallString) === normalizedFilePath(expectedEntry.UninstallString),
    ),
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSnapshot(readSnapshot, predicate, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 500;
  const startedAt = Date.now();
  let attempts = 0;
  let latest = null;
  do {
    attempts += 1;
    latest = await readSnapshot();
    if (predicate(latest)) {
      return {
        status: "pass",
        snapshot: latest,
        attempts,
        elapsedMs: Date.now() - startedAt,
      };
    }
    if (Date.now() - startedAt >= timeoutMs) {
      break;
    }
    await sleep(pollMs);
  } while (true);
  return {
    status: "fail",
    snapshot: latest,
    attempts,
    elapsedMs: Date.now() - startedAt,
  };
}

function uninstallerFromSnapshot(snapshot, before = null) {
  const registration = selectProofRegistration(snapshot, before);
  if (!registration) {
    return "";
  }
  const raw = registration.QuietUninstallString || registration.UninstallString;
  const match = /^"([^"]+)"/.exec(raw) || /^([^\s]+)/.exec(raw);
  return match?.[1] || "";
}

async function readSmokeReport(reportPath) {
  try {
    return JSON.parse(await readFile(reportPath, "utf8"));
  } catch (error) {
    return {
      status: "fail",
      error: error.message,
    };
  }
}

function hasPassingSidecarProof(smokeReport) {
  return smokeReport?.sidecarProof?.status === "pass";
}

function powershellString(value) {
  return `'${String(value || "").replaceAll("'", "''")}'`;
}

async function restoreWindowsRegistrationSnapshot(snapshot, runner = runProcess) {
  const registrations = normalizeArray(snapshot?.Registrations);
  const hkcu = registrations.find((entry) => entry.Root === "HKCU");
  const lines = ["$ErrorActionPreference='Stop'"];
  if (hkcu) {
    lines.push("$key='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BIOS AI'");
    lines.push("New-Item -Path $key -Force | Out-Null");
    for (const [name, value] of Object.entries({
      DisplayName: hkcu.DisplayName,
      DisplayVersion: hkcu.DisplayVersion,
      InstallLocation: hkcu.InstallLocation,
      DisplayIcon: hkcu.DisplayIcon,
      UninstallString: hkcu.UninstallString,
      QuietUninstallString: hkcu.QuietUninstallString,
    })) {
      if (value != null && value !== "") {
        lines.push(`Set-ItemProperty -Path $key -Name ${powershellString(name)} -Value ${powershellString(value)}`);
      }
    }
  }
  if (snapshot?.ShortcutPath && snapshot?.ShortcutTarget) {
    lines.push(`$shortcutPath=${powershellString(snapshot.ShortcutPath)}`);
    lines.push(`$targetPath=${powershellString(snapshot.ShortcutTarget)}`);
    lines.push("$shell=New-Object -ComObject WScript.Shell");
    lines.push("$shortcut=$shell.CreateShortcut($shortcutPath)");
    lines.push("$shortcut.TargetPath=$targetPath");
    lines.push("$shortcut.WorkingDirectory=Split-Path -Parent $targetPath");
    lines.push("$shortcut.Save()");
  }
  lines.push("[pscustomobject]@{ Restored=$true }");
  return runner("powershell.exe", powershellJson(lines.join("\n")), {
    timeoutMs: 30_000,
  });
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-electron-install-registration-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    `BIOS AI Electron install registration gate failed:\n${failures
      .map((check) => `${check.name}: ${check.missing.join(", ")}`)
      .join("\n")}`,
  );
}

export async function verifyBiosAiElectronInstallRegistrationGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const env = params.env ?? process.env;
  const installerPath = path.resolve(params.installerPath || defaultInstallerPath(normalizedRoot));
  const runner = params.runProcess ?? runProcess;
  const readSnapshot = params.readSnapshot ?? (() => readWindowsRegistrationSnapshot(runner));
  const allowHostMutation = env.BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_HOST_MUTATION === "1";
  const checks = [
    {
      name: "BIOS AI current-user installer artifact exists before host registration proof",
      status: (await fileExists(installerPath)) ? "pass" : "fail",
      missing: (await fileExists(installerPath)) ? [] : [installerPath],
      installerPath,
    },
  ];

  if (!allowHostMutation) {
    checks.push({
      name: "Host install/uninstall proof requires explicit mutation opt-in",
      status: "fail",
      missing: ["Set BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_HOST_MUTATION=1 to run host install proof"],
    });
    const report = {
      repoRoot: normalizedRoot,
      generatedAt: new Date().toISOString(),
      status: "blocked",
      owner: "scripts/bios-ai-electron-install-registration-gate.mjs",
      target: "bios-ai",
      shell: "electron",
      packageKind: "host install/uninstall registration proof",
      installerPath,
      checks,
    };
    if (params.writeReport !== false) {
      report.outputPath = await writeReport(normalizedRoot, report);
    }
    if (params.throwOnFailure !== false) {
      assertPass(report);
    }
    return report;
  }

  const before = await readSnapshot();
  const beforeRegistrations = normalizeArray(before.Registrations);
  const beforeHasBiosAi =
    beforeRegistrations.length > 0 || before.ShortcutExists === true;
  const allowOverwrite = env.BIOS_AI_ELECTRON_INSTALLER_PROOF_ALLOW_OVERWRITE === "1";
  const restorePreexisting = beforeHasBiosAi && env.BIOS_AI_ELECTRON_INSTALLER_PROOF_RESTORE_PREEXISTING !== "0";
  checks.push({
    name: "Host is clean of preexisting BIOS AI registrations and desktop shortcut before mutation",
    status: beforeHasBiosAi && !allowOverwrite ? "fail" : "pass",
    missing: beforeHasBiosAi && !allowOverwrite
      ? ["preexisting BIOS AI registration or desktop shortcut would make install proof unsafe"]
      : [],
    before,
    allowOverwrite,
    restorePreexisting,
  });
  if (beforeHasBiosAi && !allowOverwrite) {
    const report = {
      repoRoot: normalizedRoot,
      generatedAt: new Date().toISOString(),
      status: "blocked",
      owner: "scripts/bios-ai-electron-install-registration-gate.mjs",
      target: "bios-ai",
      shell: "electron",
      packageKind: "host install/uninstall registration proof",
      installerPath,
      before,
      checks,
    };
    if (params.writeReport !== false) {
      report.outputPath = await writeReport(normalizedRoot, report);
    }
    if (params.throwOnFailure !== false) {
      assertPass(report);
    }
    return report;
  }

  const installResult = await runner(installerPath, ["/S"], {
    cwd: path.dirname(installerPath),
    timeoutMs: params.installTimeoutMs ?? 180_000,
    env,
  });
  checks.push({
    name: "Silent current-user installer exits cleanly",
    status: installResult.status,
    missing: installResult.status === "pass" ? [] : ["installer /S failed"],
    exitCode: installResult.exitCode,
    timedOut: installResult.timedOut,
    stdout: String(installResult.stdout || "").trim().slice(0, 1000),
    stderr: String(installResult.stderr || "").trim().slice(0, 1000),
  });

  const afterInstall = await readSnapshot();
  const registrations = normalizeArray(afterInstall.Registrations);
  const hkcuRegistrations = registrations.filter((entry) => entry.Root === "HKCU");
  const hklmRegistrations = registrations.filter((entry) => entry.Root === "HKLM");
  const proofRegistration = selectProofRegistration(afterInstall, before);
  const proofRegistrations = proofRegistration ? [proofRegistration] : [];
  const oldRegistrations = hkcuRegistrations.filter((entry) => entry !== proofRegistration);
  const installedExe = installedExeFromSnapshot(afterInstall, before);
  checks.push({
    name: restorePreexisting
      ? "Install creates one Electron proof HKCU registration and no HKLM BIOS AI app"
      : "Install registers exactly one HKCU BIOS AI app and no HKLM BIOS AI app",
    status:
      (restorePreexisting
        ? proofRegistrations.length === 1 && hklmRegistrations.length === 0
        : hkcuRegistrations.length === 1 && hklmRegistrations.length === 0)
        ? "pass"
        : "fail",
    missing:
      (restorePreexisting
        ? proofRegistrations.length === 1 && hklmRegistrations.length === 0
        : hkcuRegistrations.length === 1 && hklmRegistrations.length === 0)
        ? []
        : ["expected one proof HKCU registration and zero HKLM registrations"],
    registrations,
    proofRegistration,
    oldRegistrations,
  });
  checks.push({
    name: "Install creates one BIOS AI desktop shortcut",
    status: afterInstall.ShortcutExists === true ? "pass" : "fail",
    missing: afterInstall.ShortcutExists === true ? [] : [afterInstall.ShortcutPath || "BIOS AI.lnk"],
    shortcutPath: afterInstall.ShortcutPath,
  });
  checks.push({
    name: "Installed BIOS AI executable exists",
    status: installedExe && (await fileExists(installedExe)) ? "pass" : "fail",
    missing: installedExe && (await fileExists(installedExe)) ? [] : [installedExe || "installed exe"],
    installedExe,
  });
  const installedSidecar = installedSidecarPath(installedExe);
  checks.push({
    name: "Installed BIOS AI includes the llama.cpp worker sidecar binary",
    status: installedSidecar && (await fileExists(installedSidecar)) ? "pass" : "fail",
    missing:
      installedSidecar && (await fileExists(installedSidecar))
        ? []
        : [installedSidecar || "installed worker sidecar"],
    installedSidecar,
  });

  if (installedExe && (await fileExists(installedExe))) {
    const smokeReportPath = path.join(
      normalizedRoot,
      "runtime",
      "outputs",
      "bios-ai-electron-installed-launch-smoke.json",
    );
    const launchResult = await runner(installedExe, [], {
      cwd: path.dirname(installedExe),
      timeoutMs: params.launchTimeoutMs ?? 60_000,
      env: {
        ...env,
        BIOS_AI_ELECTRON_SMOKE: "1",
        BIOS_AI_ELECTRON_SMOKE_EXIT_MS: "1200",
        BIOS_AI_ELECTRON_SMOKE_REPORT: smokeReportPath,
      },
    });
    const smokeReport = await readSmokeReport(smokeReportPath);
    checks.push({
      name: "Installed BIOS AI executable launches the real renderer in hidden smoke mode",
      status:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        hasPassingSidecarProof(smokeReport)
          ? "pass"
          : "fail",
      missing:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        hasPassingSidecarProof(smokeReport)
          ? []
          : ["installed executable launch smoke or sidecar proof failed"],
      exitCode: launchResult.exitCode,
      timedOut: launchResult.timedOut,
      smokeReportPath,
      smokeReport,
      stdout: String(launchResult.stdout || "").trim().slice(0, 1000),
      stderr: String(launchResult.stderr || "").trim().slice(0, 1000),
    });
  }

  const uninstallerPath = uninstallerFromSnapshot(afterInstall, before);
  const uninstallResult = uninstallerPath
    ? await runner(uninstallerPath, ["/S"], {
        cwd: path.dirname(uninstallerPath),
        timeoutMs: params.uninstallTimeoutMs ?? 180_000,
        env,
      })
    : { status: "fail", exitCode: null, timedOut: false, stdout: "", stderr: "missing uninstaller" };
  checks.push({
    name: "Silent uninstaller exits cleanly",
    status: uninstallResult.status,
    missing: uninstallResult.status === "pass" ? [] : ["uninstaller /S failed"],
    uninstallerPath,
    exitCode: uninstallResult.exitCode,
    timedOut: uninstallResult.timedOut,
    stdout: String(uninstallResult.stdout || "").trim().slice(0, 1000),
    stderr: String(uninstallResult.stderr || "").trim().slice(0, 1000),
  });

  const uninstallCleanup = await waitForSnapshot(
    readSnapshot,
    (snapshot) => {
      const remainingRegistrations = normalizeArray(snapshot.Registrations);
      return restorePreexisting
        ? !hasElectronProofRegistration(snapshot)
        : remainingRegistrations.length === 0 && snapshot.ShortcutExists !== true;
    },
    {
      timeoutMs: params.uninstallCleanupTimeoutMs ?? 30_000,
      pollMs: params.snapshotPollMs ?? 500,
    },
  );
  const afterUninstall = uninstallCleanup.snapshot;
  const remainingAfterUninstall = normalizeArray(afterUninstall.Registrations);
  const proofStillPresent = hasElectronProofRegistration(afterUninstall);
  checks.push({
    name: restorePreexisting
      ? "Uninstall removes Electron proof registration before restoring preexisting BIOS AI state"
      : "Uninstall removes BIOS AI HKCU registration and desktop shortcut",
    status:
      (restorePreexisting
        ? !proofStillPresent
        : remainingAfterUninstall.length === 0 && afterUninstall.ShortcutExists !== true)
        ? "pass"
        : "fail",
    missing:
      (restorePreexisting
        ? !proofStillPresent
        : remainingAfterUninstall.length === 0 && afterUninstall.ShortcutExists !== true)
        ? []
        : ["proof registration or shortcut remained after uninstall"],
    afterUninstall,
    cleanupWait: uninstallCleanup,
  });

  let afterRestore = null;
  if (restorePreexisting) {
    const restoreResult = await (params.restoreSnapshot ?? restoreWindowsRegistrationSnapshot)(
      before,
      runner,
    );
    const restoreCleanup = await waitForSnapshot(
      readSnapshot,
      (snapshot) =>
        !hasElectronProofRegistration(snapshot) &&
        registrationsMatch(snapshot, before) &&
        shortcutMatches(snapshot, before),
      {
        timeoutMs: params.restoreCleanupTimeoutMs ?? 30_000,
        pollMs: params.snapshotPollMs ?? 500,
      },
    );
    afterRestore = restoreCleanup.snapshot;
    const restoredRegistrations = normalizeArray(afterRestore.Registrations);
    const restored =
      restoreResult.status === "pass" &&
      restoredRegistrations.length === beforeRegistrations.length &&
      registrationsMatch(afterRestore, before) &&
      shortcutMatches(afterRestore, before) &&
      !hasElectronProofRegistration(afterRestore);
    checks.push({
      name: "Proof run restores the preexisting BIOS AI registration and desktop shortcut",
      status: restored ? "pass" : "fail",
      missing: restored ? [] : ["preexisting BIOS AI state was not restored after proof"],
      restoreResult: {
        status: restoreResult.status,
        exitCode: restoreResult.exitCode,
        timedOut: restoreResult.timedOut,
        stdout: String(restoreResult.stdout || "").trim().slice(0, 1000),
        stderr: String(restoreResult.stderr || "").trim().slice(0, 1000),
      },
      afterRestore,
      restoreWait: restoreCleanup,
    });
  }

  const report = {
    repoRoot: normalizedRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-electron-install-registration-gate.mjs",
    target: "bios-ai",
    shell: "electron",
    packageKind: "host install/uninstall registration proof",
    installerPath,
    before,
    afterRestore,
    checks,
  };
  if (params.writeReport !== false) {
    report.outputPath = await writeReport(normalizedRoot, report);
  }
  if (params.throwOnFailure !== false) {
    assertPass(report);
  }
  return report;
}

function isMainModule() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiElectronInstallRegistrationGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
