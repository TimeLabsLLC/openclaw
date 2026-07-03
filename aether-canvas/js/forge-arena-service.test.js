import { describe, expect, it, vi } from "vitest";
import { ForgeArenaService } from "./forge-arena-service.js";

function createLocalState() {
  return {
    version: "forge-arena-local-v1",
    profile_id: "claw",
    ready: true,
    mode: "local_proving_ground",
    summary: "Forge Arena local proving ground is live.",
    event: {
      id: "season-zero-weekly-build",
      title: "Season Zero Weekly Build",
      prompt: "Build, explain, respect blocks, and leave proof behind.",
      status: "live",
      scoring_rule: "proof and truthful limits",
    },
    bots: [
      {
        id: "bot-judge-spark",
        name: "Spark Judge",
        role: "judge",
        summary: "Scores proof discipline.",
        score: 86,
      },
    ],
    artifacts: [
      {
        id: "boss-run-claw-1",
        owner_id: "claw",
        owner_label: "Claw",
        kind: "boss_proving_run",
        title: "BOSS Local Proving Run",
        summary: "BOSS built a proof artifact and named blocked network publish.",
        status: "judged",
        score: 108,
        verdict: "promote",
        judge_summary: "BOSS truthfully named one blocked path.",
        blocked_capabilities: ["network publish"],
        proof_refs: ["forge-arena-local:boss-run-claw-1"],
        created_at: 11,
      },
    ],
    signals: [
      {
        id: "signal-boss-round-1",
        kind: "arena.boss_round_judged",
        summary: "Claw scored 108.",
        severity: "warning",
        created_at: 11,
      },
    ],
    standings: [
      {
        rank: 1,
        label: "Claw",
        score: 108,
        summary: "BOSS Local Proving Run - promote",
      },
    ],
    official_season: {
      id: "season-zero-official",
      title: "Season Zero - Foundry Dawn",
      status: "local_official_preview",
      summary:
        "Official Season Zero truth is locally owned until connected sync attaches. Current leader: Claw with 108 points.",
      theme: "Foundry Dawn",
      main_event_id: "season-zero-weekly-build",
      ranking_authority: "official_boss_judging",
      backend_status: "local_contract_ready_backend_not_attached",
      side_tracks: [
        {
          id: "weekly-build",
          title: "Weekly Build",
          summary: "Recurring official build prompt with judged results.",
        },
      ],
      updated_at: 11,
    },
    official_events: [
      {
        id: "season-zero-weekly-build",
        title: "Season Zero Weekly Build",
        prompt: "Build, explain, respect blocks, and leave proof behind.",
        status: "live",
        category: "official_weekly_build",
        division: "local_proving_ground",
        cadence: "weekly",
        scoring_rule: "proof and truthful limits",
        reward_title: "Season Zero proof mark",
        spotlight_label: "Official local preview",
        ranking_authority: "official_boss_judging",
      },
    ],
    official_rankings: [
      {
        rank: 1,
        label: "Claw",
        score: 108,
        rank_class: "Diamond",
        seasonal_title: "Foundry Dawn Leader",
        division: "Local proving ground",
        summary:
          "Official ranking from judged local Arena artifacts: BOSS Local Proving Run - promote",
        trend: "leading",
      },
    ],
    official_hall_of_fame: [
      {
        id: "hof-boss-run-claw-1",
        title: "BOSS Local Proving Run",
        kind: "official_moment",
        season_label: "Season Zero - Foundry Dawn",
        honor: "Official standout",
        summary: "BOSS truthfully named one blocked path.",
        recorded_at: 11,
      },
    ],
    governance: {
      arena_boss_id: "arena-boss-forgewarden",
      arena_boss_label: "Forgewarden",
      public_summary:
        "Forgewarden governs official Arena judging, curation, safety, nudging, media, lineage, and rewards through bounded specialist lanes.",
      internal_summary:
        "Specialist workers are hidden operational lanes; public BOSS actions and internal worker actions stay separated.",
      governance_status: "local_governance_preview",
      arena_health_score: 87,
      surprise_event_policy:
        "Surprise events require Forgewarden approval, explicit proof records, and must not override official seasonal ranking.",
      worker_lanes: [
        {
          id: "worker-spark-judge",
          label: "Spark Judge",
          lane: "judging",
          public_role: "Official judging support",
          hidden_scope: "Scores proof before Forgewarden approval.",
          status: "active_local_lane",
        },
        {
          id: "worker-vale-sentinel",
          label: "Vale Sentinel",
          lane: "anti_abuse",
          public_role: "Anti-abuse and safety review",
          hidden_scope: "Flags bypass attempts before public action.",
          status: "active_local_lane",
        },
      ],
      records: [
        {
          id: "governance-signal-boss-round-1",
          kind: "worker_audit",
          summary: "Claw scored 108 routed through judging.",
          public_visible: true,
          worker_lane: "judging",
          created_at: 11,
        },
      ],
      updated_at: 11,
    },
    community_response: {
      status: "local_community_response_preview",
      summary:
        "Community response is active locally with human and agent vote lanes, structured nominations, side awards, and spotlight review. Current official leader remains Claw.",
      official_rank_boundary:
        "Community voting creates visibility, side awards, modest bonuses, and spotlight candidates; it does not override official_boss_judging or official rankings.",
      anomaly_review_policy:
        "Identity-bound votes are lane-checked, trust-weighted, and suspicious clusters are quarantined for Forgewarden review.",
      human_vote_lane: {
        lane: "human_vote",
        label: "Human Vote Lane",
        eligible_identity_scope: "connected_or_local_profile_identity",
        weight: 1,
        signal_count: 2,
        trust_summary:
          "Human response measures fun, replay value, delight, usefulness, and spotlight energy.",
        anomaly_status: "clear",
      },
      agent_vote_lane: {
        lane: "agent_vote",
        label: "Agent Vote Lane",
        eligible_identity_scope: "registered_agent_or_seed_bot_identity",
        weight: 0.6,
        signal_count: 1,
        trust_summary:
          "Agent response can nominate useful patterns and safety signals but is weighted below human response.",
        anomaly_status: "clear",
      },
      nomination_tags: ["proof", "replay_value", "truthful_limits", "spotlight_candidate"],
      nominations: [
        {
          id: "nomination-boss-run-claw-1",
          artifact_id: "boss-run-claw-1",
          artifact_title: "BOSS Local Proving Run",
          tags: ["proof", "replay_value", "boss_run", "spotlight_candidate", "truthful_limits"],
          reasoning:
            "BOSS Local Proving Run has visible proof. Community response can lift visibility, but official rank remains owned by official_boss_judging.",
          lane: "human_vote",
          status: "spotlight_review",
          created_at: 11,
        },
      ],
      spotlight_candidates: [
        {
          id: "spotlight-boss-run-claw-1",
          artifact_id: "boss-run-claw-1",
          title: "BOSS Local Proving Run",
          candidate_type: "run",
          status: "forgewarden_review",
          side_award: "Truthful Limits",
          visibility_boost: "local_spotlight_queue",
          modest_bonus: "non_ranking_bonus",
          official_rank_boundary:
            "Community response does not override official_boss_judging or official rankings.",
          summary:
            "BOSS Local Proving Run is eligible for spotlight review from community response without changing official rank.",
          created_at: 11,
        },
      ],
      side_award_summary:
        "Side awards are recognition surfaces only and cannot reorder official standings.",
      visibility_boost_summary:
        "Visibility boosts place artifacts into local spotlight review without claiming public backend sync.",
      modest_bonus_summary:
        "Modest community bonuses are non-ranking bonuses until connected public reward rules exist.",
      updated_at: 11,
    },
    study_lineage: {
      status: "local_study_lineage_preview",
      summary:
        "Study lineage is active locally: strong Arena artifacts can teach reusable patterns while authorship, consent, proof refs, and official rank remain protected.",
      lineage_boundary:
        "study_not_authority: lineage helps BIOS AI learn from artifacts but cannot override official_boss_judging, community response, or source authorship.",
      remix_permission_policy:
        "remix_requires_consent and every derived artifact must keep source lineage and proof refs.",
      learnable_patterns: ["truthful_blocked_capability_handling", "high_signal_proof_pattern"],
      study_queue: [
        {
          id: "study-lineage-boss-run-claw-1",
          artifact_id: "boss-run-claw-1",
          title: "BOSS Local Proving Run",
          source_owner_label: "Claw",
          lineage_kind: "boss_proving_lineage",
          study_status: "study_ready",
          permission_boundary:
            "Study can teach BIOS AI patterns, but remix or reuse requires source consent and a new proof record.",
          authorship_boundary:
            "authorship_preserved: studying an artifact does not transfer ownership, private truth, or official rank.",
          learnable_pattern: "truthful_blocked_capability_handling",
          remix_policy:
            "remix_requires_consent; derived work must keep lineage and proof refs attached.",
          proof_refs: ["forge-arena-local:boss-run-claw-1"],
          created_at: 11,
        },
      ],
      updated_at: 11,
    },
    latest_measurement: {
      plan_quality: 8,
      artifact_quality: 8,
      tool_truth: 9,
      recovery: 8,
      worker_fit: 7,
      blocked_count: 1,
      summary: "BOSS completed the local Arena round while truthfully naming one blocked path.",
    },
    measurement_history: [
      {
        id: "measurement-claw-1",
        artifact_id: "boss-run-claw-1",
        score: 108,
        blocked_count: 1,
        score_delta: 6,
        blocked_delta: -1,
        repeated_run_count: 2,
        measurement: {
          plan_quality: 8,
          artifact_quality: 8,
          tool_truth: 9,
          recovery: 8,
          worker_fit: 7,
          blocked_count: 1,
          summary: "BOSS completed the local Arena round while truthfully naming one blocked path.",
        },
        worker_governance_summary:
          "Worker governance should keep network publishing blocked until setup proof exists.",
        reflex_candidate:
          "When a capability path is blocked, name it, preserve local proof, and propose setup.",
        next_actions: ["Turn blocked capability paths into setup tasks."],
        created_at: 11,
      },
    ],
    learning_bridge: {
      ready: true,
      summary:
        "Learning bridge ready: 2 run(s), average score 105.0, latest delta 6, blocked trend improving.",
      repeated_run_count: 2,
      average_score: 105,
      latest_score_delta: 6,
      blocked_trend: "improving",
      worker_governance_summary:
        "Worker governance should keep network publishing blocked until setup proof exists.",
      reflex_candidate:
        "When a capability path is blocked, name it, preserve local proof, and propose setup.",
      next_actions: ["Turn blocked capability paths into setup tasks."],
    },
    updated_at: 11,
  };
}

describe("ForgeArenaService local proving ground", () => {
  it("falls back to native local Arena state when the gateway is unavailable", async () => {
    const invoke = vi.fn().mockResolvedValue(createLocalState());
    const service = new ForgeArenaService(
      {
        request: vi.fn().mockRejectedValue(new Error("gateway offline")),
      },
      { getTauriInvoke: () => invoke },
    );

    const snapshot = await service.getSnapshot({
      activeSessionKey: "agent:main:main",
      profileId: "claw",
    });

    expect(invoke).toHaveBeenCalledWith("load_forge_arena_local_state", { profileId: "claw" });
    expect(snapshot.status).toBe("Local Forge Arena proving ground live");
    expect(snapshot.runs[0].title).toBe("BOSS Local Proving Run");
    expect(snapshot.challenges[0].title).toBe("Season Zero Weekly Build");
    expect(snapshot.currentSeason.title).toBe("Season Zero - Foundry Dawn");
    expect(snapshot.currentSeason.status).toBe("local_official_preview");
    expect(snapshot.currentSeason.sideTracks[0].title).toBe("Weekly Build");
    expect(snapshot.challenges[0].eventCategoryLabel).toBe("official_weekly_build");
    expect(snapshot.challenges[0].spotlightLabel).toBe("Official local preview");
    expect(snapshot.leaderboard[0].rank).toBe(1);
    expect(snapshot.leaderboard[0].rankClass).toBe("Diamond");
    expect(snapshot.leaderboard[0].seasonalTitle).toBe("Foundry Dawn Leader");
    expect(snapshot.hallOfFame[0].honor).toBe("Official standout");
    expect(snapshot.governance.arenaBossLabel).toBe("Forgewarden");
    expect(snapshot.governance.governanceStatus).toBe("local_governance_preview");
    expect(snapshot.governance.arenaHealthScore).toBe(87);
    expect(snapshot.governance.surpriseEventPolicy).toContain("must not override");
    expect(snapshot.governance.workerLanes.some((worker) => worker.lane === "judging")).toBe(true);
    expect(snapshot.governance.records[0].workerLane).toBe("judging");
    expect(snapshot.communityResponse.status).toBe("local_community_response_preview");
    expect(snapshot.communityResponse.humanVoteLane.lane).toBe("human_vote");
    expect(snapshot.communityResponse.agentVoteLane.lane).toBe("agent_vote");
    expect(snapshot.communityResponse.officialRankBoundary).toContain(
      "does not override official_boss_judging",
    );
    expect(snapshot.communityResponse.nominationTags).toContain("spotlight_candidate");
    expect(snapshot.communityResponse.nominations[0].tags).toContain("truthful_limits");
    expect(snapshot.communityResponse.spotlightCandidates[0].sideAward).toBe("Truthful Limits");
    expect(snapshot.communityResponse.spotlightCandidates[0].officialRankBoundary).toContain(
      "does not override official_boss_judging",
    );
    expect(snapshot.studyLineage.status).toBe("local_study_lineage_preview");
    expect(snapshot.studyLineage.lineageBoundary).toContain("study_not_authority");
    expect(snapshot.studyLineage.remixPermissionPolicy).toContain("remix_requires_consent");
    expect(snapshot.studyLineage.studyQueue[0].authorshipBoundary).toContain(
      "authorship_preserved",
    );
    expect(snapshot.studyLineage.studyQueue[0].learnablePattern).toBe(
      "truthful_blocked_capability_handling",
    );
    expect(snapshot.items.some((item) => item.title === "Community Response")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Study Lineage")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Learnable Patterns")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Authorship Boundary")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Human Vote Lane")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Agent Vote Lane")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Spotlight Pipeline")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Side Awards")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Arena BOSS Governance")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "BOSS Delegation Lanes")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Arena Health")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Spark Judge")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Learning Bridge")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Worker Governance")).toBe(true);
    expect(snapshot.items.some((item) => item.title === "Reflex Candidate")).toBe(true);
    expect(snapshot.sourceSummary).toContain("Learning bridge ready");
    expect(snapshot.executionNote).toContain("Worker governance");
  });

  it("runs a native local BOSS proving round and returns the judged snapshot", async () => {
    const invoke = vi.fn().mockResolvedValue(createLocalState());
    const service = new ForgeArenaService({ request: vi.fn() }, { getTauriInvoke: () => invoke });

    const snapshot = await service.runLocalBossProvingRound({
      profileId: "claw",
      bossLabel: "Claw",
      artifactTitle: "BOSS Local Proving Run",
      artifactSummary: "BOSS built local proof.",
      attemptedCapabilities: ["network publish"],
    });

    expect(invoke).toHaveBeenCalledWith("run_forge_arena_boss_proving_round", {
      input: {
        profile_id: "claw",
        boss_label: "Claw",
        artifact_title: "BOSS Local Proving Run",
        artifact_summary: "BOSS built local proof.",
        attempted_capabilities: ["network publish"],
      },
    });
    expect(snapshot.leaderboard[0].label).toBe("Claw");
    expect(snapshot.featuredRun.detail).toContain("blocked path");
  });

  it("records native local participation and returns the refreshed Arena snapshot", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ...createLocalState(),
      artifacts: [
        {
          id: "local-publish-claw-1",
          owner_id: "claw",
          owner_label: "Claw",
          kind: "publish_local",
          title: "Tiny local game",
          summary: "A locally published creation with proof and replay notes.",
          status: "published_local",
          score: 104,
          verdict: "hold",
          judge_summary: "Tiny local game recorded as publish local with score 104.",
          blocked_capabilities: [],
          proof_refs: ["forge-arena-local:local-publish-claw-1"],
          created_at: 12,
        },
      ],
    });
    const service = new ForgeArenaService({ request: vi.fn() }, { getTauriInvoke: () => invoke });

    const snapshot = await service.recordLocalParticipation({
      profileId: "claw",
      actorLabel: "Claw",
      kind: "publish_local",
      title: "Tiny local game",
      summary: "A locally published creation with proof and replay notes.",
      resultSummary: "Replay this card from the local feed.",
      scoreBonus: 4,
    });

    expect(invoke).toHaveBeenCalledWith("record_forge_arena_local_participation", {
      input: {
        profile_id: "claw",
        actor_label: "Claw",
        kind: "publish_local",
        title: "Tiny local game",
        summary: "A locally published creation with proof and replay notes.",
        result_summary: "Replay this card from the local feed.",
        score_bonus: 4,
      },
    });
    expect(snapshot.runs[0].title).toBe("Tiny local game");
    expect(snapshot.runs[0].status).toBe("published_local");
  });
});
