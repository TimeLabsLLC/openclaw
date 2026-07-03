import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyBiosAiForgeGovernanceGate } from "../../scripts/bios-ai-forge-governance-gate.mjs";

async function writeFixture(repoRoot, relativePath, content) {
  const filePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

test("Forge Arena governance gate requires native, UI, smoke, and test proof", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-forge-governance-gate-"));
  await writeFixture(
    repoRoot,
    "aether-canvas/src-tauri/src/forge_arena_local.rs",
    [
      "ForgeArenaGovernanceState",
      "ForgeArenaGovernanceWorker",
      "ForgeArenaGovernanceRecord",
      "governance: ForgeArenaGovernanceState",
      "build_governance_state",
      "Forgewarden",
      "local_governance_preview",
      "surprise_event_policy",
      "must not override official seasonal ranking",
      "participation_health",
      "anti_abuse",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "aether-canvas/js/forge-arena-service.js",
    [
      "Arena BOSS Governance",
      "BOSS Delegation Lanes",
      "Arena Health",
      "governanceWorkerLanes",
      "surpriseEventPolicy",
      "arenaBossLabel",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "aether-canvas/js/forge-arena-service.test.js",
    [
      "Forgewarden",
      "local_governance_preview",
      "Arena BOSS Governance",
      "BOSS Delegation Lanes",
      "Arena Health",
      "must not override",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "scripts/bios-ai-ux-smoke.mjs",
    [
      "Arena BOSS Governance",
      "Forgewarden",
      "BOSS Delegation Lanes",
      "Arena Health",
      "Surprise events require Forgewarden approval",
      "must not override official seasonal ranking",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "scripts/bios-ai-ux-audit-server.mjs",
    [
      "buildForgeGovernance",
      "governance",
      "Forgewarden",
      "worker_lanes",
      "local_governance_preview",
      "surprise_event_policy",
      "participation_health",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "test/vitest/vitest.bios-ai.config.ts",
    'aether-canvas/js/**/*.test.js\nenvironment: "jsdom"\nname: "bios-ai"\nisolate: true',
  );

  const result = await verifyBiosAiForgeGovernanceGate(repoRoot, {
    buildIdentity: {
      productName: "BIOS AI",
      setupExePath: "target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
    },
    packagedState: {
      validatedSurfaces: ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
    },
    uxSmoke: {
      scenarios: ["forge-arena-local-proving-ground"],
    },
  });

  assert.equal(result.forgeArenaGovernanceGate, "complete");
  assert.match(result.packagedExeProof, /\.exe$/);
  assert.ok(result.packagedUxCoverage.some((entry) => entry.includes("Forgewarden")));
  assert.ok(result.blockedBypassCoverage.some((entry) => entry.includes("Surprise events")));
});
