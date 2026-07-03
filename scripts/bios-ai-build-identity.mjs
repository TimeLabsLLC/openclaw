import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  prepareStaticDist,
  writePreparedDistManifest,
} from "../aether-canvas/scripts/lib/dist-manifest.mjs";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveBiosAiElectronPaths(repoRoot = resolveRepoRoot(), platform = process.platform) {
  const normalizedRoot = path.resolve(repoRoot);
  const packageRoot = path.join(
    normalizedRoot,
    ".artifacts",
    "desktop-shell",
    "bios-ai-electron-package",
  );
  const installerRoot = path.join(
    normalizedRoot,
    ".artifacts",
    "desktop-shell",
    "bios-ai-electron-installer",
  );
  const packageSubdir =
    platform === "darwin" ? path.join("mac", "BIOS AI.app") : platform === "win32" ? "win-unpacked" : "linux-unpacked";
  const releaseExePath =
    platform === "darwin"
      ? path.join(packageRoot, "mac", "BIOS AI.app", "Contents", "MacOS", "BIOS AI")
      : platform === "win32"
        ? path.join(packageRoot, "win-unpacked", "BIOS AI.exe")
        : path.join(packageRoot, "linux-unpacked", "bios-ai");
  const sidecarFile = platform === "win32" ? "llama-server.exe" : "llama-server";
  const sidecarPath =
    platform === "darwin"
      ? path.join(packageRoot, "mac", "BIOS AI.app", "Contents", "Resources", "bin", sidecarFile)
      : path.join(packageRoot, packageSubdir, "resources", "bin", sidecarFile);
  return {
    repoRoot: normalizedRoot,
    appRoot: path.join(normalizedRoot, "aether-canvas"),
    electronMainPath: path.join(normalizedRoot, "aether-canvas", "electron", "main.mjs"),
    electronPreloadPath: path.join(normalizedRoot, "aether-canvas", "electron", "preload.cjs"),
    electronPackageRoot: packageRoot,
    electronInstallerRoot: installerRoot,
    distManifestPath: path.join(normalizedRoot, "aether-canvas", "dist", "bios-build-manifest.json"),
    releaseExePath,
    setupExePath:
      platform === "win32" ? path.join(installerRoot, "BIOS AI Setup 0.1.0.exe") : "",
    sidecarPath,
    packageSubdir,
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertFileExists(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} missing: ${filePath}`);
  }
}

function assertNoTauriProofPath(label, filePath) {
  const normalized = String(filePath || "").replaceAll("/", "\\").toLowerCase();
  assertCondition(
    !normalized.includes("\\src-tauri\\") && !normalized.includes("\\target\\release\\"),
    `${label} must not point at the old Tauri release path: ${filePath}`,
  );
}

export async function verifyBiosAiBuildIdentity(repoRoot = resolveRepoRoot(), params = {}) {
  const paths = resolveBiosAiElectronPaths(repoRoot, params.platform ?? process.platform);
  const preparedManifest = await prepareStaticDist(paths.appRoot, path.join(paths.appRoot, "dist"));
  const electronMain = await readFile(paths.electronMainPath, "utf8");
  const electronPreload = await readFile(paths.electronPreloadPath, "utf8");
  const distManifest = await readJson(paths.distManifestPath);
  const recomputedManifest = await writePreparedDistManifest(
    paths.appRoot,
    path.join(paths.appRoot, "dist"),
  );

  assertCondition(
    electronMain.includes("new BrowserWindow") &&
      electronMain.includes("contextIsolation: true") &&
      electronMain.includes("sandbox: true") &&
      electronMain.includes('ipcMain.handle("bios-ai:invoke"'),
    "BIOS AI Electron main process must own the packaged app shell with a locked-down bridge",
  );
  assertCondition(
    electronPreload.includes('contextBridge.exposeInMainWorld("__TAURI__"') &&
      electronPreload.includes('ipcRenderer.invoke("bios-ai:invoke"'),
    "BIOS AI Electron preload must expose the narrow invoke bridge used by the renderer",
  );
  assertCondition(
    distManifest.schema_version === 1,
    `Unexpected BIOS AI dist manifest schema: ${String(distManifest.schema_version)}`,
  );
  assertCondition(
    distManifest.entry_count === recomputedManifest.entry_count,
    "BIOS AI dist manifest entry count drifted from source tree",
  );
  assertCondition(
    distManifest.tree_sha256 === recomputedManifest.tree_sha256,
    "BIOS AI dist manifest hash drifted from source truth",
  );
  assertCondition(
    preparedManifest.tree_sha256 === recomputedManifest.tree_sha256,
    "BIOS AI prepared dist manifest did not stabilize after regeneration",
  );

  await assertFileExists(paths.releaseExePath, "BIOS AI Electron packaged executable");
  await assertFileExists(paths.sidecarPath, "BIOS AI packaged local BOSS worker sidecar");
  if ((params.platform ?? process.platform) === "win32") {
    await assertFileExists(paths.setupExePath, "BIOS AI Electron current-user installer");
  }

  const resourceDir = path.dirname(paths.sidecarPath);
  const resourceBinEntries = await readdir(resourceDir);
  const acceleratorBackends = resourceBinEntries.filter((entry) =>
    /ggml-(cuda|vulkan|hip|rocm|metal|sycl|opencl|kompute|musa|cann|directml)/i.test(entry),
  );
  assertCondition(
    acceleratorBackends.length > 0,
    "BIOS AI packaged local BOSS runtime must include at least one llama.cpp GPU accelerator backend; CPU-only ggml bundles are not acceptable",
  );
  if (acceleratorBackends.some((entry) => /ggml-cuda/i.test(entry))) {
    for (const runtimeDll of ["cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll"]) {
      assertCondition(
        resourceBinEntries.includes(runtimeDll),
        `BIOS AI CUDA llama.cpp backend requires ${runtimeDll} beside llama-server.exe`,
      );
    }
  }
  assertNoTauriProofPath("releaseExePath", paths.releaseExePath);
  assertNoTauriProofPath("setupExePath", paths.setupExePath);

  return {
    repoRoot: paths.repoRoot,
    productName: "BIOS AI",
    version: "0.1.0",
    shell: "electron",
    appId: "ai.bios.desktop",
    releaseExePath: paths.releaseExePath,
    setupExePath: paths.setupExePath,
    installerPath: paths.setupExePath,
    sidecarPath: paths.sidecarPath,
    distManifestPath: paths.distManifestPath,
    distTreeHash: recomputedManifest.tree_sha256,
    packageKind: "Electron packaged app",
    tauriReleasePathBlocked: true,
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
  const result = await verifyBiosAiBuildIdentity();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
