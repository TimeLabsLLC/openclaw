import { spawn } from "node:child_process";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_TARGET_FILES = [
  ["aether-canvas/dist", "dist"],
  ["aether-canvas/electron", "electron"],
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveDependencyRoot(repoRoot, env = process.env) {
  return path.resolve(env.AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT || repoRoot);
}

function defaultStageRoot(repoRoot) {
  return path.join(repoRoot, ".artifacts", "desktop-shell", "bios-ai-electron-package-stage");
}

function defaultOutputRoot(repoRoot) {
  return path.join(repoRoot, ".artifacts", "desktop-shell", "bios-ai-electron-package");
}

function executableInvocation(command, args, platform = process.platform) {
  if (platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/c", command, ...args],
    };
  }
  return { command, args };
}

function electronBuilderExecutablePath(dependencyRoot, platform = process.platform) {
  return path.join(
    dependencyRoot,
    "node_modules",
    ".bin",
    platform === "win32" ? "electron-builder.CMD" : "electron-builder",
  );
}

function electronDistributionRoot(dependencyRoot) {
  return path.join(dependencyRoot, "node_modules", "electron", "dist");
}

function unpackedPackageRoot(outputRoot, platform = process.platform) {
  if (platform === "darwin") {
    return path.join(outputRoot, "mac", "BIOS AI.app");
  }
  return path.join(outputRoot, platform === "win32" ? "win-unpacked" : "linux-unpacked");
}

function packagedExecutablePath(outputRoot, platform = process.platform) {
  if (platform === "win32") {
    return path.join(outputRoot, "win-unpacked", "BIOS AI.exe");
  }
  if (platform === "darwin") {
    return path.join(outputRoot, "mac", "BIOS AI.app", "Contents", "MacOS", "Electron");
  }
  return path.join(outputRoot, "linux-unpacked", "bios-ai");
}

function packagedSidecarPath(outputRoot, platform = process.platform) {
  const fileName = platform === "win32" ? "llama-server.exe" : "llama-server";
  if (platform === "darwin") {
    return path.join(outputRoot, "mac", "BIOS AI.app", "Contents", "Resources", "bin", fileName);
  }
  const unpackedDir = platform === "win32" ? "win-unpacked" : "linux-unpacked";
  return path.join(outputRoot, unpackedDir, "resources", "bin", fileName);
}

function packagedSidecarCompanionPath(outputRoot, platform = process.platform) {
  if (platform !== "win32") {
    return null;
  }
  return path.join(outputRoot, "win-unpacked", "resources", "bin", "llama-common.dll");
}

function packagedLaunchArgs(args, platform = process.platform) {
  if (platform === "linux") {
    return ["--no-sandbox", ...args];
  }
  return args;
}

function platformSidecarFileName(platform = process.platform) {
  return platform === "win32" ? "llama-server.exe" : "llama-server";
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise((resolve) => {
    const invocation = executableInvocation(command, args, options.platform);
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const killChildTree = () => {
      if (!child.pid) {
        return;
      }
      if ((options.platform ?? process.platform) === "win32") {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.on("error", () => {});
      }
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killChildTree();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
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
      if (settled) {
        return;
      }
      settled = true;
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

async function stageBiosAiElectronApp(repoRoot, stageRoot) {
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  for (const [source, destination] of APP_TARGET_FILES) {
    await cp(path.join(repoRoot, source), path.join(stageRoot, destination), {
      recursive: true,
    });
  }
  await cp(
    path.join(repoRoot, "aether-canvas", "src-tauri", "resources", "bin"),
    path.join(stageRoot, "resources", "bin"),
    { recursive: true },
  );
  await writeFile(
    path.join(stageRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "bios-ai-electron-shell",
        version: "0.1.0",
        private: true,
        type: "module",
        main: "electron/main.mjs",
        packageManager: "pnpm@10.33.2",
        dependencies: {},
        devDependencies: {},
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function writeBuilderConfig(stageRoot, outputRoot) {
  const configPath = path.join(stageRoot, "electron-builder.json");
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        appId: "ai.bios.desktop",
        productName: "BIOS AI",
        electronVersion: "42.2.0",
        asar: false,
        npmRebuild: false,
        nodeGypRebuild: false,
        buildDependenciesFromSource: false,
        directories: {
          output: outputRoot,
        },
        files: ["dist/**/*", "electron/**/*", "package.json"],
        extraResources: [{ from: "resources/bin", to: "bin" }],
        win: {
          target: ["dir"],
          executableName: "BIOS AI",
        },
        mac: {
          target: ["dir"],
        },
        linux: {
          target: ["dir"],
          executableName: "bios-ai",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return configPath;
}

async function packageBiosAiElectronApp(
  dependencyRoot,
  stageRoot,
  outputRoot,
  platform = process.platform,
) {
  const electronDist = electronDistributionRoot(dependencyRoot);
  if (platform === "darwin") {
    const appRoot = unpackedPackageRoot(outputRoot, platform);
    await rm(path.dirname(appRoot), { recursive: true, force: true });
    await mkdir(path.dirname(appRoot), { recursive: true });
    await cp(path.join(electronDist, "Electron.app"), appRoot, { recursive: true });
    await cp(stageRoot, path.join(appRoot, "Contents", "Resources", "app"), { recursive: true });
    await mkdir(path.join(appRoot, "Contents", "Resources", "bin"), { recursive: true });
    await cp(
      path.join(stageRoot, "resources", "bin"),
      path.join(appRoot, "Contents", "Resources", "bin"),
      { recursive: true },
    );
    return;
  }

  const appRoot = unpackedPackageRoot(outputRoot, platform);
  const targetExecutable =
    platform === "win32" ? path.join(appRoot, "BIOS AI.exe") : path.join(appRoot, "bios-ai");
  if (!(await fileExists(targetExecutable))) {
    await rm(appRoot, { recursive: true, force: true });
    await mkdir(path.dirname(appRoot), { recursive: true });
    await cp(electronDist, appRoot, { recursive: true });

    if (platform === "win32") {
      await rename(path.join(appRoot, "electron.exe"), targetExecutable);
    } else {
      await rename(path.join(appRoot, "electron"), targetExecutable);
    }
  }

  await rm(path.join(appRoot, "resources", "app"), { recursive: true, force: true });
  await rm(path.join(appRoot, "resources", "bin"), { recursive: true, force: true });
  await mkdir(path.join(appRoot, "resources"), { recursive: true });
  await cp(stageRoot, path.join(appRoot, "resources", "app"), { recursive: true });
  await cp(path.join(stageRoot, "resources", "bin"), path.join(appRoot, "resources", "bin"), {
    recursive: true,
  });
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-electron-package-artifact-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

function hasLaunchError(result) {
  return /Error occurred in handler|Unsupported Electron shell spike command|does not expose BIOS AI command/i.test(
    `${result.stdout || ""}\n${result.stderr || ""}`,
  );
}

function hasPassingSidecarProof(smokeReport) {
  return smokeReport?.sidecarProof?.status === "pass";
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

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    `BIOS AI Electron package artifact gate failed:\n${failures
      .map((check) => `${check.name}: ${check.missing.join(", ")}`)
      .join("\n")}`,
  );
}

export async function verifyBiosAiElectronPackageArtifactGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const platform = params.platform ?? process.platform;
  const dependencyRoot = resolveDependencyRoot(normalizedRoot, params.env);
  const stageRoot = path.resolve(params.stageRoot || defaultStageRoot(normalizedRoot));
  const outputRoot = path.resolve(params.outputRoot || defaultOutputRoot(normalizedRoot));
  const runner = params.runProcess ?? runProcess;

  await (params.stageApp ?? stageBiosAiElectronApp)(normalizedRoot, stageRoot);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const builderConfigPath = await (params.writeBuilderConfig ?? writeBuilderConfig)(
    stageRoot,
    outputRoot,
  );

  const checks = [
    {
      name: "BIOS AI Electron app is staged for packaging",
      status:
        (await fileExists(path.join(stageRoot, "dist", "index.html"))) &&
        (await fileExists(path.join(stageRoot, "electron", "main.mjs"))) &&
        (await fileExists(
          path.join(
            stageRoot,
            "resources",
            "bin",
            platform === "win32" ? "llama-server.exe" : "llama-server",
          ),
        ))
          ? "pass"
          : "fail",
      missing: [],
      stageRoot,
    },
  ];

  const buildResult = await (params.packageApp ?? packageBiosAiElectronApp)(
    dependencyRoot,
    stageRoot,
    outputRoot,
    platform,
  )
    .then(() => ({
      status: "pass",
      exitCode: 0,
      timedOut: false,
      stdout: `packaged from ${electronDistributionRoot(dependencyRoot)}`,
      stderr: "",
    }))
    .catch((error) => ({
      status: "fail",
      exitCode: null,
      timedOut: false,
      stdout: "",
      stderr: error.message,
    }));
  checks.push({
    name: "BIOS AI deterministic Electron unpacked package artifact is created",
    status: buildResult.status,
    missing:
      buildResult.status === "pass"
        ? []
        : ["deterministic Electron unpacked package creation failed"],
    exitCode: buildResult.exitCode,
    timedOut: buildResult.timedOut,
    stdout: String(buildResult.stdout || "")
      .trim()
      .slice(0, 1000),
    stderr: String(buildResult.stderr || "")
      .trim()
      .slice(0, 1000),
  });

  const executablePath = packagedExecutablePath(outputRoot, platform);
  const executableExists = await fileExists(executablePath);
  checks.push({
    name: "Packaged BIOS AI executable exists",
    status: executableExists ? "pass" : "fail",
    missing: executableExists ? [] : [executablePath],
    executablePath,
  });

  const sidecarPath = packagedSidecarPath(outputRoot, platform);
  const sidecarExists = await fileExists(sidecarPath);
  const sidecarCompanionPath = packagedSidecarCompanionPath(outputRoot, platform);
  const sidecarCompanionExists = sidecarCompanionPath
    ? await fileExists(sidecarCompanionPath)
    : true;
  checks.push({
    name: "Packaged BIOS AI includes the llama.cpp worker sidecar binary",
    status: sidecarExists ? "pass" : "fail",
    missing: sidecarExists ? [] : [sidecarPath],
    sidecarPath,
  });
  checks.push({
    name: "Packaged BIOS AI includes the llama.cpp runtime companion files",
    status: sidecarCompanionExists ? "pass" : "fail",
    missing: sidecarCompanionExists ? [] : [sidecarCompanionPath],
    companionPath: sidecarCompanionPath,
  });

  const smokeReportPath = path.join(
    normalizedRoot,
    "runtime",
    "outputs",
    "bios-ai-electron-packaged-launch-smoke.json",
  );
  const smokeUserDataDir = path.join(
    normalizedRoot,
    "runtime",
    "outputs",
    "bios-ai-electron-packaged-launch-user-data",
  );
  if (executableExists && params.runLaunchSmoke !== false) {
    await rm(smokeReportPath, { force: true });
    await rm(smokeUserDataDir, { recursive: true, force: true });
    await mkdir(smokeUserDataDir, { recursive: true });
    const launchResult = await runner(
      executablePath,
      packagedLaunchArgs(
        [
          "--disable-3d-apis",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--disable-gpu-compositing",
          "--disable-gpu-rasterization",
          "--disable-gpu-sandbox",
          "--disable-features=Vulkan,UseSkiaRenderer,CanvasOopRasterization",
        ],
        platform,
      ),
      {
        cwd: path.dirname(executablePath),
        timeoutMs: params.launchTimeoutMs ?? 180_000,
        platform,
        env: {
          ...process.env,
          ...(params.env ?? {}),
          BIOS_AI_ELECTRON_SMOKE: "1",
          BIOS_AI_ELECTRON_SMOKE_EXIT_MS: String(params.smokeExitMs ?? 1200),
          BIOS_AI_ELECTRON_SMOKE_REPORT: smokeReportPath,
          BIOS_AI_ELECTRON_USER_DATA_DIR: smokeUserDataDir,
        },
      },
    );
    const smokeReport = await readSmokeReport(smokeReportPath);
    checks.push({
      name: "Packaged BIOS AI executable launches the real renderer in hidden smoke mode",
      status:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        hasPassingSidecarProof(smokeReport) &&
        !hasLaunchError(launchResult)
          ? "pass"
          : "fail",
      missing:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        hasPassingSidecarProof(smokeReport) &&
        !hasLaunchError(launchResult)
          ? []
          : [
              "packaged executable launch smoke did not produce a clean passing smoke report with sidecar proof",
            ],
      exitCode: launchResult.exitCode,
      timedOut: launchResult.timedOut,
      smokeReportPath,
      smokeUserDataDir,
      smokeReport,
      stdout: String(launchResult.stdout || "")
        .trim()
        .slice(0, 1000),
      stderr: String(launchResult.stderr || "")
        .trim()
        .slice(0, 1000),
    });
  }

  const report = {
    repoRoot: normalizedRoot,
    dependencyRoot,
    stageRoot,
    outputRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-electron-package-artifact-gate.mjs",
    target: "bios-ai",
    shell: "electron",
    packageKind: "deterministic Electron unpacked package proof",
    bypassPolicy:
      "Tauri remains fallback-only; this gate proves the Electron artifact path but not installer registration.",
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
  const result = await verifyBiosAiElectronPackageArtifactGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
