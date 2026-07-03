import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertBiosAiPackageTargetConfig,
  inspectBiosAiCrossOsPackageArtifacts,
  verifyBiosAiCrossOsPackageReadiness,
} from "../../scripts/bios-ai-cross-os-package-readiness.mjs";

async function fixtureRepo() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-cross-os-electron-readiness-"));
  await mkdir(path.join(repoRoot, ".github", "workflows"), { recursive: true });
  await writeFile(
    path.join(repoRoot, ".github", "workflows", "bios-ai-cross-os-package-readiness.yml"),
    [
      "name: BIOS AI Cross-OS Package Readiness",
      "jobs:",
      "  package-readiness:",
      "    strategy:",
      "      matrix:",
      "        os: [windows-latest, macos-15-intel, ubuntu-24.04]",
      "    steps:",
      "      - run: node scripts/bios-ai-cross-os-package-readiness.mjs # bios-ai-electron-package",
    ].join("\n"),
  );
  return repoRoot;
}

async function writeArtifact(repoRoot, relativePath, contents = "artifact") {
  const artifactPath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, contents);
  return artifactPath;
}

async function writePlatformArtifacts(repoRoot, platform) {
  if (platform === "win32") {
    await writeArtifact(
      repoRoot,
      path.join(
        ".artifacts",
        "desktop-shell",
        "bios-ai-electron-package",
        "win-unpacked",
        "BIOS AI.exe",
      ),
    );
    await writeArtifact(
      repoRoot,
      path.join(
        ".artifacts",
        "desktop-shell",
        "bios-ai-electron-package",
        "win-unpacked",
        "resources",
        "bin",
        "llama-server.exe",
      ),
    );
    return;
  }
  if (platform === "darwin") {
    await writeArtifact(
      repoRoot,
      path.join(
        ".artifacts",
        "desktop-shell",
        "bios-ai-electron-package",
        "mac",
        "BIOS AI.app",
        "Contents",
        "MacOS",
        "Electron",
      ),
    );
    await writeArtifact(
      repoRoot,
      path.join(
        ".artifacts",
        "desktop-shell",
        "bios-ai-electron-package",
        "mac",
        "BIOS AI.app",
        "Contents",
        "Resources",
        "bin",
        "llama-server",
      ),
    );
    return;
  }
  await writeArtifact(
    repoRoot,
    path.join(
      ".artifacts",
      "desktop-shell",
      "bios-ai-electron-package",
      "linux-unpacked",
      "bios-ai",
    ),
  );
  await writeArtifact(
    repoRoot,
    path.join(
      ".artifacts",
      "desktop-shell",
      "bios-ai-electron-package",
      "linux-unpacked",
      "resources",
      "bin",
      "llama-server",
    ),
  );
}

describe("BIOS AI cross-OS package readiness", () => {
  it("requires the Electron shell and all hosted runner OSes", () => {
    assert.deepEqual(
      assertBiosAiPackageTargetConfig(
        { shell: "electron", workflowOses: ["windows-latest", "macos-15-intel", "ubuntu-24.04"] },
        "linux",
      ),
      {
        shell: "electron",
        workflowOses: ["windows-latest", "macos-15-intel", "ubuntu-24.04"],
        platformArtifacts: ["Linux Electron executable", "Linux llama.cpp sidecar binary"],
      },
    );
    assert.throws(
      () =>
        assertBiosAiPackageTargetConfig(
          { shell: "tauri", workflowOses: ["windows-latest"] },
          "darwin",
        ),
      /Electron shell/,
    );
    assert.throws(
      () =>
        assertBiosAiPackageTargetConfig(
          { shell: "electron", workflowOses: ["windows-latest", "ubuntu-24.04"] },
          "darwin",
        ),
      /missing hosted runner: macos-15-intel/,
    );
  });

  it("detects Electron package artifacts for each hosted-runner platform", async () => {
    const repoRoot = await fixtureRepo();
    await writePlatformArtifacts(repoRoot, "win32");
    await writePlatformArtifacts(repoRoot, "darwin");
    await writePlatformArtifacts(repoRoot, "linux");

    const windows = await inspectBiosAiCrossOsPackageArtifacts(repoRoot, { platform: "win32" });
    const macos = await inspectBiosAiCrossOsPackageArtifacts(repoRoot, { platform: "darwin" });
    const linux = await inspectBiosAiCrossOsPackageArtifacts(repoRoot, { platform: "linux" });

    assert.deepEqual(
      windows.map((artifact) => artifact.label),
      ["Windows Electron executable", "Windows llama.cpp sidecar binary"],
    );
    assert.deepEqual(
      macos.map((artifact) => artifact.label),
      ["macOS Electron app executable", "macOS llama.cpp sidecar binary"],
    );
    assert.deepEqual(
      linux.map((artifact) => artifact.label),
      ["Linux Electron executable", "Linux llama.cpp sidecar binary"],
    );
  });

  it("runs Electron runtime, package, and visible product-flow gates before writing a summary", async () => {
    const repoRoot = await fixtureRepo();
    await writePlatformArtifacts(repoRoot, "linux");
    const calls = [];
    let productFlowEnv;
    const summaryPath = path.join(repoRoot, "summary.json");

    const result = await verifyBiosAiCrossOsPackageReadiness(repoRoot, {
      platform: "linux",
      summaryPath,
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
      },
      runRuntimeGate: async () => ({ status: "pass" }),
      runPackageGate: async () => ({ status: "pass" }),
      runProductFlowGate: async (_repoRoot, params) => {
        productFlowEnv = params.env;
        return { status: "pass" };
      },
    });

    assert.equal(result.status, "ready");
    assert.equal(result.shell, "electron");
    assert.deepEqual(result.gates, [
      "Electron runtime package gate",
      "Electron unpacked package artifact gate",
      "Visible packaged product-flow proof",
    ]);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, [path.join("aether-canvas", "scripts", "prepare-dist.mjs")]);
    assert.equal(
      await readFile(
        path.join(productFlowEnv.BIOS_AI_MODELS_DIR, "gemma-3-1b-it-Q4_K_M.gguf"),
        "utf8",
      ),
      "BIOS AI packaged product-flow proof model placeholder; not a real inference model.\n",
    );
    assert.equal(JSON.parse(await readFile(summaryPath, "utf8")).platform, "linux");
  });

  it("keeps the GitHub matrix tied to Electron package readiness proof", async () => {
    const workflowText = await readFile(
      ".github/workflows/bios-ai-cross-os-package-readiness.yml",
      "utf8",
    );
    const releaseSmokeSource = await readFile("scripts/bios-ai-release-smoke.mjs", "utf8");

    assert.ok(workflowText.includes("name: BIOS AI Cross-OS Package Readiness"));
    assert.ok(workflowText.includes("package-readiness:"));
    assert.ok(workflowText.includes("- windows-latest"));
    assert.ok(workflowText.includes("- macos-15-intel"));
    assert.ok(workflowText.includes("- ubuntu-24.04"));
    assert.ok(workflowText.includes("pnpm rebuild electron"));
    assert.ok(workflowText.includes("pnpm exec install-electron"));
    assert.ok(workflowText.includes("pnpm exec electron --no-sandbox --version"));
    assert.ok(workflowText.includes("pnpm exec electron --version"));
    assert.ok(workflowText.includes("node scripts/bios-ai-prepare-llama-sidecar.mjs"));
    assert.ok(
      workflowText.includes("xvfb-run -a node scripts/bios-ai-cross-os-package-readiness.mjs"),
    );
    assert.ok(workflowText.includes("bios-ai-electron-package/**"));
    assert.ok(workflowText.includes("runtime/outputs/bios-ai-llama-sidecar-*.json"));
    assert.ok(workflowText.includes("runtime/outputs/bios-ai-electron-product-flow/**"));
    assert.ok(workflowText.includes("name: Upload package readiness proof"));
    assert.ok(workflowText.includes("if: always()"));
    assert.ok(releaseSmokeSource.includes("verifyBiosAiElectronPackageArtifactGate"));
    assert.ok(!releaseSmokeSource.includes('"--bundles",\n      "nsis"'));
  });
});
