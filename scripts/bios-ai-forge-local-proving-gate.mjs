import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";
import { smokeBiosAiPackagedState } from "./bios-ai-packaged-state-smoke.mjs";
import { smokeBiosAiUx } from "./bios-ai-ux-smoke.mjs";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertAllIncluded(haystack, needles, label) {
  for (const needle of needles) {
    assertCondition(haystack.includes(needle), `${label} missing required proof: ${needle}`);
  }
}

function assertScenarioRan(uxSmoke, scenario) {
  assertCondition(
    Array.isArray(uxSmoke.scenarios) && uxSmoke.scenarios.includes(scenario),
    `BIOS AI packaged UX smoke did not run required Forge Arena scenario: ${scenario}`,
  );
}

export async function verifyBiosAiForgeLocalProvingGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke =
    params.uxSmoke ??
    (await smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? { scenarios: ["forge-arena-local-proving-ground"] },
    ));
  const rustSource = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/forge_arena_local.rs",
  );
  const libSource = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/lib.rs");
  const serviceSource = await readRepoFile(repoRoot, "aether-canvas/js/forge-arena-service.js");
  const appSource = await readRepoFile(repoRoot, "aether-canvas/js/app.js");
  const indexSource = await readRepoFile(repoRoot, "aether-canvas/index.html");
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Forge Arena local gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Forge Arena local gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "memory-active-state", "profile-owned-worker-truth"],
    "BIOS AI packaged state smoke",
  );
  assertScenarioRan(uxSmoke, "forge-arena-local-proving-ground");

  assertAllIncluded(
    rustSource,
    [
      "pub async fn load_forge_arena_local_state",
      "pub async fn run_forge_arena_boss_proving_round",
      "record_bios_memory_event",
      "record_bios_truth_session_update",
      "try_record_bios_runtime_proof",
      "ForgeArenaLocalLearningBridge",
      "ForgeArenaLocalMeasurementRecord",
      "learning_bridge",
      "measurement_history",
      "worker_governance_summary",
      "reflex_candidate",
      "RecordForgeArenaLocalParticipationInput",
      "pub async fn record_forge_arena_local_participation",
      "seeds_local_arena_with_bots_and_artifacts",
      "boss_proving_round_persists_measurement_and_blocked_truth",
      "learning_bridge_tracks_repeated_run_deltas",
      "local_participation_records_publish_replay_and_return_loop_truth",
    ],
    "Forge Arena native local runtime",
  );
  assertAllIncluded(
    libSource,
    [
      "mod forge_arena_local",
      "forge_arena_local::load_forge_arena_local_state",
      "forge_arena_local::run_forge_arena_boss_proving_round",
      "forge_arena_local::record_forge_arena_local_participation",
    ],
    "Forge Arena Tauri command registration",
  );
  assertAllIncluded(
    serviceSource,
    [
      "getLocalSnapshot",
      "runLocalBossProvingRound",
      "recordLocalParticipation",
      "Native packaged local Arena contract",
      "Local Forge Arena proving ground live",
      "Learning Bridge",
      "Worker Governance",
      "Reflex Candidate",
    ],
    "Forge Arena JS local fallback",
  );
  assertAllIncluded(
    appSource,
    [
      "forge-arena-run-local-proof",
      "runLocalBossProvingRound",
      "forge-arena-record-co-build",
      "forge-arena-save-replay",
      "recordLocalParticipation",
      "Local BOSS proving round judged with score",
    ],
    "Forge Arena UI runtime wiring",
  );
  assertAllIncluded(
    indexSource,
    [
      "forge-arena-run-local-proof",
      "forge-arena-local-proof-status",
      "forge-arena-local-participation-status",
      "forge-arena-record-co-build",
      "forge-arena-save-replay",
      "Run Local Proof",
      "Record Co-Build",
      "Save Replay",
    ],
    "Forge Arena UI truth",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "forge-arena-local-proving-ground",
      "forge-arena-run-local-proof",
      "truthfully naming 1 blocked capability path",
      "Learning bridge ready",
      "Worker Governance",
      "Reflex Candidate",
      "Tiny local game",
      "Local participation",
      "published local",
      "Local co build recorded with score",
      "Local replay recorded with score",
    ],
    "Forge Arena packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "load_forge_arena_local_state",
      "run_forge_arena_boss_proving_round",
      "Spark Judge",
      "learning_bridge",
      "measurement_history",
      "worker_governance_summary",
      "reflex_candidate",
      "record_forge_arena_local_participation",
    ],
    "Forge Arena packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Forge Arena canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    forgeArenaLocalProvingGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "forge-arena-local-proving-ground loads seeded bots through native local Arena state",
      "Run Local Proof records and renders a judged BOSS proving round",
      "Learning bridge, worker governance, and reflex candidate text render after the proving round",
      "Local publish, co-build, and replay actions record replayable local participation",
    ],
    blockedBypassCoverage: [
      "Forge Arena no longer depends only on gateway arena.get for packaged local usefulness",
      "BOSS proving rounds record memory, operating-truth session updates, and proof-spine events",
      "Arena learning cannot be score-only because measurement history and learning bridge are release-gated",
      "Local participation cannot silently fall back to gateway-only challenge creation when native local Arena is active",
    ],
    canonicalTests: [
      "forge_arena_local native Rust tests",
      "forge_arena_local repeated-run learning bridge delta test",
      "forge_arena_local local participation persistence test",
      "forge-arena-service local fallback tests",
      "app Forge Arena local proof action test",
    ],
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
  const result = await verifyBiosAiForgeLocalProvingGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
