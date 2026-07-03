import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiDesktopShellPackageFoundationGate } from "../../scripts/bios-ai-desktop-shell-package-foundation-gate.mjs";

async function writeFixtureFile(root, relativePath, content = "fixture\n") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function createContractFixture(root) {
  await writeFixtureFile(
    root,
    "packages/desktop-shell/src/app-targets.ts",
    [
      `"bios-ai"`,
      "aether-canvas/dist/index.html",
      "tauri-compatible-invoke",
      "packageProofRequired: true",
    ].join("\n"),
  );
  await writeFixtureFile(
    root,
    "packages/desktop-shell/src/contract.ts",
    ["App target:", "Package proof required:"].join("\n"),
  );
  await writeFixtureFile(
    root,
    "scripts/desktop-shell-smoke.mjs",
    ["appTarget", "Package proof required: no"].join("\n"),
  );
}

async function createRequiredPackageFixture(root) {
  const files = [
    "node_modules/ansis/package.json",
    "node_modules/ansis/index.mjs",
    "node_modules/esbuild/package.json",
    "node_modules/esbuild/lib/main.js",
    "node_modules/es-module-lexer/package.json",
    "node_modules/es-module-lexer/dist/lexer.js",
    "node_modules/tsdown/package.json",
    "node_modules/tsdown/dist/run.mjs",
    "node_modules/tsx/package.json",
    "node_modules/tsx/dist/loader.mjs",
    "node_modules/typescript/package.json",
    "node_modules/typescript/lib/typescript.js",
  ];
  for (const file of files) {
    await writeFixtureFile(root, file);
  }
}

describe("BIOS AI desktop shell package foundation gate", () => {
  it("reports the broken package entries that block desktop-shell export proof", async () => {
    const root = await mkdir(path.join(os.tmpdir(), "bios-ai-package-foundation-missing-"), {
      recursive: true,
    }).then(() => os.tmpdir());
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(root, "bios-ai-package-foundation-missing-")),
    );
    await createContractFixture(fixtureRoot);

    const report = await verifyBiosAiDesktopShellPackageFoundationGate(fixtureRoot, {
      writeReport: false,
      throwOnFailure: false,
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.checks[0].status, "fail");
    assert.ok(
      report.checks[0].missing.some((entry) => entry.file === "node_modules/ansis/index.mjs"),
    );
    assert.ok(
      report.checks[0].missing.some((entry) => entry.file === "node_modules/esbuild/package.json"),
    );
  });

  it("passes when package entries and desktop-shell target truth are present", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-package-foundation-pass-")),
    );
    await createContractFixture(fixtureRoot);
    await createRequiredPackageFixture(fixtureRoot);

    const report = await verifyBiosAiDesktopShellPackageFoundationGate(fixtureRoot, {
      writeReport: false,
    });

    assert.equal(report.status, "pass");
    assert.equal(report.checks.every((check) => check.status === "pass"), true);
  });

  it("uses an explicit dependency root while reading contracts from the repo root", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-package-foundation-repo-")),
    );
    const dependencyRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-package-foundation-deps-")),
    );
    await createContractFixture(fixtureRoot);
    await createRequiredPackageFixture(dependencyRoot);

    const report = await verifyBiosAiDesktopShellPackageFoundationGate(fixtureRoot, {
      env: {
        AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT: dependencyRoot,
      },
      writeReport: false,
    });

    assert.equal(report.status, "pass");
    assert.equal(report.repoRoot, path.resolve(fixtureRoot));
    assert.equal(report.dependencyRoot, path.resolve(dependencyRoot));
  });

  it("throws with a package-foundation error by default when required entries are missing", async () => {
    const fixtureRoot = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), "bios-ai-package-foundation-throw-")),
    );
    await createContractFixture(fixtureRoot);

    await assert.rejects(
      verifyBiosAiDesktopShellPackageFoundationGate(fixtureRoot, {
        writeReport: false,
      }),
      /desktop shell package foundation gate failed/i,
    );
  });
});
