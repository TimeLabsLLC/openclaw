import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_TARGET_FILES = [
  ["aether-canvas/dist", "dist"],
  ["aether-canvas/electron", "electron"],
  ["aether-canvas/src-tauri/resources/bin", "resources/bin"],
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveDependencyRoot(repoRoot, env = process.env) {
  return path.resolve(env.AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT || repoRoot);
}

function defaultStageRoot(repoRoot) {
  return path.join(repoRoot, ".artifacts", "desktop-shell", "bios-ai-electron-installer-stage");
}

function defaultOutputRoot(repoRoot) {
  return path.join(repoRoot, ".artifacts", "desktop-shell", "bios-ai-electron-installer");
}

function electronBuilderExecutablePath(dependencyRoot, platform = process.platform) {
  return path.join(
    dependencyRoot,
    "node_modules",
    ".bin",
    platform === "win32" ? "electron-builder.CMD" : "electron-builder",
  );
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

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 240_000;
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

async function stageBiosAiElectronInstallerApp(repoRoot, stageRoot) {
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  for (const [source, destination] of APP_TARGET_FILES) {
    await cp(path.join(repoRoot, source), path.join(stageRoot, destination), {
      recursive: true,
    });
  }
  await writeFile(
    path.join(stageRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "bios-ai-electron-shell",
        version: "0.1.0",
        private: true,
        type: "module",
        main: "electron/main.mjs",
        description: "BIOS AI Electron shell installer proof",
        author: "BIOS AI",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function installerConfig(outputRoot) {
  return {
    appId: "ai.bios.desktop",
    productName: "BIOS AI",
    electronVersion: "42.2.0",
    asar: false,
    directories: {
      output: outputRoot,
    },
    files: ["dist/**/*", "electron/**/*", "package.json"],
    extraResources: [{ from: "resources/bin", to: "bin" }],
    win: {
      target: ["nsis"],
      executableName: "BIOS AI",
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      allowElevation: false,
      runAfterFinish: false,
      createDesktopShortcut: "always",
      createStartMenuShortcut: true,
      shortcutName: "BIOS AI",
      artifactName: "BIOS AI Setup ${version}.${ext}",
      deleteAppDataOnUninstall: false,
      warningsAsErrors: true,
    },
  };
}

async function writeBuilderConfig(stageRoot, outputRoot) {
  const configPath = path.join(stageRoot, "electron-builder.json");
  await writeFile(configPath, `${JSON.stringify(installerConfig(outputRoot), null, 2)}\n`, "utf8");
  return configPath;
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-electron-installer-artifact-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    `BIOS AI Electron installer artifact gate failed:\n${failures
      .map((check) => `${check.name}: ${check.missing.join(", ")}`)
      .join("\n")}`,
  );
}

export async function verifyBiosAiElectronInstallerArtifactGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const dependencyRoot = resolveDependencyRoot(normalizedRoot, params.env);
  const stageRoot = path.resolve(params.stageRoot || defaultStageRoot(normalizedRoot));
  const outputRoot = path.resolve(params.outputRoot || defaultOutputRoot(normalizedRoot));
  const runner = params.runProcess ?? runProcess;

  await (params.stageApp ?? stageBiosAiElectronInstallerApp)(normalizedRoot, stageRoot);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const builderConfigPath = await (params.writeBuilderConfig ?? writeBuilderConfig)(
    stageRoot,
    outputRoot,
  );
  const config = installerConfig(outputRoot);

  const checks = [
    {
      name: "Installer config is current-user and single-product BIOS AI",
      status:
        config.nsis.oneClick === true &&
        config.nsis.perMachine === false &&
        config.nsis.allowElevation === false &&
        config.nsis.shortcutName === "BIOS AI" &&
        config.nsis.createDesktopShortcut === "always"
          ? "pass"
          : "fail",
      missing: [],
      config: config.nsis,
    },
    {
      name: "BIOS AI Electron app is staged for NSIS packaging",
      status:
        (await fileExists(path.join(stageRoot, "dist", "index.html"))) &&
        (await fileExists(path.join(stageRoot, "electron", "main.mjs"))) &&
        (await fileExists(path.join(stageRoot, "resources", "bin", "llama-server.exe")))
          ? "pass"
          : "fail",
      missing: [],
      stageRoot,
    },
  ];

  const buildResult = await runner(
    electronBuilderExecutablePath(dependencyRoot, params.platform),
    ["--win", "nsis", "--config", builderConfigPath],
    {
      cwd: stageRoot,
      timeoutMs: params.buildTimeoutMs ?? 900_000,
      platform: params.platform,
      env: {
        ...process.env,
        ...(params.env ?? {}),
      },
    },
  );
  checks.push({
    name: "electron-builder creates a BIOS AI NSIS installer artifact",
    status: buildResult.status,
    missing: buildResult.status === "pass" ? [] : ["electron-builder --win nsis failed"],
    exitCode: buildResult.exitCode,
    timedOut: buildResult.timedOut,
    stdout: String(buildResult.stdout || "").trim().slice(0, 1200),
    stderr: String(buildResult.stderr || "").trim().slice(0, 1200),
  });

  const installerPath = path.join(outputRoot, "BIOS AI Setup 0.1.0.exe");
  const installerExists = await fileExists(installerPath);
  checks.push({
    name: "Current-user BIOS AI installer executable exists",
    status: installerExists ? "pass" : "fail",
    missing: installerExists ? [] : [installerPath],
    installerPath,
  });

  const report = {
    repoRoot: normalizedRoot,
    dependencyRoot,
    stageRoot,
    outputRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-electron-installer-artifact-gate.mjs",
    target: "bios-ai",
    shell: "electron",
    packageKind: "electron-builder NSIS current-user installer artifact proof",
    config,
    bypassPolicy:
      "This gate proves installer artifact creation and current-user config. Host install/uninstall registration proof is a separate explicit-mutation gate.",
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
  const result = await verifyBiosAiElectronInstallerArtifactGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
