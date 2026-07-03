import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS = {
  ansis: "^4.2.0",
  esbuild: "~0.27.0",
  "es-module-lexer": "^1.7.0",
  electron: "42.2.0",
  "electron-builder": "26.8.1",
  "playwright-core": "1.59.1",
  tsdown: "0.21.10",
  tsx: "^4.21.0",
  typescript: "^6.0.3",
};

export function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

export function resolveDependencyCapsuleDir(repoRoot = resolveRepoRoot(), env = process.env) {
  return path.resolve(
    env.AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT ||
      path.join(repoRoot, ".artifacts", "desktop-shell", "dependency-capsule"),
  );
}

export function createDependencyCapsulePackageJson() {
  return {
    name: "bios-ai-desktop-shell-dependency-capsule",
    private: true,
    type: "module",
    dependencies: { ...BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS },
  };
}

export function createDependencyCapsuleInstallArgs(capsuleDir) {
  return [
    "pnpm",
    "install",
    "--dir",
    capsuleDir,
    "--ignore-workspace",
    "--ignore-scripts",
    "--config.confirmModulesPurge=false",
    "--child-concurrency=1",
    "--network-concurrency=4",
  ];
}

export function createCorepackSpawnSpec(args, platform = process.platform) {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "corepack", ...args],
    };
  }
  return {
    command: "corepack",
    args,
  };
}

export function runCorepack(args, params = {}) {
  const spawnImpl = params.spawn ?? spawn;
  const stdio = params.stdio ?? "inherit";
  const spawnSpec = createCorepackSpawnSpec(args, params.platform);
  return new Promise((resolve, reject) => {
    const child = spawnImpl(spawnSpec.command, spawnSpec.args, {
      cwd: params.cwd,
      stdio,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`corepack ${args.join(" ")} failed with exit code ${code ?? -1}`));
    });
  });
}

export async function prepareBiosAiDesktopShellDependencyCapsule(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const capsuleDir = path.resolve(
    params.capsuleDir ?? resolveDependencyCapsuleDir(normalizedRoot, params.env),
  );
  await mkdir(capsuleDir, { recursive: true });
  const packageJsonPath = path.join(capsuleDir, "package.json");
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(createDependencyCapsulePackageJson(), null, 2)}\n`,
    "utf8",
  );
  const installArgs = createDependencyCapsuleInstallArgs(capsuleDir);
  const run = params.runCorepack ?? runCorepack;
  await run(installArgs, {
    cwd: normalizedRoot,
    stdio: params.stdio,
    spawn: params.spawn,
  });
  return {
    repoRoot: normalizedRoot,
    capsuleDir,
    packageJsonPath,
    installArgs,
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
  const result = await prepareBiosAiDesktopShellDependencyCapsule();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
