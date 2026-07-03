import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyBiosAiMajorBossSystemTestGate } from "../../scripts/bios-ai-major-boss-system-test-gate.mjs";

async function writeFixtureFile(repoRoot, relativePath, content) {
  const target = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function createFixtureRepo() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-major-boss-gate-"));
  await writeFixtureFile(
    repoRoot,
    "aether-canvas/js/major-boss-system-test.js",
    [
      "MAJOR_BOSS_TEST_VERSION",
      "MAJOR_BOSS_TEST_SCENARIOS",
      "MAJOR_BOSS_OVERNIGHT_VERSION",
      "MAJOR_BOSS_OVERNIGHT_CATEGORIES",
      "buildMajorBossOvernightScenarioQueue",
      "runMajorBossOvernightArenaRun",
      "local-creation-truthful-limits",
      "tool-skill-gap-recommendation",
      "recovery-after-failure",
      "learning-across-repeated-runs",
      "sovereignty-boundary",
      "runtimeClient.getCapabilityPosture",
      "runtimeClient.sendChatMessage",
      "forgeArena.runLocalBossProvingRound",
      "Major BOSS system test needs an active BOSS profile id.",
      "cannot pass without compact BOSS operating truth",
      "Private BIOS operating truth remains local-only",
      "runtime_mode",
      "cooldown_ms",
      "thermal_samples",
    ].join("\n"),
  );
  await writeFixtureFile(
    repoRoot,
    "scripts/bios-ai-boss-system-test.mjs",
    [
      "../aether-canvas/js/major-boss-system-test.js",
      "runMajorBossOvernightArenaRun",
      "Real packaged Major BOSS system tests must be launched from the BIOS AI app harness",
      "fixture-runtime",
    ].join("\n"),
  );
  await writeFixtureFile(
    repoRoot,
    "test/scripts/bios-ai-boss-system-test.node.test.mjs",
    [
      "rejects profileless runs before writing state",
      "refuses to pass without compact operating truth",
      "runs five vertical proving scenarios through runtime and Forge bridges",
      "overnight queue expands ten categories across the five scenario contracts",
      "overnight runner records fifty scenarios in three-scenario batches",
      "overnight runner stops before a hot GPU batch",
      "public_forge_publish",
    ].join("\n"),
  );
  await writeFixtureFile(
    repoRoot,
    "aether-canvas/js/runtime-transport/local-supervisor-transport.js",
    [
      "getCapabilityPosture",
      "sendChatMessage",
      "record_bios_truth_session_update",
      "buildLocalCapabilitySystemPrompt",
    ].join("\n"),
  );
  await writeFixtureFile(
    repoRoot,
    "aether-canvas/js/forge-arena-service.js",
    ["runLocalBossProvingRound", "learningBridge", "Learning Bridge", "Worker Governance"].join(
      "\n",
    ),
  );
  await writeFixtureFile(
    repoRoot,
    "scripts/bios-ai-ux-smoke.mjs",
    [
      "BOSS Operating Truth",
      "TruthSpine must remain an internal BOSS mechanism",
      "forge-arena-local-proving-ground",
      "Learning bridge ready",
      "forge-arena-run-major-boss-test",
      "forge-arena-run-overnight-boss-test",
      "packaged-app-real-runtime",
    ].join("\n"),
  );
  await writeFixtureFile(
    repoRoot,
    "scripts/bios-ai-release-smoke.mjs",
    ["verifyBiosAiMajorBossSystemTestGate", "majorBossSystemTestGate"].join("\n"),
  );
  return repoRoot;
}

test("Major BOSS system test gate verifies harness, release wiring, UX truth, and fixture proof", async () => {
  const repoRoot = await createFixtureRepo();
  const result = await verifyBiosAiMajorBossSystemTestGate(repoRoot, {
    buildIdentity: {
      productName: "BIOS AI",
      setupExePath: "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
    },
    packagedState: {
      validatedSurfaces: ["profiles", "memory-active-state", "profile-owned-worker-truth"],
    },
    uxSmoke: {
      scenarios: ["forge-arena-local-proving-ground", "truthspine-session-update"],
    },
    fixtureReport: {
      run_id: "major-boss-claw-fixture",
      status: "passed_local_major_boss_contract",
      scenario_count: 5,
      final_measurement_history_count: 5,
    },
  });

  assert.equal(result.majorBossSystemTestGate, "complete");
  assert.equal(result.fixtureRuntimeProof.status, "passed_local_major_boss_contract");
  assert(
    result.blockedBypassCoverage.some((entry) =>
      entry.includes("missing compact operating truth rejects"),
    ),
  );
});
