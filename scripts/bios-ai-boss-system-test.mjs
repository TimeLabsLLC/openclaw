import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildMajorBossOvernightScenarioQueue,
  MAJOR_BOSS_TEST_SCENARIOS,
  MAJOR_BOSS_OVERNIGHT_CATEGORIES,
  MAJOR_BOSS_OVERNIGHT_VERSION,
  MAJOR_BOSS_TEST_VERSION,
  runMajorBossOvernightArenaRun,
  runMajorBossSystemTest,
} from "../aether-canvas/js/major-boss-system-test.js";

export {
  buildMajorBossOvernightScenarioQueue,
  MAJOR_BOSS_OVERNIGHT_CATEGORIES,
  MAJOR_BOSS_OVERNIGHT_VERSION,
  MAJOR_BOSS_TEST_SCENARIOS,
  MAJOR_BOSS_TEST_VERSION,
  runMajorBossOvernightArenaRun,
  runMajorBossSystemTest,
};

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createFixtureRuntime() {
  const state = {
    turns: [],
    measurementHistory: [],
  };
  const truthSpine = {
    ready: true,
    readiness: "ready",
    governance_state: "clear",
    summary: "Compact BOSS operating truth is ready for the fixture run.",
    tiny_pack: {
      readiness: "ready",
      governance_state: "clear",
      compact_summary: "Use proof, memory, and blocked-path truth before acting.",
      active_decisions: ["Do not claim public Forge publication from local-only proof."],
      dead_ends: ["Do not expose private BIOS truth publicly."],
      next_actions: ["Run local proving rounds and record blocked paths."],
      warnings: [],
    },
  };
  return {
    runtimeClient: {
      async getCapabilityPosture() {
        return {
          chat: { ready: true },
          truthSpine,
          truthPack: truthSpine.tiny_pack,
          biosMemory: { ready: true },
          tools: { ready: state.turns.length % 2 === 0 },
          connectors: { ready: false },
          observation: { ready: true },
          summary:
            "Fixture runtime is route-ready with compact BOSS operating truth and local-only Forge boundaries.",
        };
      },
      async sendChatMessage({ normalizedText, conversationHistory }) {
        const responseText = `BOSS fixture response: ${normalizedText} Blocked public or unsafe paths are named before action.`;
        const nextHistory = [
          ...(Array.isArray(conversationHistory) ? conversationHistory : []),
          { role: "user", text: normalizedText },
          { role: "assistant", text: responseText },
        ];
        state.turns.push({ normalizedText, responseText });
        return {
          ok: true,
          transport: "local-supervisor",
          workerRole: state.turns.length > 2 ? "medium_worker" : "small_worker",
          responseText,
          conversationHistory: nextHistory,
          actionResults: [],
          actionEvents: [{ type: "fixture_turn_recorded" }],
        };
      },
    },
    forgeArena: {
      async runLocalBossProvingRound({ artifactTitle, artifactSummary }) {
        const index = state.measurementHistory.length + 1;
        const artifactId = `major-boss-fixture-${index}`;
        const score = 70 + index * 3;
        state.measurementHistory.push({
          id: `measurement-${index}`,
          score,
          summary: `Fixture measurement ${index} recorded.`,
        });
        return {
          runs: [
            {
              id: artifactId,
              title: artifactTitle,
              score,
              summary: artifactSummary,
              lastJudgement: "local-proof",
            },
          ],
          localArena: {
            artifacts: [
              {
                id: artifactId,
                title: artifactTitle,
                summary: artifactSummary,
                score,
                verdict: "local-proof",
                proof_refs: [`fixture-proof:${artifactId}`],
              },
            ],
            measurement_history: [...state.measurementHistory],
            learning_bridge: {
              ready: state.measurementHistory.length >= 3,
              summary: `${state.measurementHistory.length} fixture proving round(s) measured.`,
              reflex_candidate: "Name blocked paths before action.",
            },
          },
        };
      },
    },
  };
}

async function runCli() {
  const repoRoot = resolveRepoRoot();
  const fixtureMode = process.argv.includes("--fixture");
  assertCondition(
    fixtureMode,
    "Real packaged Major BOSS system tests must be launched from the BIOS AI app harness. Use --fixture only for contract verification.",
  );
  const fixture = createFixtureRuntime();
  const report = await runMajorBossSystemTest({
    profileId: "claw",
    agentName: "Claw",
    runtimeMode: "fixture-runtime",
    ...fixture,
  });
  const outputPath = path.join(
    repoRoot,
    "runtime",
    "outputs",
    "bios-ai-major-boss-system-test-fixture.json",
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ outputPath, ...report }, null, 2)}\n`);
}

function isMainModule() {
  const argv1 = process.argv[1];
  return Boolean(argv1 && import.meta.url === pathToFileURL(argv1).href);
}

if (isMainModule()) {
  await runCli();
}
