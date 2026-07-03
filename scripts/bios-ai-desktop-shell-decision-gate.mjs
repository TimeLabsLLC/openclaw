import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ELECTRON_SHELL_DECISION_CRITERIA,
  ELECTRON_SHELL_SPIKE_COMMANDS,
  recommendedDesktopShell,
} from "../aether-canvas/electron/bridge-contract.mjs";

const RESEARCH_DOC =
  "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_desktop_shell_research_2026_06_26.md";
const MIGRATION_PLAN_DOC =
  "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_electron_shell_migration_plan.md";
const DESKTOP_SHELL_APP_TARGETS = "packages/desktop-shell/src/app-targets.ts";
const DESKTOP_SHELL_CONTRACT = "packages/desktop-shell/src/contract.ts";
const ELECTRON_MAIN = "aether-canvas/electron/main.mjs";
const ELECTRON_PRELOAD = "aether-canvas/electron/preload.cjs";
const ELECTRON_RUNTIME = "aether-canvas/electron/spike-runtime.mjs";
const ELECTRON_SIDECAR = "aether-canvas/electron/bios-sidecar.mjs";
const ELECTRON_WORKER_RUNTIME = "aether-canvas/electron/worker-runtime.mjs";
const TAURI_LIB = "aether-canvas/src-tauri/src/lib.rs";

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function missingNeedles(source, needles) {
  return needles.filter((needle) => !source.includes(needle));
}

function summarizeCheck(name, missing = [], details = {}) {
  return {
    name,
    status: missing.length === 0 ? "pass" : "fail",
    missing,
    ...details,
  };
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-desktop-shell-decision-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    `BIOS AI desktop shell decision gate failed:\n${failures
      .map((check) => `${check.name}: ${check.missing.join(", ")}`)
      .join("\n")}`,
  );
}

export async function verifyBiosAiDesktopShellDecisionGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const files = {
    researchDoc: await readRepoFile(repoRoot, RESEARCH_DOC),
    migrationPlanDoc: await readRepoFile(repoRoot, MIGRATION_PLAN_DOC),
    desktopShellAppTargets: await readRepoFile(repoRoot, DESKTOP_SHELL_APP_TARGETS),
    desktopShellContract: await readRepoFile(repoRoot, DESKTOP_SHELL_CONTRACT),
    electronMain: await readRepoFile(repoRoot, ELECTRON_MAIN),
    electronPreload: await readRepoFile(repoRoot, ELECTRON_PRELOAD),
    electronRuntime: await readRepoFile(repoRoot, ELECTRON_RUNTIME),
    electronSidecar: await readRepoFile(repoRoot, ELECTRON_SIDECAR),
    electronWorkerRuntime: await readRepoFile(repoRoot, ELECTRON_WORKER_RUNTIME),
    tauriLib: await readRepoFile(repoRoot, TAURI_LIB),
  };
  const decision = recommendedDesktopShell(params.criteria ?? ELECTRON_SHELL_DECISION_CRITERIA);
  const commandCoverage = ELECTRON_SHELL_SPIKE_COMMANDS.filter(
    (command) =>
      files.electronRuntime.includes(`case "${command}"`) ||
      files.electronSidecar.includes(`case "${command}"`),
  );
  const checks = [
    summarizeCheck(
      "Migration plan extends the existing desktop-shell owner instead of creating a split-brain shell",
      missingNeedles(files.migrationPlanDoc, [
        "The existing desktop shell subsystem owns this migration",
        "`packages/desktop-shell/**`",
        "No new top-level module is needed for the migration",
        "Tauri remains allowed only as fallback until Electron package proof passes",
      ]),
      { file: MIGRATION_PLAN_DOC },
    ),
    summarizeCheck(
      "Desktop-shell contract exposes a BIOS AI app target",
      missingNeedles(files.desktopShellAppTargets, [
        "DesktopShellAppTargetId",
        `"bios-ai"`,
        "aether-canvas/dist/index.html",
        "tauri-compatible-invoke",
        "packageProofRequired: true",
      ]),
      { file: DESKTOP_SHELL_APP_TARGETS },
    ),
    summarizeCheck(
      "Desktop-shell review artifacts include app target and package proof truth",
      missingNeedles(files.desktopShellContract, [
        "appTarget: DesktopShellManifest",
        "App target:",
        "Product surface:",
        "Package proof required:",
      ]),
      { file: DESKTOP_SHELL_CONTRACT },
    ),
    summarizeCheck(
      "Research doc compares Tauri, Electron, and native sidecar tradeoffs",
      missingNeedles(files.researchDoc, [
        "Electron shell + native sidecar services",
        "Tauri/NSIS build wrapper exceeded",
        "Do not replace Tauri until the Electron proof-of-parity spike passes",
        "package/rebuild loop is measurably faster than current Tauri path",
      ]),
      { file: RESEARCH_DOC },
    ),
    summarizeCheck(
      "Electron main process uses a locked-down browser window",
      missingNeedles(files.electronMain, [
        "contextIsolation: true",
        "nodeIntegration: false",
        "sandbox: true",
        "webSecurity: true",
        "ipcMain.handle(\"bios-ai:invoke\"",
      ]),
      { file: ELECTRON_MAIN },
    ),
    summarizeCheck(
      "Electron preload exposes only a Tauri-compatible invoke bridge",
      missingNeedles(files.electronPreload, [
        "contextBridge.exposeInMainWorld(\"__TAURI__\"",
        "ipcRenderer.invoke(\"bios-ai:invoke\"",
        "kind: \"electron-spike\"",
      ]),
      { file: ELECTRON_PRELOAD },
    ),
    summarizeCheck(
      "Electron spike blocks native mutations until sidecars own them",
      [
        ...missingNeedles(files.electronRuntime, [
          "isBiosSidecarCommand(command)",
          "invokeBiosSidecarCommand(command, payload)",
        ]),
        ...(files.electronRuntime.includes('case "chat_with_local_worker"')
          ? ["spike runtime still has a chat bypass case"]
          : []),
      ],
      { file: ELECTRON_RUNTIME },
    ),
    summarizeCheck(
      "Electron sidecar blocks boxed-lane repair until a repair owner is wired",
      missingNeedles(files.electronSidecar, [
        "electron-main-sidecar",
        "blocked_without_repair_owner",
        "runBiosSidecarSmokeProof",
      ]),
      { file: ELECTRON_SIDECAR },
    ),
    summarizeCheck(
      "Electron worker runtime owns GPU-first managed BOSS chat",
      missingNeedles(files.electronWorkerRuntime, [
        "chatWithLocalWorker",
        "--gpu-layers",
        "999",
        "--flash-attn",
        "boss_brain",
        "local-worker-state.json",
        "BIOS AI refused the managed local BOSS runtime",
      ]),
      { file: ELECTRON_WORKER_RUNTIME },
    ),
    summarizeCheck(
      "Electron bridge covers the first product-flow command slice",
      ELECTRON_SHELL_SPIKE_COMMANDS.length === commandCoverage.length
        ? []
        : ELECTRON_SHELL_SPIKE_COMMANDS.filter((command) => !commandCoverage.includes(command)),
      { coveredCommands: commandCoverage },
    ),
    summarizeCheck(
      "Tauri command owner remains present for parity mapping",
      missingNeedles(files.tauriLib, ["tauri::generate_handler!", "bios_runtime_status", "chat_with_local_worker"]),
      { file: TAURI_LIB },
    ),
    summarizeCheck(
      "Decision score recommends the migration path only after criteria beat Tauri",
      decision.recommendation === "move_to_electron_shell_with_native_sidecars"
        ? []
        : ["electron score did not beat tauri score"],
      { decision },
    ),
  ];

  const report = {
    repoRoot: path.resolve(repoRoot),
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    owner: "scripts/bios-ai-desktop-shell-decision-gate.mjs",
    recommendation: decision.recommendation,
    score: decision.score,
    criteria: params.criteria ?? ELECTRON_SHELL_DECISION_CRITERIA,
    commandSlice: ELECTRON_SHELL_SPIKE_COMMANDS,
    nextVerticalSlice:
      "Migrate BIOS AI to an Electron app shell while moving native OS/model/boxed-lane work behind sidecar service contracts.",
    checks,
  };
  if (params.writeReport !== false) {
    report.outputPath = await writeReport(repoRoot, report);
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
  const result = await verifyBiosAiDesktopShellDecisionGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
