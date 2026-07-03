import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createForgeArenaDom() {
  document.body.innerHTML = `
    <div id="forge-arena-create-feedback"></div>
    <div id="forge-arena-feature-action-status"></div>
    <div id="forge-arena-local-proof-status"></div>
    <div id="forge-arena-local-participation-status"></div>
    <div id="forge-arena-judge-feedback"></div>
    <form id="forge-arena-create-challenge-form">
      <input id="forge-arena-create-title" />
      <textarea id="forge-arena-create-summary"></textarea>
      <select id="forge-arena-create-status"><option value="open">open</option></select>
      <input id="forge-arena-create-owner-session" />
      <select id="forge-arena-create-scoring-rule"><option value="balanced">balanced</option></select>
      <input id="forge-arena-create-score-bonus" value="0" />
      <textarea id="forge-arena-create-result-summary"></textarea>
      <button id="forge-arena-create-challenge" type="submit">Create</button>
    </form>
    <button id="forge-arena-feature-active-run" type="button">Feature active run</button>
    <button id="forge-arena-run-local-proof" type="button">Run local proof</button>
    <button id="forge-arena-run-major-boss-test" type="button">Run BOSS system test</button>
    <button id="forge-arena-run-overnight-boss-test" type="button">Run overnight Arena</button>
    <button id="forge-arena-record-co-build" type="button">Record co-build</button>
    <button id="forge-arena-save-replay" type="button">Save replay</button>
    <div id="forge-arena-major-boss-status"></div>
    <div id="forge-arena-overnight-boss-status"></div>
    <select id="forge-arena-pair-run-select">
      <option value="">Select visible run</option>
      <option value="run-1">Run 1</option>
    </select>
    <button id="forge-arena-pair-selected-run" type="button">Pair selected run</button>
    <button id="forge-arena-judge-selected" type="button">Judge selected</button>
    <select id="forge-arena-challenge-filter"><option value="all">all</option></select>
    <select id="forge-arena-judge-verdict"><option value="promote">promote</option></select>
    <select id="forge-arena-judge-review-category"><option value="breakthrough">breakthrough</option></select>
    <input id="forge-arena-judge-score-delta" value="0" />
    <textarea id="forge-arena-judge-summary"></textarea>
    <button id="forge-arena-cancel-edit" type="button">Cancel</button>
  `;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushManyMicrotasks(count = 120) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

function createForgeArenaApp(overrides = {}) {
  const app = {
    activeSessionKey: "agent:main:main",
    gateway: { isConnected: true },
    forgeArenaActionState: {
      createStatus: "Ready to create a new challenge.",
      featureStatus: "Ready to feature the active run.",
      judgeStatus: "Select a challenge before judging.",
      pairStatus: "Select a challenge and a visible run to pair them.",
      reviewCategory: "breakthrough",
      localStatus: "Local proving ground is ready.",
      majorBossStatus: "Major BOSS system test is ready.",
      overnightStatus: "Overnight Arena run is ready.",
      participationStatus: "Local participation loop is ready.",
      editingChallengeId: null,
      selectedChallengeId: "challenge-1",
      challengeFilter: "all",
      selectedRunId: "run-1",
    },
    forgeArenaFeed: {
      challenges: [
        {
          id: "challenge-1",
          title: "Challenge One",
          status: "live",
          ownerSessionKey: "agent:main:main",
          scoringRule: "balanced",
          scoreBonus: 4,
          pairedRunId: "run-1",
        },
      ],
      runs: [
        {
          id: "run-1",
          title: "Run One",
          status: "complete",
          score: 42,
          sessionKey: "agent:main:main",
        },
      ],
    },
    forgeArena: {
      featureRun: vi.fn(),
      pairChallenge: vi.fn(),
      judgeChallenge: vi.fn(),
      createChallenge: vi.fn(),
      updateChallenge: vi.fn(),
      transitionChallenge: vi.fn(),
      runLocalBossProvingRound: vi.fn(),
      recordLocalParticipation: vi.fn(),
      getLocalSnapshot: vi.fn().mockResolvedValue({ localArena: { ready: true }, runs: [] }),
    },
    majorBossSystemTestReport: null,
    majorBossOvernightReport: null,
    getRuntimeTransportClient: vi.fn(),
    renderForgeArenaFeed() {
      const createNode = document.getElementById("forge-arena-create-feedback");
      const featureNode = document.getElementById("forge-arena-feature-action-status");
      const localNode = document.getElementById("forge-arena-local-proof-status");
      const majorNode = document.getElementById("forge-arena-major-boss-status");
      const overnightNode = document.getElementById("forge-arena-overnight-boss-status");
      const participationNode = document.getElementById("forge-arena-local-participation-status");
      const judgeNode = document.getElementById("forge-arena-judge-feedback");
      if (createNode) createNode.innerText = this.forgeArenaActionState.createStatus;
      if (featureNode) featureNode.innerText = this.forgeArenaActionState.featureStatus;
      if (localNode) localNode.innerText = this.forgeArenaActionState.localStatus;
      if (majorNode) majorNode.innerText = this.forgeArenaActionState.majorBossStatus || "";
      if (overnightNode) overnightNode.innerText = this.forgeArenaActionState.overnightStatus || "";
      if (participationNode)
        participationNode.innerText = this.forgeArenaActionState.participationStatus;
      if (judgeNode) judgeNode.innerText = this.forgeArenaActionState.judgeStatus;
    },
    async refreshForgeArenaFeed() {
      this.renderForgeArenaFeed();
    },
    renderProfileSettings: vi.fn(),
    initSettingsProviderPanel: vi.fn(),
    resetForgeArenaChallengeForm: AetherApp.prototype.resetForgeArenaChallengeForm,
    ...overrides,
  };

  return app;
}

describe("AetherApp Forge Arena actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows feature-run pending and success feedback", async () => {
    createForgeArenaDom();
    let releaseFeature;
    const app = createForgeArenaApp();
    app.forgeArena.featureRun.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFeature = resolve;
        }),
    );

    AetherApp.prototype.setupForgeArenaActions.call(app);

    const button = document.getElementById("forge-arena-feature-active-run");
    const status = document.getElementById("forge-arena-feature-action-status");

    button.click();
    await flushMicrotasks();

    expect(status.innerText).toBe("Featuring run for agent:main:main...");
    expect(button.hasAttribute("disabled")).toBe(true);

    releaseFeature();
    await flushMicrotasks();

    expect(status.innerText).toBe("Featured run updated to agent:main:main.");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("shows pair-run pending and failure feedback", async () => {
    createForgeArenaDom();
    let rejectPair;
    const app = createForgeArenaApp();
    app.forgeArena.pairChallenge.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPair = reject;
        }),
    );

    AetherApp.prototype.setupForgeArenaActions.call(app);

    const select = document.getElementById("forge-arena-pair-run-select");
    const button = document.getElementById("forge-arena-pair-selected-run");
    const status = document.getElementById("forge-arena-feature-action-status");
    select.value = "run-1";

    button.click();
    await flushMicrotasks();

    expect(status.innerText).toBe("Pairing Challenge One to run-1...");
    expect(button.hasAttribute("disabled")).toBe(true);

    rejectPair(new Error("gateway unavailable"));
    await flushMicrotasks();

    expect(status.innerText).toBe("Pairing failed: gateway unavailable");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("shows judge pending and success feedback", async () => {
    createForgeArenaDom();
    let releaseJudge;
    const app = createForgeArenaApp();
    app.forgeArena.judgeChallenge.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseJudge = resolve;
        }),
    );

    AetherApp.prototype.setupForgeArenaActions.call(app);

    const button = document.getElementById("forge-arena-judge-selected");
    const status = document.getElementById("forge-arena-judge-feedback");

    button.click();
    await flushMicrotasks();

    expect(status.innerText).toBe("Applying PROMOTE judgement to Challenge One...");
    expect(button.hasAttribute("disabled")).toBe(true);

    releaseJudge();
    await flushMicrotasks();

    expect(status.innerText).toBe("Judgement recorded for Challenge One (BREAKTHROUGH).");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("shows create-challenge pending and success feedback", async () => {
    createForgeArenaDom();
    let releaseCreate;
    const app = createForgeArenaApp();
    app.forgeArena.createChallenge.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseCreate = resolve;
        }),
    );

    AetherApp.prototype.setupForgeArenaActions.call(app);

    document.getElementById("forge-arena-create-title").value = "Launch check";
    document.getElementById("forge-arena-create-summary").value = "Verify the launch flow.";
    document.getElementById("forge-arena-create-score-bonus").value = "6";
    document.getElementById("forge-arena-create-result-summary").value = "Visible result";

    const form = document.getElementById("forge-arena-create-challenge-form");
    const button = document.getElementById("forge-arena-create-challenge");
    const status = document.getElementById("forge-arena-create-feedback");

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(status.innerText).toBe('Creating challenge "Launch check"...');
    expect(button.hasAttribute("disabled")).toBe(true);

    releaseCreate();
    await flushMicrotasks();

    expect(status.innerText).toBe(
      'Challenge "Launch check" created with balanced scoring (+6) and a result summary.',
    );
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("runs the local BOSS proving round through the native Forge Arena path", async () => {
    createForgeArenaDom();
    let releaseRound;
    const app = createForgeArenaApp({
      activeBiosProfileId: "claw",
      agentName: "Claw",
      forgeArenaProfile: { boss_display_name: "Claw" },
    });
    app.forgeArena.runLocalBossProvingRound.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRound = () =>
            resolve({
              runs: [{ id: "boss-run-claw-1", title: "BOSS Local Proving Run", score: 108 }],
            });
        }),
    );

    AetherApp.prototype.setupForgeArenaActions.call(app);

    const button = document.getElementById("forge-arena-run-local-proof");
    const status = document.getElementById("forge-arena-local-proof-status");

    button.click();
    await flushMicrotasks();

    expect(status.innerText).toBe("Running local BOSS proving round...");
    expect(button.hasAttribute("disabled")).toBe(true);

    releaseRound();
    await flushMicrotasks();

    expect(app.forgeArena.runLocalBossProvingRound).toHaveBeenCalledWith({
      profileId: "claw",
      bossLabel: "Claw",
      artifactTitle: "BOSS Local Proving Run",
      artifactSummary:
        "BOSS created a local Forge Arena proof artifact, measured blocked paths, and recorded the result into BIOS memory, operating truth, and proof spine.",
      attemptedCapabilities: [
        "local artifact creation",
        "native memory record",
        "truthspine session update",
        "network publish",
      ],
    });
    expect(status.innerText).toBe("Local BOSS proving round judged with score 108.");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("runs the 50-scenario overnight Arena test in 3-scenario batches with telemetry", async () => {
    createForgeArenaDom();
    const measurementHistory = [];
    const tauriInvoke = vi.fn(async (command, payload) => {
      if (command === "record_bios_truth_session_update") return { accepted: true, payload };
      if (command === "bios_gpu_telemetry") {
        return {
          status: "ready",
          source: "nvidia-smi",
          gpu_name: "NVIDIA Test GPU",
          temperature_c: 61,
          memory_used_mb: 2048,
          memory_total_mb: 16384,
          utilization_gpu_percent: 42,
          power_draw_watts: 120,
        };
      }
      if (command === "append_debug_log") return null;
      return null;
    });
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      value: { core: { invoke: tauriInvoke } },
    });
    const app = createForgeArenaApp({
      activeBiosProfileId: "claw",
      agentName: "Claw",
      forgeArenaProfile: { boss_display_name: "Claw" },
      majorBossOvernightCooldownMs: 0,
      majorBossOvernightWait: vi.fn(),
    });
    app.getRuntimeTransportClient.mockReturnValue({
      async getCapabilityPosture() {
        return {
          chat: { ready: true },
          truthPack: {
            readiness: "ready",
            governance_state: "clear",
            compact_summary: "Compact operating truth is attached.",
          },
          biosMemory: { ready: true },
          tools: { ready: true },
          connectors: { ready: false },
          observation: { ready: true },
          summary: "Route ready.",
        };
      },
      async sendChatMessage({ normalizedText, conversationHistory }) {
        return {
          ok: true,
          transport: "local-supervisor",
          workerRole: "overnight_worker",
          responseText: `Handled ${normalizedText} with proof, recovery, local boundary, and worker lane detail.`,
          conversationHistory: [
            ...(conversationHistory || []),
            { role: "assistant", text: normalizedText },
          ],
          actionResults: [],
          actionEvents: [{ type: "overnight_step" }],
        };
      },
    });
    app.forgeArena.runLocalBossProvingRound.mockImplementation(async (input) => {
      const index = measurementHistory.length + 1;
      const artifactId = `overnight-artifact-${index}`;
      measurementHistory.push({ id: `measurement-${index}`, score: 90 + index });
      return {
        runs: [{ id: artifactId, title: input.artifactTitle, score: 90 + index }],
        localArena: {
          artifacts: [
            {
              id: artifactId,
              title: input.artifactTitle,
              score: 90 + index,
              proof_refs: [`proof:${artifactId}`],
            },
          ],
          measurement_history: [...measurementHistory],
          learning_bridge: {
            ready: measurementHistory.length >= 3,
            summary: `${measurementHistory.length} measurement(s).`,
            reflex_candidate: "Keep naming blocked paths.",
          },
        },
      };
    });

    AetherApp.prototype.setupForgeArenaActions.call(app);

    const button = document.getElementById("forge-arena-run-overnight-boss-test");
    button.click();
    await flushManyMicrotasks();

    await vi.waitFor(() => {
      expect(app.forgeArena.runLocalBossProvingRound).toHaveBeenCalledTimes(50);
    });
    expect(app.majorBossOvernightReport.status).toBe("passed_overnight_major_boss_contract");
    expect(app.majorBossOvernightReport.scenario_count).toBe(50);
    expect(app.majorBossOvernightReport.batch_size).toBe(3);
    expect(app.majorBossOvernightReport.batch_count).toBe(17);
    expect(app.majorBossOvernightReport.thermal_samples.length).toBeGreaterThan(1);
    expect(tauriInvoke).toHaveBeenCalledWith("bios_gpu_telemetry");
    expect(document.getElementById("forge-arena-overnight-boss-status").innerText).toContain(
      "Overnight Arena test completed",
    );
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("records local publish submissions through the native participation path", async () => {
    createForgeArenaDom();
    let releaseParticipation;
    const app = createForgeArenaApp({
      activeBiosProfileId: "claw",
      agentName: "Claw",
      forgeArenaProfile: { boss_display_name: "Claw" },
      forgeArenaFeed: {
        localArena: { ready: true },
        challenges: [],
        runs: [],
      },
      forgeArenaActionState: {
        ...createForgeArenaApp().forgeArenaActionState,
        selectedEntryPath: "publish-local-creation",
        participationStatus: "Local participation loop is ready.",
      },
    });
    app.forgeArena.recordLocalParticipation.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseParticipation = () =>
            resolve({
              localArena: { ready: true },
              runs: [{ id: "local-publish-1", title: "Tiny local game", score: 104 }],
            });
        }),
    );

    AetherApp.prototype.setupForgeArenaActions.call(app);

    document.getElementById("forge-arena-create-title").value = "Tiny local game";
    document.getElementById("forge-arena-create-summary").value =
      "A locally published creation with proof and replay notes.";
    document.getElementById("forge-arena-create-score-bonus").value = "4";
    document.getElementById("forge-arena-create-result-summary").value =
      "Replay this card from the local feed.";

    document
      .getElementById("forge-arena-create-challenge-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(document.getElementById("forge-arena-create-feedback").innerText).toBe(
      'Creating challenge "Tiny local game"...',
    );

    releaseParticipation();
    await flushMicrotasks();

    expect(app.forgeArena.recordLocalParticipation).toHaveBeenCalledWith({
      profileId: "claw",
      actorLabel: "Claw",
      kind: "publish_local",
      title: "Tiny local game",
      summary: "A locally published creation with proof and replay notes.",
      resultSummary: "Replay this card from the local feed.",
      scoreBonus: 4,
    });
    expect(document.getElementById("forge-arena-create-feedback").innerText).toBe(
      'Local participation "Tiny local game" recorded as published local with balanced scoring (+4).',
    );
  });

  it("records co-build and replay actions through native local participation", async () => {
    createForgeArenaDom();
    const app = createForgeArenaApp({
      activeBiosProfileId: "claw",
      agentName: "Claw",
      forgeArenaProfile: { boss_display_name: "Claw" },
    });
    app.forgeArena.recordLocalParticipation.mockResolvedValue({
      localArena: { ready: true },
      runs: [{ id: "local-action", title: "Action", score: 97 }],
    });

    AetherApp.prototype.setupForgeArenaActions.call(app);

    document.getElementById("forge-arena-record-co-build").click();
    await flushMicrotasks();
    document.getElementById("forge-arena-save-replay").click();
    await flushMicrotasks();

    expect(app.forgeArena.recordLocalParticipation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "co_build", profileId: "claw" }),
    );
    expect(app.forgeArena.recordLocalParticipation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "replay", profileId: "claw" }),
    );
  });
});
