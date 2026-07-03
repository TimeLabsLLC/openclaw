import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiTauriReleasePathBlockGate } from "../../scripts/bios-ai-tauri-release-path-block-gate.mjs";

async function fixtureRepo(ownerTextByFile = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-tauri-block-"));
  for (const [relativePath, source] of Object.entries(ownerTextByFile)) {
    const filePath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source);
  }
  return repoRoot;
}

const ELECTRON_IDENTITY = {
  shell: "electron",
  releaseExePath:
    "E:\\repo\\.artifacts\\desktop-shell\\bios-ai-electron-package\\win-unpacked\\BIOS AI.exe",
  setupExePath:
    "E:\\repo\\.artifacts\\desktop-shell\\bios-ai-electron-installer\\BIOS AI Setup 0.1.0.exe",
};

describe("BIOS AI Tauri release-path block gate", () => {
  it("passes when release owner files use Electron package proof", async () => {
    const repoRoot = await fixtureRepo({
      "scripts/release.mjs": "node scripts/bios-ai-build-identity.mjs",
      "package.json": JSON.stringify({
        scripts: {
          "bios-ai:build-identity": "node scripts/bios-ai-build-identity.mjs",
        },
      }),
    });
    const report = await verifyBiosAiTauriReleasePathBlockGate(repoRoot, {
      buildIdentity: ELECTRON_IDENTITY,
      releaseOwnerFiles: ["scripts/release.mjs", "package.json"],
      writeReport: false,
    });
    assert.equal(report.status, "pass");
  });

  it("fails when the canonical identity points at the old Tauri output", async () => {
    const repoRoot = await fixtureRepo({ "scripts/release.mjs": "node scripts/bios-ai-build-identity.mjs" });
    await assert.rejects(
      verifyBiosAiTauriReleasePathBlockGate(repoRoot, {
        buildIdentity: {
          shell: "tauri",
          releaseExePath: "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bios-ai.exe",
          setupExePath:
            "E:\\repo\\aether-canvas\\src-tauri\\target\\release\\bundle\\nsis\\BIOS AI_0.1.0_x64-setup.exe",
        },
        releaseOwnerFiles: ["scripts/release.mjs"],
        writeReport: false,
      }),
      /Canonical BIOS AI build identity/,
    );
  });

  it("fails when a release owner invokes or claims Tauri artifacts", async () => {
    const repoRoot = await fixtureRepo({
      "scripts/release.mjs": "cargo tauri build --target x86_64-pc-windows-msvc",
      "package.json": JSON.stringify({
        scripts: {
          "bios-ai:bad": "aether-canvas/src-tauri/target/release/bios-ai.exe",
        },
      }),
    });
    await assert.rejects(
      verifyBiosAiTauriReleasePathBlockGate(repoRoot, {
        buildIdentity: ELECTRON_IDENTITY,
        releaseOwnerFiles: ["scripts/release.mjs", "package.json"],
        writeReport: false,
      }),
      /Release owner files/,
    );
  });
});
