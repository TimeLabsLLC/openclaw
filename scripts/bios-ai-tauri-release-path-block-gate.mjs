import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";

const RELEASE_OWNER_FILES = [
  "scripts/bios-ai-build-identity.mjs",
  "scripts/bios-ai-release-smoke.mjs",
  "scripts/bios-ai-release-smoke.cmd",
  "scripts/bios-ai-release-smoke.ps1",
  "package.json",
];

const FORBIDDEN_RELEASE_PATTERNS = [
  /src-tauri[\\/]+target[\\/]+release/i,
  /target[\\/]+release[\\/]+bundle[\\/]+nsis/i,
  /cargo\s+tauri/i,
  /tauri\s+build/i,
  /@tauri-apps\/cli.*bios-ai/i,
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function scanForbiddenReleasePatterns(relativePath, source) {
  return FORBIDDEN_RELEASE_PATTERNS.map((pattern) => {
    const match = source.match(pattern);
    return match ? { file: relativePath, pattern: pattern.source, match: match[0] } : null;
  }).filter(Boolean);
}

function identityUsesElectron(identity) {
  const joined = `${identity?.shell || ""} ${identity?.releaseExePath || ""} ${identity?.setupExePath || ""}`;
  return (
    identity?.shell === "electron" &&
    /desktop-shell[\\/]+bios-ai-electron-package/i.test(joined) &&
    !/src-tauri[\\/]+target[\\/]+release|target[\\/]+release[\\/]+bundle[\\/]+nsis/i.test(joined)
  );
}

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (!failures.length) {
    return;
  }
  throw new Error(
    `BIOS AI Tauri release-path block gate failed:\n${failures
      .map((check) => `${check.name}: ${JSON.stringify(check.failures || check.missing || [])}`)
      .join("\n")}`,
  );
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-tauri-release-path-block-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

export async function verifyBiosAiTauriReleasePathBlockGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const identity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(normalizedRoot, params));
  const fileFindings = [];
  for (const relativePath of params.releaseOwnerFiles ?? RELEASE_OWNER_FILES) {
    const source = await readRepoFile(normalizedRoot, relativePath);
    fileFindings.push(...scanForbiddenReleasePatterns(relativePath, source));
  }
  const checks = [
    {
      name: "Canonical BIOS AI build identity proves Electron artifacts",
      status: identityUsesElectron(identity) ? "pass" : "fail",
      failures: identityUsesElectron(identity) ? [] : [identity],
    },
    {
      name: "Release owner files do not invoke or claim Tauri release artifacts",
      status: fileFindings.length === 0 ? "pass" : "fail",
      failures: fileFindings,
    },
  ];
  const report = {
    repoRoot: normalizedRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-tauri-release-path-block-gate.mjs",
    target: "bios-ai",
    releaseShell: "electron",
    blockedShell: "tauri",
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
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiTauriReleasePathBlockGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
