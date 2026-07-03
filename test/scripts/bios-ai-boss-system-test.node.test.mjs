import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMajorBossOvernightScenarioQueue,
  MAJOR_BOSS_TEST_SCENARIOS,
  MAJOR_BOSS_OVERNIGHT_CATEGORIES,
  runMajorBossOvernightArenaRun,
  runMajorBossSystemTest,
} from "../../scripts/bios-ai-boss-system-test.mjs";

function createHarnessFixture({ truthReady = true } = {}) {
  const calls = {
    posture: 0,
    chat: [],
    forge: [],
    proof: [],
    truth: [],
  };
  const measurementHistory = [];
  const runtimeClient = {
    async getCapabilityPosture() {
      calls.posture += 1;
      const truthPack = truthReady
        ? {
            readiness: "ready",
            governance_state: "clear",
            compact_summary: "Use compact operating truth before action.",
          }
        : null;
      return {
        chat: { ready: true },
        truthPack,
        truthSpine: truthReady ? { ready: true, readiness: "ready" } : { ready: false },
        biosMemory: { ready: true },
        tools: { ready: calls.posture % 2 === 1 },
        connectors: { ready: false },
        observation: { ready: true },
        summary: "Local supervisor is ready for the harness.",
      };
    },
    async sendChatMessage(input) {
      calls.chat.push(input);
      return {
        ok: true,
        transport: "local-supervisor",
        workerRole: calls.chat.length > 1 ? "medium_worker" : "small_worker",
        responseText: `Handled ${input.normalizedText}`,
        conversationHistory: [
          ...(input.conversationHistory || []),
          { role: "user", text: input.normalizedText },
          { role: "assistant", text: `Handled ${input.normalizedText}` },
        ],
        actionResults: [],
        actionEvents: [{ type: "test_event" }],
      };
    },
  };
  const forgeArena = {
    async runLocalBossProvingRound(input) {
      calls.forge.push(input);
      const index = calls.forge.length;
      const artifactId = `boss-test-artifact-${index}`;
      measurementHistory.push({ id: `measurement-${index}`, score: 80 + index });
      return {
        runs: [
          {
            id: artifactId,
            title: input.artifactTitle,
            score: 80 + index,
            summary: input.artifactSummary,
            lastJudgement: "local-proof",
          },
        ],
        localArena: {
          artifacts: [
            {
              id: artifactId,
              title: input.artifactTitle,
              summary: input.artifactSummary,
              score: 80 + index,
              verdict: "local-proof",
              proof_refs: [`proof:${artifactId}`],
            },
          ],
          measurement_history: [...measurementHistory],
          learning_bridge: {
            ready: measurementHistory.length >= 3,
            summary: `${measurementHistory.length} proving rounds recorded.`,
            reflex_candidate: "Name blocked paths.",
          },
        },
      };
    },
  };
  return { calls, runtimeClient, forgeArena };
}

test("major BOSS system harness rejects profileless runs before writing state", async () => {
  const fixture = createHarnessFixture();
  await assert.rejects(
    () =>
      runMajorBossSystemTest({
        profileId: "",
        agentName: "Claw",
        ...fixture,
      }),
    /active BOSS profile id/,
  );
  assert.equal(fixture.calls.chat.length, 0);
  assert.equal(fixture.calls.forge.length, 0);
});

test("major BOSS system harness refuses to pass without compact operating truth", async () => {
  const fixture = createHarnessFixture({ truthReady: false });
  await assert.rejects(
    () =>
      runMajorBossSystemTest({
        profileId: "claw",
        agentName: "Claw",
        runtimeMode: "test-runtime",
        ...fixture,
      }),
    /compact BOSS operating truth/,
  );
  assert.equal(fixture.calls.chat.length, 0);
  assert.equal(fixture.calls.forge.length, 0);
});

test("major BOSS system harness runs five vertical proving scenarios through runtime and Forge bridges", async () => {
  const fixture = createHarnessFixture();
  const report = await runMajorBossSystemTest({
    profileId: "claw",
    agentName: "Claw",
    runtimeMode: "test-runtime",
    recordProofEvent: async (event) => fixture.calls.proof.push(event),
    recordTruthSessionUpdate: async (event) => fixture.calls.truth.push(event),
    now: (() => {
      let value = 1781760000;
      return () => value++;
    })(),
    ...fixture,
  });

  assert.equal(report.status, "passed_local_major_boss_contract");
  assert.equal(report.scenario_count, MAJOR_BOSS_TEST_SCENARIOS.length);
  assert.equal(report.proving_round_count, 5);
  assert.equal(report.final_measurement_history_count, 5);
  assert.equal(fixture.calls.chat.length, 5);
  assert.equal(fixture.calls.forge.length, 5);
  assert.equal(fixture.calls.truth.length, 10);
  assert.equal(fixture.calls.proof.length, 1);
  assert.equal(report.scenarios[0].selected_worker_route, "small_worker");
  assert.equal(report.scenarios[4].selected_worker_route, "medium_worker");
  assert(
    report.scenarios.every((scenario) =>
      scenario.boundary_truth.includes("Private BIOS operating truth remains local-only"),
    ),
  );
  assert(
    report.scenarios.some((scenario) => scenario.blocked_paths.includes("public_forge_publish")),
  );
  assert(
    fixture.calls.forge.every((call) => Array.isArray(call.attemptedCapabilities)),
    "Forge bridge should receive scenario capability boundaries.",
  );
  assert(
    report.scenarios.every((scenario) => scenario.context_governor.context_window_tokens === 8192),
    "Every Major BOSS scenario should carry context-governor proof.",
  );
});

test("major BOSS overnight queue expands ten categories across the five scenario contracts", () => {
  const queue = buildMajorBossOvernightScenarioQueue();
  assert.equal(queue.length, 50);
  assert.equal(queue[0].id, "local-build:local-creation-truthful-limits");
  assert.equal(queue.at(-1).id, "forge-participation:sovereignty-boundary");
  assert.equal(new Set(queue.map((scenario) => scenario.category_id)).size, 10);
  assert.equal(MAJOR_BOSS_OVERNIGHT_CATEGORIES.length, 10);
  assert(
    queue.every((scenario) => scenario.prompt.includes("lane")),
    "category prompt prefix should be visible in every overnight scenario",
  );
});

test("major BOSS overnight runner records fifty scenarios in three-scenario batches with cooldown and telemetry", async () => {
  const fixture = createHarnessFixture();
  const waits = [];
  const report = await runMajorBossOvernightArenaRun({
    profileId: "claw",
    agentName: "Claw",
    runtimeMode: "test-runtime",
    batchSize: 3,
    cooldownMs: 120_000,
    readGpuTelemetry: async () => ({
      status: "ready",
      source: "nvidia-smi",
      gpu_name: "NVIDIA Test GPU",
      temperature_c: 60,
      memory_used_mb: 2048,
      memory_total_mb: 16384,
      utilization_gpu_percent: 45,
      power_draw_watts: 115,
    }),
    wait: async (durationMs) => waits.push(durationMs),
    now: (() => {
      let value = 1781765000;
      return () => value++;
    })(),
    ...fixture,
  });

  assert.equal(report.status, "passed_overnight_major_boss_contract");
  assert.equal(report.scenario_count, 50);
  assert.equal(report.batch_count, 17);
  assert.equal(report.batch_size, 3);
  assert.equal(report.reconciliation.completed_scenarios, 50);
  assert.equal(report.reconciliation.judged_artifacts, 50);
  assert.equal(report.reconciliation.missing_artifact_count, 0);
  assert(report.reconciliation.max_prompt_tokens < 8192);
  assert.equal(waits.length, 16);
  assert(waits.every((durationMs) => durationMs === 120_000));
  assert.equal(fixture.calls.chat.length, 50);
  assert.equal(fixture.calls.forge.length, 50);
  assert(report.thermal_samples.length >= 34);
});

test("major BOSS overnight runner sleeps instead of sending accumulated history beyond local context", async () => {
  const fixture = createHarnessFixture();
  const longText = "prior context ".repeat(3000);
  fixture.runtimeClient.sendChatMessage = async (input) => {
    fixture.calls.chat.push(input);
    assert.equal(
      input.conversationHistory.length,
      0,
      "Overnight runner should clear carried history after memory sleep.",
    );
    return {
      ok: true,
      transport: "local-supervisor",
      workerRole: "small_worker",
      responseText: `Handled ${input.normalizedText}`,
      conversationHistory: [
        { role: "user", text: input.normalizedText },
        { role: "assistant", text: longText },
      ],
      actionResults: [],
      actionEvents: [],
    };
  };

  const report = await runMajorBossOvernightArenaRun({
    profileId: "claw",
    agentName: "Claw",
    runtimeMode: "test-runtime",
    batchSize: 3,
    cooldownMs: 0,
    maxScenarios: 6,
    now: (() => {
      let value = 1781768000;
      return () => value++;
    })(),
    ...fixture,
  });

  assert.equal(report.status, "passed_overnight_major_boss_contract");
  assert.equal(report.scenario_count, 6);
  assert.equal(report.reconciliation.completed_scenarios, 6);
  assert.equal(report.reconciliation.judged_artifacts, 6);
  assert.equal(report.reconciliation.missing_artifact_count, 0);
  assert(report.scenarios.every((scenario) => scenario.context_governor.final_tokens < 8192));
});

test("major BOSS overnight runner stops before a hot GPU batch", async () => {
  const fixture = createHarnessFixture();
  await assert.rejects(
    () =>
      runMajorBossOvernightArenaRun({
        profileId: "claw",
        agentName: "Claw",
        runtimeMode: "test-runtime",
        batchSize: 3,
        cooldownMs: 0,
        readGpuTelemetry: async () => ({
          status: "ready",
          source: "nvidia-smi",
          temperature_c: 90,
        }),
        ...fixture,
      }),
    /GPU temperature 90C exceeded 82C/,
  );
  assert.equal(fixture.calls.chat.length, 0);
  assert.equal(fixture.calls.forge.length, 0);
});
