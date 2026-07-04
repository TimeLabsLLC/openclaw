import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiElectronPackageArtifactGate } from "./bios-ai-electron-package-artifact-gate.mjs";
import { verifyBiosAiElectronProductFlowGate } from "./bios-ai-electron-product-flow-gate.mjs";
import { verifyBiosAiElectronRuntimePackageGate } from "./bios-ai-electron-runtime-package-gate.mjs";

const SUPPORTED_PLATFORMS = new Set(["win32", "darwin", "linux"]);
const REQUIRED_WORKFLOW_OSES = ["windows-latest", "macos-15-intel", "ubuntu-24.04"];
const ELECTRON_PACKAGE_ROOT = path.join(".artifacts", "desktop-shell", "bios-ai-electron-package");
const PROOF_MODEL_FILE_NAME = "gemma-3-1b-it-Q4_K_M.gguf";
const PLATFORM_ARTIFACTS = {
  win32: [
    {
      relativePath: path.join(ELECTRON_PACKAGE_ROOT, "win-unpacked", "BIOS AI.exe"),
      label: "Windows Electron executable",
    },
    {
      relativePath: path.join(
        ELECTRON_PACKAGE_ROOT,
        "win-unpacked",
        "resources",
        "bin",
        "llama-server.exe",
      ),
      label: "Windows llama.cpp sidecar binary",
    },
  ],
  darwin: [
    {
      relativePath: path.join(
        ELECTRON_PACKAGE_ROOT,
        "mac",
        "BIOS AI.app",
        "Contents",
        "MacOS",
        "BIOS AI",
      ),
      label: "macOS BIOS AI app executable",
    },
    {
      relativePath: path.join(
        ELECTRON_PACKAGE_ROOT,
        "mac",
        "BIOS AI.app",
        "Contents",
        "Resources",
        "bin",
        "llama-server",
      ),
      label: "macOS llama.cpp sidecar binary",
    },
  ],
  linux: [
    {
      relativePath: path.join(ELECTRON_PACKAGE_ROOT, "linux-unpacked", "bios-ai"),
      label: "Linux Electron executable",
    },
    {
      relativePath: path.join(
        ELECTRON_PACKAGE_ROOT,
        "linux-unpacked",
        "resources",
        "bin",
        "llama-server",
      ),
      label: "Linux llama.cpp sidecar binary",
    },
  ],
};

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function runCommand(command, args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: options.env,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`Command failed with exit code ${code ?? -1}: ${command} ${args.join(" ")}`),
      );
    });
  });
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function directorySize(root) {
  if (!(await pathExists(root))) {
    return 0;
  }
  const entries = await readdir(root, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(entryPath);
      continue;
    }
    if (entry.isFile()) {
      total += (await stat(entryPath)).size;
    }
  }
  return total;
}

async function inspectArtifact(repoRoot, rule) {
  const artifactPath = path.join(repoRoot, rule.relativePath);
  assertCondition(await pathExists(artifactPath), `Missing ${rule.label}: ${rule.relativePath}`);
  const artifactStat = await stat(artifactPath);
  return {
    label: rule.label,
    path: rule.relativePath,
    size: artifactStat.isDirectory() ? await directorySize(artifactPath) : artifactStat.size,
  };
}

async function prepareProofModelDirectory(repoRoot, params = {}) {
  if (params.skipProofModel === true) {
    return null;
  }
  const proofModelDir = path.join(repoRoot, "runtime", "outputs", "bios-ai-proof-models");
  await mkdir(proofModelDir, { recursive: true });
  const proofModelPath = path.join(proofModelDir, PROOF_MODEL_FILE_NAME);
  if (!(await pathExists(proofModelPath))) {
    await writeFile(
      proofModelPath,
      "BIOS AI packaged product-flow proof model placeholder; not a real inference model.\n",
      "utf8",
    );
  }
  return proofModelDir;
}

export async function inspectBiosAiCrossOsPackageArtifacts(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const platform = params.platform ?? process.platform;
  assertCondition(
    SUPPORTED_PLATFORMS.has(platform),
    `Unsupported BIOS AI package platform: ${platform}`,
  );
  const rules = params.artifactRules ?? PLATFORM_ARTIFACTS[platform];
  return Promise.all(rules.map((rule) => inspectArtifact(repoRoot, rule)));
}

export function assertBiosAiPackageTargetConfig(config, platform = process.platform) {
  assertCondition(
    SUPPORTED_PLATFORMS.has(platform),
    `Unsupported BIOS AI package platform: ${platform}`,
  );
  assertCondition(
    config?.shell === "electron",
    "BIOS AI package readiness must target the Electron shell",
  );
  assertCondition(
    Array.isArray(config.workflowOses),
    "BIOS AI package readiness config missing workflow OS matrix",
  );
  for (const osName of REQUIRED_WORKFLOW_OSES) {
    assertCondition(
      config.workflowOses.includes(osName),
      `BIOS AI workflow missing hosted runner: ${osName}`,
    );
  }
  return {
    shell: config.shell,
    workflowOses: config.workflowOses,
    platformArtifacts: PLATFORM_ARTIFACTS[platform].map((rule) => rule.label),
  };
}

async function readWorkflowOsMatrix(repoRoot) {
  const workflowPath = path.join(
    repoRoot,
    ".github",
    "workflows",
    "bios-ai-cross-os-package-readiness.yml",
  );
  const workflowText = await readFile(workflowPath, "utf8");
  const oses = REQUIRED_WORKFLOW_OSES.filter((osName) => workflowText.includes(osName));
  return {
    path: ".github/workflows/bios-ai-cross-os-package-readiness.yml",
    oses,
    provesElectron:
      workflowText.includes("bios-ai-cross-os-package-readiness.mjs") &&
      workflowText.includes("bios-ai-electron-package"),
  };
}

export async function verifyBiosAiCrossOsPackageReadiness(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const platform = params.platform ?? process.platform;
  assertCondition(
    SUPPORTED_PLATFORMS.has(platform),
    `Unsupported BIOS AI package platform: ${platform}`,
  );
  const normalizedRoot = path.resolve(repoRoot);
  const runCommandImpl = params.runCommand ?? runCommand;
  const env = {
    ...process.env,
    ...(params.env ?? {}),
  };
  const proofModelDir = await prepareProofModelDirectory(normalizedRoot, params);
  if (proofModelDir && !env.BIOS_AI_MODELS_DIR) {
    env.BIOS_AI_MODELS_DIR = proofModelDir;
  }

  const workflow = params.workflow ?? (await readWorkflowOsMatrix(normalizedRoot));
  const targetConfig = assertBiosAiPackageTargetConfig(
    { shell: "electron", workflowOses: workflow.oses },
    platform,
  );
  assertCondition(
    workflow.provesElectron,
    "BIOS AI cross-OS workflow is not wired to Electron package proof",
  );

  if (params.skipPrepareDist !== true) {
    await runCommandImpl(
      process.execPath,
      [path.join("aether-canvas", "scripts", "prepare-dist.mjs")],
      normalizedRoot,
      {
        env,
      },
    );
  }

  const runtimeReport = await (params.runRuntimeGate ?? verifyBiosAiElectronRuntimePackageGate)(
    normalizedRoot,
    {
      env,
      platform,
      runLaunchSmoke: params.runLaunchSmoke,
      smokeExitMs: params.smokeExitMs,
    },
  );
  const packageReport = await (params.runPackageGate ?? verifyBiosAiElectronPackageArtifactGate)(
    normalizedRoot,
    {
      env,
      platform,
      runLaunchSmoke: params.runPackageLaunchSmoke,
      smokeExitMs: params.smokeExitMs,
    },
  );
  const productFlowReport =
    params.skipProductFlowProof === true
      ? {
          status: "skipped",
          reason: "caller skipped visible product-flow proof",
        }
      : await (params.runProductFlowGate ?? verifyBiosAiElectronProductFlowGate)(normalizedRoot, {
          env,
          platform,
        });

  const artifacts = await inspectBiosAiCrossOsPackageArtifacts(normalizedRoot, {
    platform,
    artifactRules: params.artifactRules,
  });
  const result = {
    app: "BIOS AI",
    platform,
    proofLevel: "github-hosted-runner-electron-package-readiness",
    status:
      runtimeReport.status === "pass" &&
      packageReport.status === "pass" &&
      (productFlowReport.status === "pass" || productFlowReport.status === "skipped")
        ? "ready"
        : "blocked",
    shell: "electron",
    workflow,
    configuredTargets: targetConfig,
    runtimeReportStatus: runtimeReport.status,
    packageReportStatus: packageReport.status,
    productFlowReportStatus: productFlowReport.status,
    artifacts,
    gates: [
      "Electron runtime package gate",
      "Electron unpacked package artifact gate",
      "Visible packaged product-flow proof",
    ],
    bypassPolicy:
      "Tauri release-path proof is demoted and cannot satisfy BIOS AI V1 package readiness.",
    nonClaims: [
      "not Apple notarization",
      "not Windows code signing",
      "not a guarantee for every end-user machine",
      "not proof that every optional local model is already downloaded",
      "product-flow proof uses a placeholder GGUF marker when hosted runners do not have a real model cache",
      "not proof that every optional boxed-lane substrate is preinstalled",
    ],
  };

  if (params.summaryPath) {
    await mkdir(path.dirname(params.summaryPath), { recursive: true });
    await writeFile(params.summaryPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  assertCondition(
    result.status === "ready",
    "BIOS AI cross-OS Electron package readiness is blocked",
  );
  return result;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    switch (arg) {
      case "--repo-root":
        parsed.repoRoot = path.resolve(value);
        index += 1;
        break;
      case "--platform":
        parsed.platform = value;
        index += 1;
        break;
      case "--summary":
        parsed.summaryPath = path.resolve(value);
        index += 1;
        break;
      case "--skip-prepare-dist":
        parsed.skipPrepareDist = true;
        break;
      case "--skip-product-flow-proof":
        parsed.skipProductFlowProof = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function isMainModule() {
  const argv1 = process.argv[1];
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyBiosAiCrossOsPackageReadiness(
    args.repoRoot ?? resolveRepoRoot(),
    args,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
