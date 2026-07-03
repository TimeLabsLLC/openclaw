import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_PACKAGE_FILES = [
  {
    label: "ansis package entry for tsdown",
    files: ["node_modules/ansis/package.json", "node_modules/ansis/index.mjs"],
  },
  {
    label: "esbuild package entry for tsx",
    files: ["node_modules/esbuild/package.json", "node_modules/esbuild/lib/main.js"],
  },
  {
    label: "es-module-lexer package entry for Vitest",
    files: [
      "node_modules/es-module-lexer/package.json",
      "node_modules/es-module-lexer/dist/lexer.js",
    ],
  },
  {
    label: "tsdown build runner",
    files: ["node_modules/tsdown/package.json", "node_modules/tsdown/dist/run.mjs"],
  },
  {
    label: "tsx TypeScript runner",
    files: ["node_modules/tsx/package.json", "node_modules/tsx/dist/loader.mjs"],
  },
  {
    label: "TypeScript compiler for tsdown declaration output",
    files: ["node_modules/typescript/package.json", "node_modules/typescript/lib/typescript.js"],
  },
];

const REQUIRED_CONTRACT_NEEDLES = [
  {
    file: "packages/desktop-shell/src/app-targets.ts",
    needles: [
      `"bios-ai"`,
      "aether-canvas/dist/index.html",
      "tauri-compatible-invoke",
      "packageProofRequired: true",
    ],
  },
  {
    file: "packages/desktop-shell/src/contract.ts",
    needles: ["App target:", "Package proof required:"],
  },
  {
    file: "scripts/desktop-shell-smoke.mjs",
    needles: ["appTarget", "Package proof required: no"],
  },
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveDependencyRoot(repoRoot, env = process.env) {
  return path.resolve(env.AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT || repoRoot);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findMissingPackageFiles(repoRoot, packageChecks = REQUIRED_PACKAGE_FILES) {
  const missing = [];
  for (const check of packageChecks) {
    for (const relativePath of check.files) {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!(await fileExists(absolutePath))) {
        missing.push({
          label: check.label,
          file: relativePath,
        });
      }
    }
  }
  return missing;
}

function missingNeedles(source, needles) {
  return needles.filter((needle) => !source.includes(needle));
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function verifyContractNeedles(repoRoot, contractChecks = REQUIRED_CONTRACT_NEEDLES) {
  const results = [];
  for (const check of contractChecks) {
    const source = await readRepoFile(repoRoot, check.file);
    const missing = missingNeedles(source, check.needles);
    results.push({
      name: `Contract file ${check.file} contains required package-foundation truth`,
      status: missing.length === 0 ? "pass" : "fail",
      file: check.file,
      missing,
    });
  }
  return results;
}

async function writeReport(repoRoot, report) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "bios-ai-desktop-shell-package-foundation-gate.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return jsonPath;
}

function assertPass(report) {
  if (report.status === "pass") {
    return;
  }

  const lines = report.checks
    .filter((check) => check.status !== "pass")
    .map((check) => `${check.name}: ${check.missing.map((entry) => entry.file ?? entry).join(", ")}`);

  throw new Error(`BIOS AI desktop shell package foundation gate failed:\n${lines.join("\n")}`);
}

export async function verifyBiosAiDesktopShellPackageFoundationGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const normalizedRoot = path.resolve(repoRoot);
  const dependencyRoot = resolveDependencyRoot(normalizedRoot, params.env);
  const missingPackageFiles = await findMissingPackageFiles(
    dependencyRoot,
    params.packageChecks ?? REQUIRED_PACKAGE_FILES,
  );
  const contractChecks = await verifyContractNeedles(
    normalizedRoot,
    params.contractChecks ?? REQUIRED_CONTRACT_NEEDLES,
  );
  const checks = [
    {
      name: "Required package-manager entries exist for desktop-shell export, tsx tests, and Vitest",
      status: missingPackageFiles.length === 0 ? "pass" : "fail",
      missing: missingPackageFiles,
    },
    ...contractChecks,
  ];
  const report = {
    repoRoot: normalizedRoot,
    dependencyRoot,
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "blocked",
    owner: "scripts/bios-ai-desktop-shell-package-foundation-gate.mjs",
    packageManager: "pnpm 10.33.2 via corepack",
    requiredProofAfterRepair: [
      "node scripts/desktop-shell-smoke.mjs",
      "node --import tsx --test packages/desktop-shell/src/*.test.ts",
      "node scripts/bios-ai-desktop-shell-decision-gate.mjs",
    ],
    recoveryHint:
      "Repair the hoisted node_modules tree with pinned corepack pnpm, then rerun this gate before Electron package proof.",
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
  const result = await verifyBiosAiDesktopShellPackageFoundationGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
