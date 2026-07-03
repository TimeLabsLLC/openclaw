import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const MANAGED_MODEL_CANDIDATES = [
  {
    variant: "gemma-3-1b",
    model_id: "gemma-3-1b-it-Q4_K_M",
    file_name: "gemma-3-1b-it-Q4_K_M.gguf",
    searchDirs: [
      "E:/BIOS AI/models",
      path.join(os.homedir(), ".agentos", "bios-ai", "models"),
      path.join(os.homedir(), ".bios-ai", "models"),
    ],
  },
  {
    variant: "qwen-3-8b",
    model_id: "Qwen3-8B-Q4_K_M",
    file_name: "Qwen3-8B-Q4_K_M.gguf",
    searchDirs: [
      "E:/BIOS AI/models",
      path.join(os.homedir(), ".agentos", "bios-ai", "models"),
      path.join(os.homedir(), ".bios-ai", "models"),
    ],
  },
];

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

async function chooseModel(params = {}) {
  if (params.modelPath) {
    const modelPath = path.resolve(params.modelPath);
    if (await fileExists(modelPath)) {
      return {
        variant: params.modelVariant || "external",
        model_id: params.modelId || path.basename(modelPath, ".gguf"),
        file_name: path.basename(modelPath),
        path: modelPath,
      };
    }
  }
  for (const candidate of params.modelCandidates ?? MANAGED_MODEL_CANDIDATES) {
    for (const dir of candidate.searchDirs) {
      const modelPath = path.join(dir, candidate.file_name);
      if (await fileExists(modelPath)) {
        return { ...candidate, path: modelPath };
      }
    }
  }
  return null;
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 300_000;
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

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-electron-live-boss-generation-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    return { status: "fail", error: error.message };
  }
}

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    `BIOS AI Electron live BOSS generation gate failed:\n${failures
      .map((check) => `${check.name}: ${check.missing.join(", ")}`)
      .join("\n")}`,
  );
}

async function prepareTempProfile(profileRoot, profileId, model) {
  const profileDir = path.join(profileRoot, "profiles", profileId);
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

export async function verifyBiosAiElectronLiveBossGenerationGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const allowLive = (params.env ?? process.env).BIOS_AI_ELECTRON_LIVE_BOSS_PROOF === "1";
  const executablePath = params.executablePath || packagedExecutablePath(normalizedRoot, params.platform);
  const selectedModel = await chooseModel(params);
  const checks = [
    {
      name: "Live BOSS proof is explicitly allowed",
      status: allowLive ? "pass" : "blocked",
      missing: allowLive ? [] : ["set BIOS_AI_ELECTRON_LIVE_BOSS_PROOF=1 to launch a real local model"],
    },
    {
      name: "Packaged Electron executable exists for live BOSS proof",
      status: (await fileExists(executablePath)) ? "pass" : "fail",
      missing: (await fileExists(executablePath)) ? [] : [executablePath],
      executablePath,
    },
    {
      name: "Installed GGUF model exists for live BOSS proof",
      status: selectedModel ? "pass" : "fail",
      missing: selectedModel ? [] : ["no managed GGUF model found"],
      model: selectedModel,
    },
  ];

  let smokeReportPath = null;
  if (allowLive && selectedModel && (await fileExists(executablePath))) {
    const profileId = params.profileId || "electron-live-boss";
    const tempHome = await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-live-boss-"));
    smokeReportPath = path.join(normalizedRoot, "runtime", "outputs", "bios-ai-electron-live-boss-smoke.json");
    await prepareTempProfile(tempHome, profileId, selectedModel);
    const payload = {
      profileId,
      agentName: "B.A.Bs",
      workerRole: "boss_brain",
      messages: [
        {
          role: "user",
          text: "Reply with exactly one short sentence confirming BIOS AI packaged Electron BOSS generation is working.",
        },
      ],
      maxTokens: 64,
      temperature: 0,
      systemPrompt:
        "You are B.A.Bs, the BIOS AI BOSS. Reply with one short sentence. Do not include code blocks.",
    };
    const runner = params.runProcess ?? runProcess;
    const launchResult = await runner(executablePath, [], {
      cwd: path.dirname(executablePath),
      timeoutMs: params.launchTimeoutMs ?? 300_000,
      env: {
        ...process.env,
        ...(params.env ?? {}),
        BIOS_AI_HOME_OVERRIDE: tempHome,
        BIOS_AI_ELECTRON_SMOKE: "1",
        BIOS_AI_ELECTRON_SMOKE_EXIT_MS: "100",
        BIOS_AI_ELECTRON_SMOKE_COMMAND: "chat_with_local_worker",
        BIOS_AI_ELECTRON_SMOKE_PAYLOAD: JSON.stringify(payload),
        BIOS_AI_ELECTRON_SMOKE_REPORT: smokeReportPath,
      },
    });
    const smokeReport = await readJson(smokeReportPath);
    const responseText = smokeReport?.commandProof?.result;
    checks.push({
      name: "Packaged Electron BOSS produces a live local-model response",
      status:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        smokeReport.commandProof?.status === "pass" &&
        smokeReport.commandProof?.payloadSummary?.workerRole === "boss_brain" &&
        smokeReport.commandProof?.payloadSummary?.profileId === profileId &&
        typeof responseText === "string" &&
        responseText.trim().length > 0
          ? "pass"
          : "fail",
      missing:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        smokeReport.commandProof?.status === "pass" &&
        smokeReport.commandProof?.payloadSummary?.workerRole === "boss_brain" &&
        smokeReport.commandProof?.payloadSummary?.profileId === profileId &&
        typeof responseText === "string" &&
        responseText.trim().length > 0
          ? []
          : ["packaged Electron app did not produce a live local-model BOSS-brain response"],
      exitCode: launchResult.exitCode,
      timedOut: launchResult.timedOut,
      smokeReportPath,
      smokeReport,
      stdout: String(launchResult.stdout || "").trim().slice(0, 1000),
      stderr: String(launchResult.stderr || "").trim().slice(0, 1000),
    });
    if (params.keepTempHome !== true) {
      await rm(tempHome, { recursive: true, force: true });
    }
  }

  const report = {
    repoRoot: normalizedRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-electron-live-boss-generation-gate.mjs",
    target: "bios-ai",
    shell: "electron",
    packageKind: "live packaged BOSS generation proof",
    model: selectedModel,
    smokeReportPath,
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
  return Boolean(argv1 && import.meta.url === pathToFileURL(argv1).href);
}

if (isMainModule()) {
  const result = await verifyBiosAiElectronLiveBossGenerationGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
