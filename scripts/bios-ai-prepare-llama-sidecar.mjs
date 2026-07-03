import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const LLAMA_RELEASE_API = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest";
const DEFAULT_OUTPUT_DIR = path.join("aether-canvas", "src-tauri", "resources", "bin");

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function expectedLlamaAssetPattern(platform = process.platform, arch = process.arch) {
  if (platform === "darwin" && arch === "x64") {
    return /^llama-b\d+-bin-macos-x64\.tar\.gz$/;
  }
  if (platform === "darwin" && arch === "arm64") {
    return /^llama-b\d+-bin-macos-arm64\.tar\.gz$/;
  }
  if (platform === "linux" && arch === "x64") {
    return /^llama-b\d+-bin-ubuntu-x64\.tar\.gz$/;
  }
  if (platform === "linux" && arch === "arm64") {
    return /^llama-b\d+-bin-ubuntu-arm64\.tar\.gz$/;
  }
  if (platform === "win32" && arch === "x64") {
    return /^llama-b\d+-bin-win-cpu-x64\.zip$/;
  }
  if (platform === "win32" && arch === "arm64") {
    return /^llama-b\d+-bin-win-cpu-arm64\.zip$/;
  }
  throw new Error(`Unsupported llama.cpp sidecar platform: ${platform}/${arch}`);
}

export function selectLlamaAsset(release, platform = process.platform, arch = process.arch) {
  const pattern = expectedLlamaAssetPattern(platform, arch);
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const asset = assets.find((candidate) => pattern.test(candidate?.name || ""));
  assertCondition(asset, `No llama.cpp release asset matched ${pattern}`);
  assertCondition(
    asset.browser_download_url,
    `llama.cpp release asset ${asset.name} is missing a download URL`,
  );
  return {
    name: asset.name,
    url: asset.browser_download_url,
    tagName: release.tag_name || "unknown",
  };
}

async function fileExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "bios-ai-package-readiness",
      Accept: "application/vnd.github+json",
    },
  });
  assertCondition(response.ok, `Failed to fetch ${url}: HTTP ${response.status}`);
  return response.json();
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "bios-ai-package-readiness",
    },
  });
  assertCondition(response.ok, `Failed to download ${url}: HTTP ${response.status}`);
  await pipeline(response.body, createWriteStream(destination));
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function isRuntimeFile(filePath, platform = process.platform) {
  const name = path.basename(filePath);
  if (platform === "win32") {
    return name.endsWith(".exe") || name.endsWith(".dll");
  }
  return name === "llama-server" || name.endsWith(".dylib") || name.endsWith(".so");
}

async function copyRuntimeFiles(extractRoot, outputDir, platform = process.platform) {
  const files = await walkFiles(extractRoot);
  const runtimeFiles = files.filter((filePath) => isRuntimeFile(filePath, platform));
  const serverName = platform === "win32" ? "llama-server.exe" : "llama-server";
  assertCondition(
    runtimeFiles.some((filePath) => path.basename(filePath) === serverName),
    `Extracted llama.cpp archive did not include ${serverName}`,
  );
  await mkdir(outputDir, { recursive: true });
  for (const filePath of runtimeFiles) {
    const target = path.join(outputDir, path.basename(filePath));
    await copyFile(filePath, target);
    if (platform !== "win32") {
      await runCommand("chmod", ["755", target], { stdio: "ignore" });
    }
  }
  return Promise.all(
    runtimeFiles.map(async (filePath) => {
      const target = path.join(outputDir, path.basename(filePath));
      return {
        file: path.relative(outputDir, target).replace(/\\/g, "/"),
        size: (await stat(target)).size,
      };
    }),
  );
}

export async function prepareLlamaSidecar(repoRoot = resolveRepoRoot(), params = {}) {
  const platform = params.platform ?? process.platform;
  const arch = params.arch ?? process.arch;
  const outputDir = path.resolve(repoRoot, params.outputDir || DEFAULT_OUTPUT_DIR);
  const summaryPath = params.summaryPath
    ? path.resolve(repoRoot, params.summaryPath)
    : path.resolve(repoRoot, "runtime", "outputs", `bios-ai-llama-sidecar-${platform}.json`);
  const tempRoot = path.join(os.tmpdir(), `bios-ai-llama-${platform}-${Date.now()}`);
  await mkdir(tempRoot, { recursive: true });

  const release = params.release ?? (await fetchJson(LLAMA_RELEASE_API));
  const asset = selectLlamaAsset(release, platform, arch);
  const archivePath = path.join(tempRoot, asset.name);
  const extractRoot = path.join(tempRoot, "extract");
  await mkdir(extractRoot, { recursive: true });

  if (params.archivePath) {
    await copyFile(params.archivePath, archivePath);
  } else {
    await downloadFile(asset.url, archivePath);
  }

  await runCommand("tar", ["-xf", archivePath, "-C", extractRoot]);
  const copiedFiles = await copyRuntimeFiles(extractRoot, outputDir, platform);
  const serverName = platform === "win32" ? "llama-server.exe" : "llama-server";
  const serverPath = path.join(outputDir, serverName);
  assertCondition(await fileExists(serverPath), `Prepared sidecar is missing ${serverName}`);

  const summary = {
    status: "pass",
    owner: "scripts/bios-ai-prepare-llama-sidecar.mjs",
    platform,
    arch,
    releaseTag: asset.tagName,
    assetName: asset.name,
    outputDir: path.relative(repoRoot, outputDir).replace(/\\/g, "/"),
    serverPath: path.relative(repoRoot, serverPath).replace(/\\/g, "/"),
    copiedFiles,
  };
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const summary = await prepareLlamaSidecar();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
