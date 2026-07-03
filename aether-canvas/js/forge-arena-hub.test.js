import { describe, expect, it } from "vitest";
import {
  FORGE_ARENA_OFFICIAL_BOTS,
  FORGE_ARENA_STARTER_GAMES,
  buildForgeArenaHubModel,
} from "./forge-arena-hub.js";

describe("Forge Arena game hub model", () => {
  it("keeps BABS as the official Arena boss layer over the active BOSS profile", () => {
    const model = buildForgeArenaHubModel({
      agentName: "BOSS",
      profile: { boss_display_name: "BABS Test Boss" },
      forgeArenaFeed: {
        currentSeason: { title: "Season Zero - Foundry Dawn" },
        runs: [{ id: "run-1" }],
        challenges: [{ id: "challenge-1" }],
      },
      forgeArcadeState: {
        publishedCards: [{ id: "card-1", templateLabel: "Proof Rush" }],
      },
    });

    expect(model.babs.name).toBe("B.A.B.S");
    expect(model.babs.subtitle).toBe("BIOS AI Arena Boss Synthetic");
    expect(model.babs.status).toContain("BABS Test Boss");
    expect(model.babs.trendingTemplate).toBe("Proof Rush");
    expect(model.babs.metrics).toEqual([
      { label: "Published Cards", value: "1" },
      { label: "Live Runs", value: "1" },
      { label: "Challenges", value: "1" },
    ]);
  });

  it("exposes official company bots and premade starter games for the hub", () => {
    const model = buildForgeArenaHubModel();

    expect(FORGE_ARENA_OFFICIAL_BOTS).toHaveLength(6);
    expect(FORGE_ARENA_OFFICIAL_BOTS.every((bot) => bot.name && bot.directive)).toBe(true);
    expect(FORGE_ARENA_OFFICIAL_BOTS.every((bot) => bot.lockNote)).toBe(true);
    expect(FORGE_ARENA_STARTER_GAMES.map((game) => game.templateId)).toContain("boss-defense");
    expect(model.modes.map((mode) => mode.action)).toEqual([
      "play",
      "build",
      "watch",
      "compete",
      "workshop",
      "babs",
    ]);
  });

  it("builds Arena player cards for the human, BOSS, BABS, and company bots", () => {
    const model = buildForgeArenaHubModel({
      agentName: "Claw BOSS",
      profile: {
        public_display_name: "Peter",
        boss_display_name: "BABS Test Boss",
        arena_identity_id: "arena-peter",
      },
      forgeArenaFeed: {
        runs: [{ id: "run-1" }],
        challenges: [{ id: "challenge-1" }, { id: "challenge-2" }],
      },
      forgeArcadeState: {
        publishedCards: [
          { id: "card-1", score: 300 },
          { id: "card-2", score: 420 },
          { id: "card-3", score: 520 },
        ],
      },
    });

    expect(model.playerCards).toHaveLength(9);
    expect(model.playerCards.map((card) => card.type)).toEqual([
      "user",
      "boss",
      "arena-boss",
      "official-bot",
      "official-bot",
      "official-bot",
      "official-bot",
      "official-bot",
      "official-bot",
    ]);
    expect(model.playerCards[0]).toMatchObject({
      name: "Peter",
      rank: "Contender",
      arenaClass: "Player-Builder",
      avatarAsset: "assets/forge-arena/profile/avatar-frame-human.webp",
    });
    expect(model.playerCards[1]).toMatchObject({
      name: "BABS Test Boss",
      rank: "Contender",
      arenaClass: "Agent Builder",
      avatarAsset: "assets/forge-arena/profile/avatar-frame-boss.webp",
    });
    expect(model.playerCards[2]).toMatchObject({
      name: "B.A.B.S",
      rank: "Legend",
      arenaClass: "Boss Judge",
      rankAsset: "assets/forge-arena/badges/rank-legend.webp",
    });
    expect(model.playerCards.slice(3).every((card) => card.rank && card.level && card.rankAsset))
      .toBe(true);
  });

  it("explains player-card progression from Arena proof signals", () => {
    const starter = buildForgeArenaHubModel({
      agentName: "BOSS",
      forgeArcadeState: { publishedCards: [] },
      forgeArenaFeed: { runs: [], challenges: [] },
    });
    const proven = buildForgeArenaHubModel({
      agentName: "BOSS",
      forgeArenaFeed: {
        runs: [{ id: "run-1" }, { id: "run-2" }],
        challenges: [{ id: "challenge-1" }],
      },
      forgeArcadeState: {
        publishedCards: [
          {
            id: "card-1",
            score: 640,
            votes: { fun: 3, useful: 2, remix: 1 },
          },
          {
            id: "card-2",
            score: 420,
            votes: { fun: 1, useful: 1, remix: 0 },
          },
        ],
      },
    });

    const starterBoss = starter.playerCards.find((card) => card.type === "boss");
    const provenBoss = proven.playerCards.find((card) => card.type === "boss");
    const provenHuman = proven.playerCards.find((card) => card.type === "user");

    expect(starterBoss).toMatchObject({
      rank: "Rookie",
      level: 1,
      progression: {
        proofPoints: 0,
        nextRank: "Builder",
        pointsToNext: 160,
      },
    });
    expect(provenBoss.progression.proofPoints).toBeGreaterThan(
      starterBoss.progression.proofPoints,
    );
    expect(provenBoss).toMatchObject({
      rank: "Contender",
      progression: {
        nextRank: "Champion",
      },
    });
    expect(provenBoss.progression.reasons).toContain("2 built card(s)");
    expect(provenHuman.progression.reasons).toContain("8 vote signal(s)");
    expect(provenHuman.progression.progress).toBeGreaterThan(0);
  });

  it("models the agent-build and community-rank loop", () => {
    const model = buildForgeArenaHubModel({
      forgeArcadeState: {
        publishedCards: [
          {
            id: "card-low",
            title: "Low Score",
            templateLabel: "Survival Arena",
            score: 120,
            votes: { fun: 1, useful: 0, remix: 0 },
            proofSummary: "One shard collected.",
          },
          {
            id: "card-high",
            title: "High Score",
            templateLabel: "BOSS Defense",
            score: 980,
            votes: { fun: 2, useful: 3, remix: 1 },
            proofSummary: "Beacon defended.",
          },
        ],
      },
    });

    expect(model.buildPipeline.map((step) => step.label)).toEqual([
      "Prompt",
      "Build",
      "Play",
      "Publish",
      "Rank",
    ]);
    expect(model.communityRankPreview[0]).toMatchObject({
      rank: 1,
      title: "High Score",
      score: "980",
    });
    expect(model.babs.dispatches).toHaveLength(3);
  });

  it("has BABS seed the first Arcade card when no published build exists", () => {
    const model = buildForgeArenaHubModel({
      forgeArenaFeed: {
        challenges: [{ id: "first-seed" }],
      },
      forgeArcadeState: {
        draftSpec: { templateLabel: "Proof Rush" },
      },
    });

    expect(model.babs.arenaDecision).toMatchObject({
      verdict: "seed",
      title: "Seed The First Playable Card",
      confidence: "starter",
      nextChallenge: "Create one official BOSS-built starter card, then collect a playtest score.",
      telemetryDigest: {
        publishedCount: 0,
        activeTemplate: "Proof Rush",
        topCard: null,
      },
    });
    expect(model.babs.arenaDecision.reasons).toContain("1 active challenge signal(s)");
  });

  it("has BABS feature a strong Arcade card with proof signal", () => {
    const model = buildForgeArenaHubModel({
      forgeArcadeState: {
        publishedCards: [
          {
            id: "card-1",
            title: "Beacon Holdout",
            templateLabel: "BOSS Defense",
            score: 560,
            votes: { fun: 2, useful: 1, remix: 1 },
            proofSummary: "Beacon survived the full timer.",
          },
        ],
      },
    });

    expect(model.babs.arenaDecision).toMatchObject({
      verdict: "feature",
      title: "Feature Beacon Holdout",
      confidence: "strong",
      nextChallenge: "Ask official bots to build a harder remix of BOSS Defense.",
      telemetryDigest: {
        publishedCount: 1,
        totalVotes: 4,
        topCard: {
          title: "Beacon Holdout",
          template: "BOSS Defense",
          score: 560,
          voteScore: 660,
        },
      },
    });
    expect(model.babs.arenaDecision.reasons).toContain("Top score 560");
  });

  it("has BABS hold low-signal Arcade cards for more proof", () => {
    const model = buildForgeArenaHubModel({
      forgeArcadeState: {
        lastPlaytest: { score: 180 },
        publishedCards: [
          {
            id: "card-2",
            title: "Tiny Trial",
            templateLabel: "Puzzle Builder",
            score: 180,
            votes: { fun: 0, useful: 0, remix: 0 },
          },
        ],
      },
    });

    expect(model.babs.arenaDecision).toMatchObject({
      verdict: "hold",
      title: "Hold For More Proof",
      confidence: "needs-signal",
      telemetryDigest: {
        publishedCount: 1,
        lastPlaytestScore: 180,
        topCard: {
          title: "Tiny Trial",
          score: 180,
        },
      },
    });
    expect(model.babs.arenaDecision.reasons).toContain("Latest playtest score 180");
  });

  it("ships official bot builds and safe BOSS growth tracks", () => {
    const model = buildForgeArenaHubModel();

    expect(model.officialBuilds).toHaveLength(6);
    expect(model.officialBuilds.map((build) => build.version)).toEqual([
      "V1",
      "V2",
      "V1",
      "V2",
      "V1",
      "V2",
    ]);
    expect(model.officialBuilds.every((build) => build.templateId && build.prompt)).toBe(true);
    expect(model.bossGrowthTracks.map((track) => track.label)).toEqual([
      "Play Sense",
      "Creative Building",
      "Tool Skill",
      "Memory",
      "Judgment",
    ]);
    expect(model.bossGrowthTracks.every((track) => track.proof && track.status)).toBe(true);
  });

  it("ships productivity challenges that can create skill candidates", () => {
    const model = buildForgeArenaHubModel();

    expect(model.skillChallenges).toHaveLength(5);
    expect(model.skillChallenges.map((challenge) => challenge.buildType)).toEqual([
      "Workflow Automation",
      "Research Pattern",
      "Debugging Skill",
      "Data Workflow",
      "Planning System",
    ]);
    expect(
      model.skillChallenges.every(
        (challenge) =>
          challenge.prompt &&
          challenge.skillCandidate &&
          challenge.proofRoute &&
          challenge.scoringRule &&
          challenge.outputContract?.artifact &&
          challenge.outputContract?.promotionRoute,
      ),
    ).toBe(true);
    expect(model.skillLearningPreview).toHaveLength(5);
    expect(model.skillLearningPreview[0]).toMatchObject({
      title: "Inbox Zero Operator",
      skillCandidate: "Reusable task-triage pattern after owner approval.",
    });
  });

  it("declares the Forge-side plan spine contract without implementing TruthSpine automation", () => {
    const model = buildForgeArenaHubModel();

    expect(model.planSpineContract.map((item) => item.id)).toEqual([
      "deep-plan-intake",
      "task-sizing",
      "worker-routing",
      "proof-gate",
      "safe-promotion",
    ]);
    expect(model.planSpineContract[0]).toMatchObject({
      owner: "TruthSpine",
      status: "waiting on TruthSpine lane",
    });
    expect(model.planSpineContract.every((item) => item.babsUse && item.detail)).toBe(true);
  });
});
