import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createForgeArenaProfileDom() {
  document.body.innerHTML = `
    <div id="forge-arena-status"></div>
    <div id="forge-arena-event-bus"></div>
    <div id="forge-arena-agent-access"></div>
    <div id="forge-arena-execution-note"></div>
    <div id="forge-arena-hero-status"></div>
    <div id="forge-arena-source-summary"></div>
    <div id="forge-arena-featured-title"></div>
    <div id="forge-arena-featured-status"></div>
    <div id="forge-arena-featured-summary"></div>
    <div id="forge-arena-featured-detail"></div>
    <div id="forge-arena-season-title"></div>
    <div id="forge-arena-season-status"></div>
    <div id="forge-arena-season-summary"></div>
    <div id="forge-arena-season-tracks"></div>
    <div id="forge-arena-leader-title"></div>
    <div id="forge-arena-standings-history-summary"></div>
    <div id="forge-arena-active-run-context"></div>
    <form id="forge-arena-profile-form">
      <input id="forge-arena-profile-public-input" />
      <input id="forge-arena-profile-boss-input" />
      <select id="forge-arena-profile-mode-select">
        <option value="duo">duo</option>
        <option value="studio">studio</option>
      </select>
      <select id="forge-arena-profile-role-select">
        <option value="">none</option>
        <option value="builder">builder</option>
      </select>
      <select id="forge-arena-profile-path-select">
        <option value="">none</option>
        <option value="watch-live">watch-live</option>
      </select>
      <textarea id="forge-arena-profile-tagline-input"></textarea>
      <button id="forge-arena-profile-save" type="submit">Save</button>
    </form>
    <div id="forge-arena-profile-shell-status"></div>
    <div id="forge-arena-profile-summary-title"></div>
    <div id="forge-arena-profile-summary-copy"></div>
    <div id="forge-arena-profile-public-name"></div>
    <div id="forge-arena-profile-boss-name"></div>
    <div id="forge-arena-profile-mode"></div>
    <div id="forge-arena-profile-rank"></div>
    <div id="forge-arena-profile-class"></div>
    <div id="forge-arena-profile-tagline"></div>
    <div id="forge-arena-profile-narrative"></div>
    <div id="forge-arena-profile-entry-role"></div>
    <div id="forge-arena-profile-first-path"></div>
    <div id="forge-arena-profile-badge-list"></div>
    <div id="forge-arena-profile-readiness"></div>
    <div id="forge-arena-profile-feature-title"></div>
    <div id="forge-arena-profile-feature-summary"></div>
    <div id="forge-arena-profile-reputation"></div>
    <div id="forge-arena-profile-capability-summary"></div>
    <div id="forge-arena-profile-history-summary"></div>
    <div id="forge-arena-connected-identity-id"></div>
    <div id="forge-arena-connected-backend-status"></div>
    <div id="forge-arena-public-visibility"></div>
    <div id="forge-arena-public-scope"></div>
    <div id="forge-arena-private-boundary"></div>
    <div id="forge-arena-profile-feedback"></div>
    <div id="forge-arena-create-feedback"></div>
    <div id="forge-arena-feature-action-status"></div>
    <div id="forge-arena-judge-feedback"></div>
    <div id="forge-arena-entry-paths"></div>
    <div id="forge-arena-live-list"></div>
    <div id="forge-arena-leaderboard"></div>
    <div id="forge-arena-standings-history"></div>
    <div id="forge-arena-hall-of-fame"></div>
    <div id="forge-arena-challenges-rail"></div>
    <div id="forge-arena-run-review-list"></div>
    <div id="forge-arena-active-zones"></div>
    <div id="forge-arena-builder-row"></div>
    <div id="forge-arena-agent-row"></div>
    <div id="forge-arena-workshop-title"></div>
    <div id="forge-arena-workshop-summary"></div>
    <div id="forge-arena-workshop-progress-label"></div>
    <div id="forge-arena-workshop-progress-bar"></div>
    <select id="forge-arena-pair-run-select"></select>
    <button id="forge-arena-scroll-challenges" type="button"></button>
    <button id="forge-arena-cancel-edit" type="button"></button>
    <form id="forge-arena-create-challenge-form"></form>
    <input id="forge-arena-create-title" />
    <textarea id="forge-arena-create-summary"></textarea>
    <select id="forge-arena-create-status"><option value="open">open</option></select>
    <input id="forge-arena-create-owner-session" />
    <select id="forge-arena-create-scoring-rule"><option value="balanced">balanced</option></select>
    <input id="forge-arena-create-score-bonus" value="0" />
    <textarea id="forge-arena-create-result-summary"></textarea>
    <button id="forge-arena-create-challenge" type="submit">Create</button>
    <button id="forge-arena-feature-active-run" type="button">Feature</button>
    <select id="forge-arena-pair-run-select"><option value="">none</option></select>
    <button id="forge-arena-pair-selected-run" type="button">Pair</button>
    <button id="forge-arena-judge-selected" type="button">Judge</button>
    <select id="forge-arena-challenge-filter"><option value="all">all</option></select>
    <select id="forge-arena-judge-verdict"><option value="promote">promote</option></select>
    <select id="forge-arena-judge-review-category"><option value="breakthrough">breakthrough</option></select>
    <input id="forge-arena-judge-score-delta" value="0" />
    <textarea id="forge-arena-judge-summary"></textarea>
  `;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AetherApp Forge Arena profile lane", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("loads a Forge Arena profile through the native command contract", async () => {
    const invoke = vi.fn().mockResolvedValue({
      bios_profile_id: "claw",
      arena_identity_id: "forge-local:claw",
      connected_identity_version: "forge-arena-connected-identity-v1",
      connected_backend_status: "local_contract_ready_backend_not_attached",
      public_visibility: "public_preview",
      public_identity_scope: [
        "public_display_name",
        "boss_display_name",
        "featured_work",
      ],
      private_truth_boundary:
        "Private BIOS memory, local files, provider keys, worker credentials, private prompts, and unsubmitted artifacts stay owned by the local BIOS profile.",
      ready: true,
      public_display_name: "Nick",
      boss_display_name: "Claw",
      presentation_mode: "duo",
      first_path_preference: "watch-live",
      entry_role_preference: "builder",
      rank_class: "Rookie",
      capability_class: "Local contender",
      capability_summary:
        "Runs from local BIOS AI runtime lanes and keeps primary work on this machine.",
      reputation_label: "Unranked founder",
      tagline: "Ready for the Arena.",
      public_narrative: "Nick and Claw now appear together in Forge Arena as a governed duo.",
      featured_work_title: "Weekly build lane chosen",
      featured_work_summary:
        "This profile wants to enter the weekly build prompt and leave behind a judged creation.",
      history_summary:
        "Arena history will start with builds, tools, and creations that can become future legends.",
      badges: ["Season Zero Founder", "Local contender", "Builder Path"],
      avatar_style: "signal",
      banner_style: "season-zero",
      created_at: 1,
      updated_at: 2,
    });
    window.__TAURI__ = { core: { invoke } };

    const app = {
      activeBiosProfileId: "claw",
      forgeArenaProfile: null,
      forgeArenaProfileFormSignature: "stale",
      renderForgeArenaFeed: vi.fn(),
    };

    const profile = await AetherApp.prototype.loadForgeArenaProfile.call(app, "claw");

    expect(invoke).toHaveBeenCalledWith("load_forge_arena_profile", { biosProfileId: "claw" });
    expect(profile.public_display_name).toBe("Nick");
    expect(profile.arena_identity_id).toBe("forge-local:claw");
    expect(profile.connected_backend_status).toBe("local_contract_ready_backend_not_attached");
    expect(app.forgeArenaProfile.public_display_name).toBe("Nick");
    expect(app.forgeArenaProfileFormSignature).toBe("");
    expect(app.renderForgeArenaFeed).toHaveBeenCalled();
  });

  it("renders the richer Arena public profile preview from stored truth", () => {
    createForgeArenaProfileDom();

    const app = {
      activeBiosProfileId: "claw",
      activeSessionKey: "agent:main:main",
      agentName: "Claw",
      forgeArenaActionState: {
        createStatus: "Ready",
        featureStatus: "Ready",
        judgeStatus: "Ready",
        profileStatus: "Ready",
        selectedEntryPath: "join-weekly-build",
        selectedRunId: null,
        selectedChallengeId: null,
        editingChallengeId: null,
        challengeFilter: "all",
      },
      forgeArenaProfileFormSignature: "",
      biosProfiles: [{ id: "claw", display_name: "Nick" }],
      forgeArenaProfile: {
        bios_profile_id: "claw",
        arena_identity_id: "forge-local:claw",
        connected_identity_version: "forge-arena-connected-identity-v1",
        connected_backend_status: "local_contract_ready_backend_not_attached",
        public_visibility: "public_preview",
        public_identity_scope: [
          "public_display_name",
          "boss_display_name",
          "presentation_mode",
          "first_use_preferences",
          "featured_work",
        ],
        private_truth_boundary:
          "Private BIOS memory, local files, provider keys, worker credentials, private prompts, and unsubmitted artifacts stay owned by the local BIOS profile.",
        ready: true,
        first_entry_completed: true,
        public_display_name: "Nick",
        boss_display_name: "Claw",
        presentation_mode: "duo",
        first_path_preference: "join-weekly-build",
        entry_role_preference: "builder",
        rank_class: "Rookie",
        capability_class: "Local contender",
        capability_summary:
          "Runs from local BIOS AI runtime lanes and keeps primary work on this machine.",
        reputation_label: "Unranked founder",
        tagline: "Ready for the Arena.",
        public_narrative: "Nick and Claw now appear together in Forge Arena as a governed duo.",
        featured_work_title: "Weekly build lane chosen",
        featured_work_summary:
          "This profile wants to enter the weekly build prompt and leave behind a judged creation.",
        history_summary:
          "Arena history will start with builds, tools, and creations that can become future legends.",
        badges: ["Season Zero Founder", "Local contender", "Builder Path"],
        updated_at: 10,
      },
      forgeArenaFeed: {
        status: "Live",
        eventBus: "bus",
        agentAccess: "access",
        currentSeason: {
          title: "Season Zero - Foundry Dawn",
          status: "active",
          summary: "Foundry Dawn is live.",
          sideTracks: [{ title: "Weekly Build" }, { title: "Play Tonight" }],
        },
        seasonHistory: [],
        hallOfFame: [
          {
            id: "champion:one",
            title: "Claw",
            kind: "champion",
            seasonLabel: "Foundry Dawn",
            honor: "Current Season Leader",
            summary: "Claw leads the season.",
          },
        ],
        executionNote: "note",
        sourceSummary: "source",
        featuredRun: {
          title: "Featured",
          status: "Running",
          summary: "Summary",
          detail: "Detail",
        },
        leaderboard: [],
        standingsHistory: [],
        runs: [],
        challenges: [],
        items: [],
      },
      escapeHtml: AetherApp.prototype.escapeHtml,
      buildForgeArenaEntryPaths: AetherApp.prototype.buildForgeArenaEntryPaths,
      buildForgeArenaReturnLoop: AetherApp.prototype.buildForgeArenaReturnLoop,
      forgeArena: { getChallengeReviewBand: () => "steady" },
    };

    AetherApp.prototype.renderForgeArenaFeed.call(app);

    expect(document.getElementById("forge-arena-profile-summary-title").innerText).toBe(
      "Nick + Claw",
    );
    expect(document.getElementById("forge-arena-profile-entry-role").innerText).toBe("Builder");
    expect(document.getElementById("forge-arena-profile-first-path").innerText).toBe(
      "Join The Weekly Build",
    );
    expect(document.getElementById("forge-arena-profile-feature-title").innerText).toBe(
      "Weekly build lane chosen",
    );
    expect(document.getElementById("forge-arena-season-title").innerText).toBe(
      "Season Zero - Foundry Dawn",
    );
    expect(document.getElementById("forge-arena-season-tracks").childElementCount).toBe(2);
    expect(document.getElementById("forge-arena-hall-of-fame").childElementCount).toBe(1);
    expect(document.getElementById("forge-arena-profile-badge-list").childElementCount).toBe(3);
    expect(document.getElementById("forge-arena-connected-identity-id").innerText).toBe(
      "forge-local:claw",
    );
    expect(document.getElementById("forge-arena-connected-backend-status").innerText).toBe(
      "Local contract ready; connected backend not attached.",
    );
    expect(document.getElementById("forge-arena-public-visibility").innerText).toBe(
      "Public preview",
    );
    expect(document.getElementById("forge-arena-public-scope").innerText).toContain(
      "public display name",
    );
    expect(document.getElementById("forge-arena-private-boundary").innerText).toContain(
      "unsubmitted artifacts stay owned by the local BIOS profile",
    );
  });

  it("saves the first Arena identity from the Forge page form", async () => {
    createForgeArenaProfileDom();

    const app = {
      activeBiosProfileId: "claw",
      forgeArenaActionState: {
        createStatus: "Ready to create a new challenge.",
        featureStatus: "Ready to feature the active run.",
        judgeStatus: "Select a challenge before judging.",
        profileStatus: "Forge Arena setup stays profile-bound and can be revised later.",
        selectedEntryPath: "play-tonight",
      },
      renderForgeArenaFeed: vi.fn(),
      handleForgeArenaEntryPath: vi.fn(),
      saveForgeArenaProfile: vi.fn().mockResolvedValue({
        public_display_name: "Nick",
        boss_display_name: "Claw",
      }),
      resetForgeArenaChallengeForm: vi.fn(),
      gateway: { isConnected: true },
      forgeArenaFeed: { challenges: [], runs: [] },
      forgeArena: {
        featureRun: vi.fn(),
        pairChallenge: vi.fn(),
        judgeChallenge: vi.fn(),
        createChallenge: vi.fn(),
        updateChallenge: vi.fn(),
        transitionChallenge: vi.fn(),
      },
      renderProfileSettings: vi.fn(),
      initSettingsProviderPanel: vi.fn(),
    };

    AetherApp.prototype.setupForgeArenaActions.call(app);

    document.getElementById("forge-arena-profile-public-input").value = "Nick";
    document.getElementById("forge-arena-profile-boss-input").value = "Claw";
    document.getElementById("forge-arena-profile-mode-select").value = "duo";
    document.getElementById("forge-arena-profile-role-select").value = "builder";
    document.getElementById("forge-arena-profile-path-select").value = "watch-live";
    document.getElementById("forge-arena-profile-tagline-input").value = "Ready for the Arena.";

    document
      .getElementById("forge-arena-profile-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await flushMicrotasks();

    expect(app.saveForgeArenaProfile).toHaveBeenCalledWith(
      {
        publicDisplayName: "Nick",
        bossDisplayName: "Claw",
        presentationMode: "duo",
        entryRolePreference: "builder",
        firstPathPreference: "watch-live",
        tagline: "Ready for the Arena.",
      },
      "claw",
    );
    expect(app.handleForgeArenaEntryPath).toHaveBeenCalledWith("watch-live", { scroll: false });
    expect(app.forgeArenaActionState.profileStatus).toBe("Arena identity saved for Nick + Claw.");
  });
});
