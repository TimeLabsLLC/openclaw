import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const COPY_TARGETS = [
  { source: "index.html", destination: "index.html" },
  { source: "css", destination: "css" },
  { source: "assets", destination: "assets" },
  { source: "js", destination: "js" },
];

function normalizeSlashes(value) {
  return String(value || "").replaceAll("\\", "/");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function shouldCopyEntry(entryPath) {
  return !normalizeSlashes(entryPath).endsWith(".test.js");
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry(source, destination) {
  await cp(source, destination, {
    recursive: true,
    force: true,
    filter: shouldCopyEntry,
  });
}

async function listFilesRecursive(rootDir, relativeDir = ".") {
  const directoryPath = relativeDir === "." ? rootDir : path.join(rootDir, relativeDir);
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeDir === "." ? entry.name : path.join(relativeDir, entry.name);
    if (!shouldCopyEntry(relativePath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(rootDir, relativePath)));
      continue;
    }
    files.push(normalizeSlashes(relativePath));
  }

  return files;
}

async function collectManifestEntries(rootDir, distDir) {
  const entries = [];

  for (const target of COPY_TARGETS) {
    const sourcePath = path.join(rootDir, target.source);
    if (!(await exists(sourcePath))) {
      continue;
    }
    const sourceStat = await stat(sourcePath);
    if (sourceStat.isDirectory()) {
      const filePaths = await listFilesRecursive(sourcePath);
      for (const relativeChildPath of filePaths) {
        const sourceFilePath = path.join(sourcePath, relativeChildPath);
        const distFilePath = path.join(distDir, target.destination, relativeChildPath);
        const bytes = await readFile(sourceFilePath);
        entries.push({
          source: normalizeSlashes(path.join(target.source, relativeChildPath)),
          dist: normalizeSlashes(path.join(target.destination, relativeChildPath)),
          size: bytes.byteLength,
          sha256: sha256(bytes),
          dist_exists: await exists(distFilePath),
        });
      }
      continue;
    }

    const bytes = await readFile(sourcePath);
    const distFilePath = path.join(distDir, target.destination);
    entries.push({
      source: normalizeSlashes(target.source),
      dist: normalizeSlashes(target.destination),
      size: bytes.byteLength,
      sha256: sha256(bytes),
      dist_exists: await exists(distFilePath),
    });
  }

  return entries.toSorted((left, right) => left.dist.localeCompare(right.dist));
}

function buildTreeHash(entries) {
  const normalized = entries
    .map((entry) => `${entry.dist}|${entry.size}|${entry.sha256}`)
    .join("\n");
  return sha256(Buffer.from(normalized, "utf8"));
}

export async function writePreparedDistManifest(rootDir, distDir) {
  const entries = await collectManifestEntries(rootDir, distDir);
  const missingDistFiles = entries.filter((entry) => !entry.dist_exists).map((entry) => entry.dist);
  if (missingDistFiles.length > 0) {
    throw new Error(`Prepared dist is missing copied files: ${missingDistFiles.join(", ")}`);
  }

  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_root: "aether-canvas",
    dist_root: "aether-canvas/dist",
    entry_count: entries.length,
    tree_sha256: buildTreeHash(entries),
    entries: entries.map(({ dist_exists: _distExists, ...entry }) => entry),
  };

  await writeFile(
    path.join(distDir, "bios-build-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

export async function prepareStaticDist(rootDir, distDir) {
  await mkdir(distDir, { recursive: true });

  for (const target of COPY_TARGETS) {
    const sourcePath = path.join(rootDir, target.source);
    const destinationPath = path.join(distDir, target.destination);
    if (!(await exists(sourcePath))) {
      continue;
    }
    await copyEntry(sourcePath, destinationPath);
  }

  return writePreparedDistManifest(rootDir, distDir);
}
