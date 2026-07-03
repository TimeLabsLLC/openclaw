import { describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createForgeLoopApp(overrides = {}) {
  return {
    agentName: "Claw",
    activeSessionKey: "agent:main:main",
    forgeArenaActionState: {
      createStatus: "Ready to create a new challenge.",
      featureStatus: "Ready to feature the active run.",
      judgeStatus: "Select a challenge before judging.",
      selectedEntryPath: "play-tonight",
      selectedChallengeId: "challenge-1",
      selectedRunId: "run-1",
    },
    forgeArenaFeed: {
      status: "Live arena feed ready",
      featuredRun: {
        id: "run-featured",
        title: "Midnight Circuit",
        status: "Live now",
        summary: "A featured co-op arena sprint is underway.",
        detail: "Players and agents are racing for tonight's board.",
      },
      challenges: [
        {
          id: "challenge-1",
          title: "Weekly Neon Maze",
          summary: "Build the best neon maze under pressure.",
          status: "live",
          scoringRule: "creativity",
          standingsSummary: "Two judged entries are now fighting for first place.",
        },
        {
          id: "challenge-2",
          title: "Shared Skyworld",
          summary: "Add new zones to the shared skyworld.",
          status: "open",
          scoringRule: "balanced",
          leaderSummary: "Five contributors pushed the world forward today.",
        },
      ],
      runs: [
        {
          id: "run-1",
          title: "Arena Run One",
          status: "Tracked",
          score: 44,
          resultCount: 3,
          reviewSummary: "This run just earned a promotion review.",
          comparisonSummary: "Still within striking distance of the leader.",
          lastJudgementSummary: "Promoted after a strong build round.",
        },
      ],
    },
    renderForgeArenaFeed: vi.fn(),
    buildForgeArenaEntryPaths: AetherApp.prototype.buildForgeArenaEntryPaths,
    buildForgeArenaReturnLoop: AetherApp.prototype.buildForgeArenaReturnLoop,
    handleForgeArenaEntryPath: AetherApp.prototype.handleForgeArenaEntryPath,
    ...overrides,
  };
}

describe("AetherApp Forge Arena participation loop", () => {
  it("builds the five obvious entry paths", () => {
    const app = createForgeLoopApp();

    const entries = AetherApp.prototype.buildForgeArenaEntryPaths.call(app, {
      allChallenges: app.forgeArenaFeed.challenges,
      allRuns: app.forgeArenaFeed.runs,
      currentFeaturedRun: app.forgeArenaFeed.featuredRun,
      selectedChallenge: app.forgeArenaFeed.challenges[0],
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      "play-tonight",
      "join-weekly-build",
      "start-co-build",
      "publish-local-creation",
      "forge-arcade",
      "watch-live",
    ]);
    expect(entries[1].title).toBe("Weekly Neon Maze");
    expect(entries[2].title).toBe("Shared Skyworld");
    expect(entries[3].cta).toBe("Stage Publish");
    expect(entries[4].cta).toBe("Build Game");
  });

  it("stages the publish path into the create form", () => {
    document.body.innerHTML = `
      <section id="forge-arena-create-challenge-form"></section>
      <input id="forge-arena-create-title" />
      <textarea id="forge-arena-create-summary"></textarea>
      <input id="forge-arena-create-owner-session" />
      <select id="forge-arena-create-status"><option value="open">open</option></select>
      <select id="forge-arena-create-scoring-rule"><option value="creativity">creativity</option></select>
      <textarea id="forge-arena-create-result-summary"></textarea>
    `;

    const scrollSpy = vi.fn();
    document.getElementById("forge-arena-create-challenge-form").scrollIntoView = scrollSpy;

    const app = createForgeLoopApp();

    AetherApp.prototype.handleForgeArenaEntryPath.call(app, "publish-local-creation", {
      scroll: true,
    });

    expect(document.getElementById("forge-arena-create-title").value).toBe("Claw local creation");
    expect(document.getElementById("forge-arena-create-owner-session").value).toBe(
      "agent:main:main",
    );
    expect(document.getElementById("forge-arena-create-scoring-rule").value).toBe("creativity");
    expect(app.forgeArenaActionState.selectedEntryPath).toBe("publish-local-creation");
    expect(app.forgeArenaActionState.createStatus).toContain("Publish flow staged");
    expect(app.renderForgeArenaFeed).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("routes the Forge Arcade path to the gamebuilder panel", () => {
    document.body.innerHTML = `<section id="forge-arcade-panel"></section>`;
    const scrollSpy = vi.fn();
    document.getElementById("forge-arcade-panel").scrollIntoView = scrollSpy;
    const app = createForgeLoopApp();

    AetherApp.prototype.handleForgeArenaEntryPath.call(app, "forge-arcade", { scroll: true });

    expect(app.forgeArenaActionState.selectedEntryPath).toBe("forge-arcade");
    expect(app.forgeArenaActionState.featureStatus).toContain("Forge Arcade selected");
    expect(app.renderForgeArenaFeed).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("records Forge Arcade votes and drafts remix variants", () => {
    document.body.innerHTML = `
      <textarea id="forge-arcade-prompt"></textarea>
      <select id="forge-arcade-template">
        <option value="proof-rush">Proof Rush</option>
      </select>
    `;
    const app = {
      forgeArcadeState: {
        activeBrief: "make a proof rush",
        activeTemplateId: "proof-rush",
        draftSpec: {
          id: "draft-1",
          templateId: "proof-rush",
          templateLabel: "Proof Rush",
          title: "Draft One",
          rules: { durationSeconds: 45, hazardCount: 4 },
          governance: { authoringMode: "template-data-only", allowedHostPowers: [] },
        },
        publishedCards: [
          {
            id: "card-1",
            specId: "spec-1",
            title: "Proof Rush Prime",
            templateId: "proof-rush",
            templateLabel: "Proof Rush",
            votes: { fun: 0, useful: 0, remix: 0 },
          },
        ],
        remixLineage: [],
        communityVotes: {},
      },
      persistForgeArcadeState: vi.fn(),
      renderForgeArcade: vi.fn(),
      stopForgeArcadeRuntime: vi.fn(),
    };

    AetherApp.prototype.voteForgeArcadeCard.call(app, "card-1", "fun");
    AetherApp.prototype.remixForgeArcadeCard.call(app, "card-1");

    expect(app.forgeArcadeState.publishedCards[0].votes.fun).toBe(1);
    expect(app.forgeArcadeState.communityVotes["card-1"].fun).toBe(1);
    expect(app.forgeArcadeState.draftSpec.remix.parentSpecId).toBe("spec-1");
    expect(app.forgeArcadeState.activeTemplateId).toBe("proof-rush");
    expect(app.forgeArcadeState.remixLineage[0].summary).toContain("Proof Rush Prime");
    expect(app.persistForgeArcadeState).toHaveBeenCalledTimes(2);
    expect(app.renderForgeArcade).toHaveBeenCalledTimes(2);
  });
});
