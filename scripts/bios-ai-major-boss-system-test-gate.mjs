import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runMajorBossSystemTest } from "./bios-ai-boss-system-test.mjs";
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
    `BIOS AI packaged UX smoke did not run required Major BOSS scenario: ${scenario}`,
  );
}

export async function verifyBiosAiMajorBossSystemTestGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke =
    params.uxSmoke ??
    (await smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? {
        scenarios: ["forge-arena-local-proving-ground", "truthspine-session-update"],
      },
    ));
  const harnessSource = await readRepoFile(repoRoot, "scripts/bios-ai-boss-system-test.mjs");
  const appHarnessSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/major-boss-system-test.js",
  );
  const harnessTestSource = await readRepoFile(
    repoRoot,
    "test/scripts/bios-ai-boss-system-test.node.test.mjs",
  );
  const localSupervisorSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/runtime-transport/local-supervisor-transport.js",
  );
  const forgeServiceSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/forge-arena-service.js",
  );
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const releaseSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-release-smoke.mjs");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Major BOSS system test gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Major BOSS system test gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "memory-active-state", "profile-owned-worker-truth"],
    "BIOS AI packaged state smoke",
  );
  assertScenarioRan(uxSmoke, "forge-arena-local-proving-ground");
  assertScenarioRan(uxSmoke, "truthspine-session-update");

  assertAllIncluded(
    appHarnessSource,
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
      "context_governor",
      "reconciliation",
      "buildContextSleepTruthEvent",
    ],
    "Major BOSS system test app/runtime harness contract",
  );
  assertAllIncluded(
    harnessSource,
    [
      "../aether-canvas/js/major-boss-system-test.js",
      "runMajorBossOvernightArenaRun",
      "Real packaged Major BOSS system tests must be launched from the BIOS AI app harness",
      "fixture-runtime",
    ],
    "Major BOSS system test CLI wrapper",
  );
  assertAllIncluded(
    harnessTestSource,
    [
      "rejects profileless runs before writing state",
      "refuses to pass without compact operating truth",
      "runs five vertical proving scenarios through runtime and Forge bridges",
      "overnight queue expands ten categories across the five scenario contracts",
      "overnight runner records fifty scenarios in three-scenario batches",
      "overnight runner sleeps instead of sending accumulated history beyond local context",
      "overnight runner stops before a hot GPU batch",
      "public_forge_publish",
    ],
    "Major BOSS system test focused tests",
  );
  assertAllIncluded(
    localSupervisorSource,
    [
      "getCapabilityPosture",
      "sendChatMessage",
      "record_bios_truth_session_update",
      "buildLocalCapabilitySystemPrompt",
      "chat.context_governor",
    ],
    "Major BOSS local supervisor runtime bridge",
  );
  assertAllIncluded(
    forgeServiceSource,
    ["runLocalBossProvingRound", "learningBridge", "Learning Bridge", "Worker Governance"],
    "Major BOSS Forge measurement bridge",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "BOSS Operating Truth",
      "TruthSpine must remain an internal BOSS mechanism",
      "forge-arena-local-proving-ground",
      "Learning bridge ready",
      "forge-arena-run-major-boss-test",
      "forge-arena-run-overnight-boss-test",
      "packaged-app-real-runtime",
    ],
    "Major BOSS packaged UX truth",
  );
  assertAllIncluded(
    releaseSmokeSource,
    ["verifyBiosAiMajorBossSystemTestGate", "majorBossSystemTestGate"],
    "Major BOSS release smoke wiring",
  );

  const fixtureReport =
    params.fixtureReport ??
    (await runMajorBossSystemTest({
      profileId: "claw",
      agentName: "Claw",
      runtimeMode: "fixture-runtime",
      runtimeClient: {
        async getCapabilityPosture() {
          return {
            chat: { ready: true },
            truthPack: {
              readiness: "ready",
              governance_state: "clear",
              compact_summary: "Fixture compact operating truth.",
            },
            truthSpine: { ready: true, readiness: "ready" },
            biosMemory: { ready: true },
            tools: { ready: true },
            connectors: { ready: false },
            observation: { ready: true },
            summary: "Fixture local supervisor posture.",
          };
        },
        async sendChatMessage({ normalizedText, conversationHistory }) {
          return {
            ok: true,
            transport: "local-supervisor",
            workerRole: "small_worker",
            responseText: `Handled: ${normalizedText}`,
            conversationHistory: [
              ...(conversationHistory || []),
              { role: "user", text: normalizedText },
              { role: "assistant", text: `Handled: ${normalizedText}` },
            ],
            actionResults: [],
            actionEvents: [],
          };
        },
      },
      forgeArena: {
        async runLocalBossProvingRound({ artifactTitle, artifactSummary }) {
          this.count = (this.count || 0) + 1;
          const artifactId = `gate-fixture-${this.count}`;
          const history = Array.from({ length: this.count }, (_, index) => ({
            id: `measurement-${index + 1}`,
            score: 80 + index,
          }));
          return {
            runs: [{ id: artifactId, title: artifactTitle, score: 80, summary: artifactSummary }],
            localArena: {
              artifacts: [
                {
                  id: artifactId,
                  title: artifactTitle,
                  summary: artifactSummary,
                  score: 80,
                  proof_refs: [`proof:${artifactId}`],
                },
              ],
              measurement_history: history,
              learning_bridge: {
                ready: history.length >= 3,
                summary: `${history.length} measurement(s).`,
                reflex_candidate: "Name blocked paths.",
              },
            },
          };
        },
      },
      now: (() => {
        let value = 1781761000;
        return () => value++;
      })(),
    }));

  assertCondition(
    fixtureReport.status === "passed_local_major_boss_contract",
    `Major BOSS fixture contract did not pass: ${fixtureReport.status}`,
  );
  assertCondition(
    fixtureReport.scenario_count >= 5 && fixtureReport.final_measurement_history_count >= 3,
    "Major BOSS fixture contract must prove five scenarios and three-plus Forge measurements.",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    majorBossSystemTestGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    fixtureRuntimeProof: {
      runId: fixtureReport.run_id,
      status: fixtureReport.status,
      scenarioCount: fixtureReport.scenario_count,
      finalMeasurementHistoryCount: fixtureReport.final_measurement_history_count,
    },
    packagedUxCoverage: [
      "B.I.O.S. surface hides TruthSpine behind BOSS Operating Truth language",
      "Forge Arena local proving ground proves the packaged local measurement surface",
      "Forge Arena exposes Run BOSS System Test and reports packaged-app-real-runtime status",
      "Forge Arena exposes Run Overnight Arena with 50-scenario, 3-per-batch cooldown truth, judged-artifact reconciliation, and context-sleep count",
    ],
    blockedBypassCoverage: [
      "profileless Major BOSS system test runs are rejected before writes",
      "missing compact operating truth rejects the harness before chat or Forge writes",
      "fixture runtime cannot be mistaken for final packaged real-runtime proof because runtime_mode is recorded",
      "model-context governor compacts oversized local-worker prompts before they can reach the LLM endpoint",
      "overnight Arena progress reconciles completed scenarios with judged artifacts",
    ],
    canonicalTests: [
      "bios-ai-boss-system-test.node.test.mjs",
      "aether-canvas/js/major-boss-system-test.js",
      "aether-canvas/js/model-context-governor.test.js",
      "bios-surface-ui internal-only operating-truth test",
      "local-capability-posture internal-only operating-truth test",
      "packaged UX smoke truthspine-session-update and forge-arena-local-proving-ground",
    ],
  };
}

function isMainModule() {
  const argv1 = process.argv[1];
  return Boolean(argv1 && import.meta.url === pathToFileURL(argv1).href);
}

if (isMainModule()) {
  const result = await verifyBiosAiMajorBossSystemTestGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
