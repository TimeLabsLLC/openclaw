import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_RUNTIME_FILES = [
  {
    label: "Electron runtime package",
    files: ["node_modules/electron/package.json", "node_modules/electron/path.txt"],
  },
  {
    label: "Electron runtime binary",
    files:
      process.platform === "win32"
        ? ["node_modules/electron/dist/electron.exe"]
        : ["node_modules/electron/dist/electron"],
  },
  {
    label: "Electron builder package",
    files: ["node_modules/electron-builder/package.json"],
  },
  {
    label: "Electron builder executable",
    files:
      process.platform === "win32"
        ? ["node_modules/.bin/electron-builder.CMD"]
        : ["node_modules/.bin/electron-builder"],
  },
];

const REQUIRED_APP_FILES = [
  "aether-canvas/electron/main.mjs",
  "aether-canvas/electron/preload.cjs",
  "aether-canvas/electron/spike-runtime.mjs",
  "aether-canvas/electron/worker-runtime.mjs",
  "aether-canvas/dist/index.html",
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveDependencyRoot(repoRoot, env = process.env) {
  return path.resolve(env.AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT || repoRoot);
}

function electronExecutablePath(dependencyRoot, platform = process.platform) {
  return path.join(
    dependencyRoot,
    "node_modules",
    "electron",
    "dist",
    platform === "win32" ? "electron.exe" : "electron",
  );
}

function electronBuilderExecutablePath(dependencyRoot, platform = process.platform) {
  return path.join(
    dependencyRoot,
    "node_modules",
    ".bin",
    platform === "win32" ? "electron-builder.CMD" : "electron-builder",
  );
}

function electronRuntimeArgs(args, platform = process.platform) {
  if (platform === "linux") {
    return ["--no-sandbox", ...args];
  }
  return args;
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

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findMissingFiles(root, checks) {
  const missing = [];
  for (const check of checks) {
    for (const relativePath of check.files ?? [check]) {
      const absolutePath = path.join(root, relativePath);
      if (!(await fileExists(absolutePath))) {
        missing.push({
          label: check.label ?? "Required file",
          file: relativePath,
        });
      }
    }
  }
  return missing;
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
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

function summarizeCommandCheck(name, result, expectedPattern) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const versionMatched = expectedPattern.test(output);
  return {
    name,
    status: result.status === "pass" && versionMatched ? "pass" : "fail",
    missing: result.status === "pass" && versionMatched ? [] : [`expected ${expectedPattern}`],
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout: String(result.stdout || "")
      .trim()
      .slice(0, 500),
    stderr: String(result.stderr || "")
      .trim()
      .slice(0, 500),
  };
}

async function readPackageVersion(packageJsonPath) {
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    return {
      status:
        typeof packageJson.version === "string" && packageJson.version.length > 0 ? "pass" : "fail",
      version: packageJson.version || "",
      packageJsonPath,
      error: "",
    };
  } catch (error) {
    return {
      status: "fail",
      version: "",
      packageJsonPath,
      error: error.message,
    };
  }
}

function summarizePackageVersionCheck(name, result, expectedPattern) {
  const versionMatched = expectedPattern.test(result.version);
  return {
    name,
    status: result.status === "pass" && versionMatched ? "pass" : "fail",
    missing:
      result.status === "pass" && versionMatched
        ? []
        : [`expected ${expectedPattern} in ${result.packageJsonPath}`],
    packageJsonPath: result.packageJsonPath,
    version: result.version,
    error: result.error,
  };
}

function hasElectronHandlerError(result) {
  return /Error occurred in handler|Unsupported Electron shell spike command|does not expose BIOS AI command/i.test(
    `${result.stdout || ""}\n${result.stderr || ""}`,
  );
}

function hasPassingSidecarProof(smokeReport) {
  return smokeReport?.sidecarProof?.status === "pass";
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-electron-runtime-package-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

function assertPass(report) {
  const failures = report.checks.filter((check) => check.status !== "pass");
  if (failures.length === 0) {
    return;
  }
  const summarizeMissing = (missing) =>
    missing
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : `${entry.label ?? "Required file"}: ${entry.file ?? JSON.stringify(entry)}`,
      )
      .join(", ");
  throw new Error(
    `BIOS AI Electron runtime package gate failed:\n${failures
      .map((check) => `${check.name}: ${summarizeMissing(check.missing)}`)
      .join("\n")}`,
  );
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

export async function verifyBiosAiElectronRuntimePackageGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const platform = params.platform ?? process.platform;
  const dependencyRoot = resolveDependencyRoot(normalizedRoot, params.env);
  const runtimeMissing = await findMissingFiles(
    dependencyRoot,
    params.runtimeChecks ??
      (platform === process.platform
        ? REQUIRED_RUNTIME_FILES
        : [
            {
              label: "Electron runtime package",
              files: ["node_modules/electron/package.json", "node_modules/electron/path.txt"],
            },
            {
              label: "Electron runtime binary",
              files:
                platform === "win32"
                  ? ["node_modules/electron/dist/electron.exe"]
                  : ["node_modules/electron/dist/electron"],
            },
            {
              label: "Electron builder package",
              files: ["node_modules/electron-builder/package.json"],
            },
            {
              label: "Electron builder executable",
              files:
                platform === "win32"
                  ? ["node_modules/.bin/electron-builder.CMD"]
                  : ["node_modules/.bin/electron-builder"],
            },
          ]),
  );
  const appMissing = await findMissingFiles(
    normalizedRoot,
    (params.appFiles ?? REQUIRED_APP_FILES).map((file) => ({
      label: "BIOS AI Electron app file",
      files: [file],
    })),
  );
  const checks = [
    {
      name: "Electron runtime and builder package files exist",
      status: runtimeMissing.length === 0 ? "pass" : "fail",
      missing: runtimeMissing,
    },
    {
      name: "BIOS AI Electron app entry and built renderer exist",
      status: appMissing.length === 0 ? "pass" : "fail",
      missing: appMissing,
    },
  ];

  if (runtimeMissing.length === 0 && params.runVersionChecks !== false) {
    const runner = params.runProcess ?? runProcess;
    checks.push(
      summarizeCommandCheck(
        "Electron runtime executable reports a version",
        await runner(
          electronExecutablePath(dependencyRoot, platform),
          electronRuntimeArgs(["--version"], platform),
          {
            cwd: normalizedRoot,
            timeoutMs: params.commandTimeoutMs ?? 30_000,
            platform,
          },
        ),
        /^v\d+\.\d+\.\d+/m,
      ),
    );
    checks.push(
      summarizePackageVersionCheck(
        "Electron builder package reports a version",
        await readPackageVersion(
          path.join(dependencyRoot, "node_modules", "electron-builder", "package.json"),
        ),
        /^\d+\.\d+\.\d+$/m,
      ),
    );
  }

  const smokeReportPath =
    params.smokeReportPath ||
    path.join(normalizedRoot, "runtime", "outputs", "bios-ai-electron-app-launch-smoke.json");
  if (runtimeMissing.length === 0 && appMissing.length === 0 && params.runLaunchSmoke !== false) {
    const runner = params.runProcess ?? runProcess;
    const mainPath = path.join(normalizedRoot, "aether-canvas", "electron", "main.mjs");
    const launchResult = await runner(
      electronExecutablePath(dependencyRoot, platform),
      electronRuntimeArgs([mainPath], platform),
      {
        cwd: normalizedRoot,
        timeoutMs: params.launchTimeoutMs ?? 45_000,
        platform,
        env: {
          ...process.env,
          ...(params.env ?? {}),
          BIOS_AI_ELECTRON_SMOKE: "1",
          BIOS_AI_ELECTRON_SMOKE_EXIT_MS: String(params.smokeExitMs ?? 1200),
          BIOS_AI_ELECTRON_SMOKE_REPORT: smokeReportPath,
        },
      },
    );
    const smokeReport = await readSmokeReport(smokeReportPath);
    checks.push({
      name: "BIOS AI Electron app launches the real renderer in hidden smoke mode",
      status:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        hasPassingSidecarProof(smokeReport) &&
        !hasElectronHandlerError(launchResult)
          ? "pass"
          : "fail",
      missing:
        launchResult.status === "pass" &&
        smokeReport.status === "pass" &&
        hasPassingSidecarProof(smokeReport) &&
        !hasElectronHandlerError(launchResult)
          ? []
          : [
              "Electron app launch smoke did not produce a clean passing smoke report with sidecar proof",
            ],
      exitCode: launchResult.exitCode,
      timedOut: launchResult.timedOut,
      smokeReportPath,
      smokeReport,
      stdout: String(launchResult.stdout || "")
        .trim()
        .slice(0, 500),
      stderr: String(launchResult.stderr || "")
        .trim()
        .slice(0, 500),
    });
  }

  const report = {
    repoRoot: normalizedRoot,
    dependencyRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-electron-runtime-package-gate.mjs",
    target: "bios-ai",
    shell: "electron",
    bypassPolicy:
      "Tauri remains fallback-only until this runtime gate and packaged artifact proof both pass.",
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
  const result = await verifyBiosAiElectronRuntimePackageGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
