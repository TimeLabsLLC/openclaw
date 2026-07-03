import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function packagedExecutablePath(repoRoot, platform = process.platform) {
  if (platform === "win32") {
    return path.join(
      repoRoot,
      ".artifacts",
      "desktop-shell",
      "bios-ai-electron-package",
      "win-unpacked",
      "BIOS AI.exe",
    );
  }
  if (platform === "darwin") {
    return path.join(
      repoRoot,
      ".artifacts",
      "desktop-shell",
      "bios-ai-electron-package",
      "mac",
      "BIOS AI.app",
      "Contents",
      "MacOS",
      "BIOS AI",
    );
  }
  return path.join(
    repoRoot,
    ".artifacts",
    "desktop-shell",
    "bios-ai-electron-package",
    "linux-unpacked",
    "bios-ai",
  );
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
      resolve({ status: "fail", exitCode: null, timedOut, stdout, stderr, error: error.message });
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

const MODEL_SEARCH_DIRS = [
  process.env.BIOS_AI_MODELS_DIR,
  "E:/BIOS AI/models",
  path.join(os.homedir(), ".agentos", "bios-ai", "models"),
  path.join(os.homedir(), ".bios-ai", "models"),
].filter(Boolean);

const RETURNING_USER_MODEL_CANDIDATES = [
  {
    variant: "gemma-3-1b",
    model_id: "gemma-3-1b-it-Q4_K_M",
    file_name: "gemma-3-1b-it-Q4_K_M.gguf",
  },
  {
    variant: "qwen-3-8b",
    model_id: "Qwen3-8B-Q4_K_M",
    file_name: "Qwen3-8B-Q4_K_M.gguf",
  },
  {
    variant: "qwen-3-14b",
    model_id: "Qwen3-14B-Q4_K_M",
    file_name: "Qwen3-14B-Q4_K_M.gguf",
  },
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function findReturningUserModel(params = {}) {
  if (params.returningUserModel) {
    return params.returningUserModel;
  }
  const searchDirs = params.modelSearchDirs || MODEL_SEARCH_DIRS;
  for (const dir of searchDirs) {
    for (const candidate of RETURNING_USER_MODEL_CANDIDATES) {
      const modelPath = path.join(dir, candidate.file_name);
      if (await fileExists(modelPath)) {
        return {
          ...candidate,
          path: modelPath,
        };
      }
    }
  }
  return null;
}

async function prepareReturningUserProfile(homeRoot, model, profileId = "proof-boss") {
  const profileDir = path.join(homeRoot, "profiles", profileId);
  await mkdir(profileDir, { recursive: true });
  await writeFile(
    path.join(profileDir, "worker-model.json"),
    `${JSON.stringify(
      {
        variant: model.variant,
        model_id: model.model_id,
        file_name: model.file_name,
        path: model.path,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(profileDir, "worker-storage.json"),
    `${JSON.stringify({ path: path.dirname(model.path) }, null, 2)}\n`,
    "utf8",
  );
}

const FORBIDDEN_VISIBLE_PRODUCT_FLOW_PATTERNS = [
  /Error invoking remote method/i,
  /does not expose BIOS AI command/i,
  /Unsupported Electron shell spike command/i,
  /Unsupported BIOS sidecar command/i,
  /Debug log:/i,
  /runtime-debug\.log/i,
  /[A-Z]:\\Users\\[^\s]+/i,
  /Electron bridge/i,
  /IPC/i,
  /Tauri/i,
  /Cloud BOSS/i,
  /Boxed Lane/i,
  /boxed-lane/i,
  /Sandbox Backend/i,
  /Promotion Gate/i,
  /Promotion Policy/i,
  /Host Access/i,
  /Network Posture/i,
  /Tool Creation/i,
  /Execution Mode/i,
  /Local Action Capability/i,
  /BOSS Model Governance/i,
  /Diagnostics And Recovery/i,
  /Debug Log File/i,
  /GGUF/i,
  /sidecar/i,
  /native registry/i,
  /connector contracts/i,
  /runtime audit/i,
  /substrate/i,
  /Managed Runtime/i,
  /Local Runtime/i,
  /Prototype HUD/i,
  /Ambient preview/i,
  /local shell mode/i,
  /gateway retry/i,
  /shell standing by/i,
  /service adapter/i,
  /hydrate Forge Arena/i,
];

function visibleProductFlowErrors(productFlow) {
  const surfaces = Array.isArray(productFlow?.surfaces) ? productFlow.surfaces : [];
  return surfaces
    .map((surface) => {
      const bodyText = String(surface?.bodyText || "");
      const pattern = FORBIDDEN_VISIBLE_PRODUCT_FLOW_PATTERNS.find((candidate) =>
        candidate.test(bodyText),
      );
      return pattern
        ? {
            label: surface?.label || "unknown",
            pattern: pattern.source,
            excerpt: bodyText.slice(0, 500),
          }
        : null;
    })
    .filter(Boolean);
}

export async function verifyBiosAiElectronProductFlowGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const executablePath = params.executablePath || packagedExecutablePath(normalizedRoot, params.platform);
  const proofRoot =
    params.proofRoot ||
    path.join(normalizedRoot, "runtime", "outputs", "bios-ai-electron-product-flow");
  const returningProofRoot = path.join(proofRoot, "returning-user");
  const firstRunProofRoot = path.join(proofRoot, "first-run");
  const returningSmokeReportPath = path.join(returningProofRoot, "packaged-product-flow-smoke.json");
  const firstRunSmokeReportPath = path.join(firstRunProofRoot, "packaged-product-flow-smoke.json");
  const selectedModel = await findReturningUserModel(params);
  const tempHome =
    params.homeRoot || (selectedModel ? await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-product-flow-")) : null);
  const proofProfileId = params.profileId || "proof-boss";
  const proofProfileName = params.profileName || "Proof BOSS";
  if (selectedModel && tempHome) {
    await prepareReturningUserProfile(tempHome, selectedModel, proofProfileId);
  }
  await rm(proofRoot, { recursive: true, force: true });
  await mkdir(returningProofRoot, { recursive: true });
  await mkdir(firstRunProofRoot, { recursive: true });
  const checks = [
    {
      name: "Packaged Electron executable exists for product-flow proof",
      status: (await fileExists(executablePath)) ? "pass" : "fail",
      missing: (await fileExists(executablePath)) ? [] : [executablePath],
      executablePath,
    },
    {
      name: "Returning-user proof has an installed BOSS brain model",
      status: selectedModel ? "pass" : "fail",
      missing: selectedModel ? [] : ["no installed GGUF model found for packaged returning-user proof"],
      model: selectedModel,
    },
  ];

  if (checks[0].status === "pass" && checks[1].status === "pass") {
    const baseEnv = {
      ...process.env,
      ...(params.env ?? {}),
      ...(selectedModel ? { BIOS_AI_MODELS_DIR: path.dirname(selectedModel.path) } : {}),
      BIOS_AI_ELECTRON_SMOKE: "1",
      BIOS_AI_ELECTRON_SMOKE_EXIT_MS: "100",
      BIOS_AI_ELECTRON_PRODUCT_FLOW_PROOF: "1",
      BIOS_AI_ELECTRON_PROOF_PROFILE_ID: proofProfileId,
      BIOS_AI_ELECTRON_PROOF_PROFILE_NAME: proofProfileName,
    };
    const returningLaunch = await (params.runProcess ?? runProcess)(executablePath, [], {
      cwd: path.dirname(executablePath),
      timeoutMs: params.timeoutMs ?? 180_000,
      env: {
        ...baseEnv,
        ...(tempHome ? { BIOS_AI_HOME_OVERRIDE: tempHome } : {}),
        BIOS_AI_ELECTRON_SMOKE_REPORT: returningSmokeReportPath,
        BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR: returningProofRoot,
        BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO: "returning-user",
        BIOS_AI_ELECTRON_PROOF_PROFILE_MODE: "returning",
      },
    });
    const returningSmoke = await readJson(returningSmokeReportPath).catch((error) => ({
      status: "fail",
      error: error.message,
    }));
    const returningProductFlow =
      returningSmoke.productFlow ||
      (await readJson(path.join(returningProofRoot, "product-flow-proof.json")).catch(() => null));
    const returningSmokePassed =
      returningSmoke.status === "pass" || returningProductFlow?.status === "pass";
    const returningScreenshots =
      returningProductFlow?.surfaces?.map((surface) => surface.screenshotPath) || [];
    const returningScreenshotsExist = await Promise.all(
      returningScreenshots.map((screenshot) => fileExists(screenshot)),
    );
    const returningVisibleErrors = visibleProductFlowErrors(returningProductFlow);
    const returningUserProof = returningProductFlow?.returningUserProof || {};
    checks.push({
      name: "Packaged Electron renderer exposes visible returning-user product surfaces",
      status:
        returningLaunch.status === "pass" &&
        returningSmokePassed &&
        returningProductFlow?.status === "pass" &&
        returningScreenshots.length >= 5 &&
        returningScreenshotsExist.every(Boolean) &&
        returningVisibleErrors.length === 0 &&
        returningUserProof.profileClicked === true &&
        returningUserProof.loadedBossProfile === true &&
        returningUserProof.bossOnlyChatPlaceholder === true
          ? "pass"
          : "fail",
      missing:
        returningLaunch.status === "pass" &&
        returningSmokePassed &&
        returningProductFlow?.status === "pass" &&
        returningScreenshots.length >= 5 &&
        returningScreenshotsExist.every(Boolean) &&
        returningVisibleErrors.length === 0 &&
        returningUserProof.profileClicked === true &&
        returningUserProof.loadedBossProfile === true &&
        returningUserProof.bossOnlyChatPlaceholder === true
          ? []
          : [
              "profile chooser, selected BOSS profile, Settings/model management, Forge Arena, and BOSS-only chat screenshots were not all proven without visible internal errors",
            ],
      exitCode: returningLaunch.exitCode,
      timedOut: returningLaunch.timedOut,
      smokeReportPath: returningSmokeReportPath,
      proofRoot: returningProofRoot,
      productFlow: returningProductFlow,
      visibleErrors: returningVisibleErrors,
    });

    const firstRunHome =
      params.firstRunHomeRoot ||
      (params.homeRoot ? path.join(params.homeRoot, "first-run-empty-home") : await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-first-run-")));
    const firstRunLaunch = await (params.runProcess ?? runProcess)(executablePath, [], {
      cwd: path.dirname(executablePath),
      timeoutMs: params.timeoutMs ?? 180_000,
      env: {
        ...baseEnv,
        BIOS_AI_HOME_OVERRIDE: firstRunHome,
        BIOS_AI_ELECTRON_SMOKE_REPORT: firstRunSmokeReportPath,
        BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR: firstRunProofRoot,
        BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO: "first-run",
        BIOS_AI_ELECTRON_PROOF_PROFILE_MODE: "none",
      },
    });
    const firstRunSmoke = await readJson(firstRunSmokeReportPath).catch((error) => ({
      status: "fail",
      error: error.message,
    }));
    const firstRunProductFlow =
      firstRunSmoke.productFlow ||
      (await readJson(path.join(firstRunProofRoot, "product-flow-proof.json")).catch(() => null));
    const firstRunSmokePassed =
      firstRunSmoke.status === "pass" || firstRunProductFlow?.status === "pass";
    const firstRunScreenshots =
      firstRunProductFlow?.surfaces?.map((surface) => surface.screenshotPath) || [];
    const firstRunScreenshotsExist = await Promise.all(
      firstRunScreenshots.map((screenshot) => fileExists(screenshot)),
    );
    const firstRunVisibleErrors = visibleProductFlowErrors(firstRunProductFlow);
    const firstRunProof = firstRunProductFlow?.firstRunProof || {};
    checks.push({
      name: "Packaged Electron renderer exposes first-run onboarding without requiring a saved profile",
      status:
        firstRunLaunch.status === "pass" &&
        firstRunSmokePassed &&
        firstRunProductFlow?.status === "pass" &&
        firstRunScreenshots.length >= 1 &&
        firstRunScreenshotsExist.every(Boolean) &&
        firstRunVisibleErrors.length === 0 &&
        firstRunProof.onboardingStarted === true &&
        firstRunProof.noSavedProfileRequired === true
          ? "pass"
          : "fail",
      missing:
        firstRunLaunch.status === "pass" &&
        firstRunSmokePassed &&
        firstRunProductFlow?.status === "pass" &&
        firstRunScreenshots.length >= 1 &&
        firstRunScreenshotsExist.every(Boolean) &&
        firstRunVisibleErrors.length === 0 &&
        firstRunProof.onboardingStarted === true &&
        firstRunProof.noSavedProfileRequired === true
          ? []
          : ["first-run onboarding screenshot was not proven without saved-profile dependency or visible internal errors"],
      exitCode: firstRunLaunch.exitCode,
      timedOut: firstRunLaunch.timedOut,
      smokeReportPath: firstRunSmokeReportPath,
      proofRoot: firstRunProofRoot,
      productFlow: firstRunProductFlow,
      visibleErrors: firstRunVisibleErrors,
    });
  }

  const report = {
    repoRoot: normalizedRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-electron-product-flow-gate.mjs",
    target: "bios-ai",
    shell: "electron",
    packageKind: "visible packaged Electron product-flow proof",
    checks,
    outputPath: path.join(normalizedRoot, "runtime", "outputs", "bios-ai-electron-product-flow-gate.json"),
  };
  await mkdir(path.dirname(report.outputPath), { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(report.outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  );
  if (report.status !== "pass") {
    throw new Error(
      `BIOS AI Electron product-flow gate failed:\n${checks
        .filter((check) => check.status !== "pass")
        .map((check) => `${check.name}: ${check.missing.join(", ")}`)
        .join("\n")}`,
    );
  }
  if (tempHome && params.keepTempHome !== true) {
    await rm(tempHome, { recursive: true, force: true });
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
  const result = await verifyBiosAiElectronProductFlowGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
