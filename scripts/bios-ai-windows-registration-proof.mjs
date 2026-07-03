import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function normalizePath(value) {
  return String(value || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\//g, "\\")
    .toLowerCase();
}

function isForbiddenSmokeTarget(target) {
  const normalized = normalizePath(target);
  return (
    normalized.includes("\\tmp\\bios-ai-installer-smoke\\") ||
    normalized.includes("\\temp\\bios-ai-installer-smoke\\") ||
    normalized.includes("\\target\\release\\") ||
    normalized.includes("\\src-tauri\\target\\")
  );
}

export function analyzeBiosAiRegistrationTargets(targets, buildIdentity) {
  const uniqueTargets = [...new Set((targets || []).map(String).filter(Boolean))];
  const releaseExePath = normalizePath(buildIdentity?.releaseExePath);
  const setupExePath = normalizePath(buildIdentity?.setupExePath);
  const forbiddenTargets = uniqueTargets.filter(isForbiddenSmokeTarget);
  const currentInstallTargets = uniqueTargets.filter((target) => {
    const normalized = normalizePath(target);
    if (!normalized.endsWith("\\bios ai.exe") && !normalized.endsWith("\\bios-ai.exe")) {
      return false;
    }
    return !isForbiddenSmokeTarget(normalized) && normalized !== releaseExePath && normalized !== setupExePath;
  });
  const normalizedCurrentTargets = [...new Set(currentInstallTargets.map(normalizePath))];
  const splitBrainTargets = normalizedCurrentTargets.length > 1 ? currentInstallTargets : [];

  return {
    status:
      forbiddenTargets.length > 0
        ? "blocked"
        : splitBrainTargets.length > 0
          ? "split_brain"
          : currentInstallTargets.length > 0
          ? "verified"
          : "not_installed",
    targets: uniqueTargets,
    forbiddenTargets,
    currentInstallTargets,
    splitBrainTargets,
  };
}

function readWindowsRegistrationTargets() {
  if (process.platform !== "win32") {
    return [];
  }
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$targets=@()",
    "$shortcutRoots=@($env:APPDATA + '\\Microsoft\\Windows\\Start Menu\\Programs',$env:ProgramData + '\\Microsoft\\Windows\\Start Menu\\Programs',[Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))",
    "$shell=New-Object -ComObject WScript.Shell",
    "foreach($root in $shortcutRoots){ if(Test-Path $root){ Get-ChildItem -Path $root -Filter '*BIOS AI*.lnk' -Recurse | ForEach-Object { $targets += $shell.CreateShortcut($_.FullName).TargetPath } } }",
    "$uninstallRoots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
    "foreach($root in $uninstallRoots){ Get-ItemProperty $root | Where-Object { $_.DisplayName -eq 'BIOS AI' } | ForEach-Object { if($_.DisplayIcon){ $targets += $_.DisplayIcon }; if($_.InstallLocation){ $targets += (Join-Path $_.InstallLocation 'BIOS AI.exe') } } }",
    "$targets | Where-Object { $_ } | Sort-Object -Unique | ConvertTo-Json -Compress",
  ].join("; ");
  const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function verifyBiosAiWindowsRegistrationProof(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const targets = params.targets ?? readWindowsRegistrationTargets();
  const analysis = analyzeBiosAiRegistrationTargets(targets, buildIdentity);
  if (analysis.forbiddenTargets.length) {
    throw new Error(
      `BIOS AI Windows registration points at a stale development or smoke target: ${analysis.forbiddenTargets.join(", ")}`,
    );
  }
  if (analysis.splitBrainTargets.length) {
    throw new Error(
      `BIOS AI Windows registration has multiple installed app targets: ${analysis.splitBrainTargets.join(", ")}`,
    );
  }
  return {
    repoRoot: path.resolve(repoRoot),
    windowsRegistrationProof: analysis.status,
    targets: analysis.targets,
    currentInstallTargets: analysis.currentInstallTargets,
    packagedExeProof: buildIdentity.releaseExePath,
  };
}

function isMainModule() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiWindowsRegistrationProof();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
