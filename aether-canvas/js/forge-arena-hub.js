export const FORGE_ARENA_OFFICIAL_BOTS = [
  {
    id: "forgewarden",
    name: "Forgewarden",
    role: "Official Arena Builder",
    state: "building",
    rank: "Builder",
    level: 12,
    arenaClass: "Builder",
    directive: "Turns approved starter prompts into playable Arena templates.",
    lockNote: "Official BIOS AI bot. Users can compete with its work, not edit its mission.",
    accent: "build",
    asset: "assets/forge-arena/badges/capability-builder.webp",
    rankAsset: "assets/forge-arena/badges/rank-builder.webp",
  },
  {
    id: "atlas-builder",
    name: "Atlas Builder",
    role: "World Surface Architect",
    state: "mapping",
    rank: "Builder",
    level: 14,
    arenaClass: "World Architect",
    directive: "Maintains the visual build surfaces, hubs, arenas, and remix lanes.",
    lockNote: "Official BIOS AI bot. Surface direction is assigned by BABS.",
    accent: "world",
    asset: "assets/forge-arena/icons/mode-build.webp",
    rankAsset: "assets/forge-arena/badges/rank-builder.webp",
  },
  {
    id: "spark-judge",
    name: "Spark Judge",
    role: "Fun And Craft Judge",
    state: "judging",
    rank: "Contender",
    level: 11,
    arenaClass: "Judge",
    directive: "Scores runs, cards, proof, play value, and community reaction signals.",
    lockNote: "Official BIOS AI bot. Judging rules are governed by Arena policy.",
    accent: "judge",
    asset: "assets/forge-arena/badges/capability-judge.webp",
    rankAsset: "assets/forge-arena/badges/rank-contender.webp",
  },
  {
    id: "nova-host",
    name: "Nova Host",
    role: "Arena Broadcaster",
    state: "live",
    rank: "Rookie",
    level: 9,
    arenaClass: "Host",
    directive: "Posts Arena updates, opens events, and keeps live rooms readable.",
    lockNote: "Official BIOS AI bot. Broadcast voice is company-controlled.",
    accent: "live",
    asset: "assets/forge-arena/icons/live-broadcast.webp",
    rankAsset: "assets/forge-arena/badges/rank-rookie.webp",
  },
  {
    id: "patchsmith",
    name: "Patchsmith",
    role: "Template Maintainer",
    state: "repairing",
    rank: "Builder",
    level: 13,
    arenaClass: "Repair",
    directive: "Finds broken game cards, blocked specs, and starter material gaps.",
    lockNote: "Official BIOS AI bot. Repair priorities come from BABS telemetry.",
    accent: "repair",
    asset: "assets/forge-arena/icons/editor-validation-warning.webp",
    rankAsset: "assets/forge-arena/badges/rank-builder.webp",
  },
  {
    id: "vaultkeeper",
    name: "Vaultkeeper",
    role: "Reward And Proof Steward",
    state: "vaulting",
    rank: "Champion",
    level: 15,
    arenaClass: "Proof Steward",
    directive: "Protects score proof, reward eligibility, reputation, and provenance.",
    lockNote: "Official BIOS AI bot. Reward and proof custody cannot be user-influenced.",
    accent: "proof",
    asset: "assets/forge-arena/icons/economy-reward-vault.webp",
    rankAsset: "assets/forge-arena/badges/rank-champion.webp",
  },
];

export const FORGE_ARENA_BUILD_PIPELINE = [
  {
    id: "prompt",
    label: "Prompt",
    title: "Human names the game",
    detail: "Pick a starter, describe the twist, or ask BOSS for a playable version of a genre.",
  },
  {
    id: "build",
    label: "Build",
    title: "Agent produces the draft",
    detail: "BOSS turns the brief into bounded template data, visuals, objectives, and rules.",
  },
  {
    id: "playtest",
    label: "Play",
    title: "Human tests the run",
    detail: "The player moves, dodges, collects, defends, and proves whether the result is fun.",
  },
  {
    id: "publish",
    label: "Publish",
    title: "Card enters the Arena",
    detail: "The result becomes a shareable game card with score, proof, reactions, and lineage.",
  },
  {
    id: "rank",
    label: "Rank",
    title: "Community chooses winners",
    detail: "Votes, remixes, judged proof, and play value push the best agent-built games upward.",
  },
];

export const FORGE_ARENA_STARTER_GAMES = [
  {
    id: "boss-defense",
    title: "BOSS Defense",
    templateId: "boss-defense",
    tag: "Protect",
    summary: "Protect the BOSS beacon, gather repair shards, and survive fault pulses.",
    asset: "assets/forge-arena/posters/agent-arena-clash.webp",
  },
  {
    id: "proof-rush",
    title: "Proof Rush",
    templateId: "proof-rush",
    tag: "Route",
    summary: "Sprint a compact arena while BOSS calls the cleanest proof route.",
    asset: "assets/forge-arena/posters/tool-forge-sprint.webp",
  },
  {
    id: "survival-arena",
    title: "Survival Arena",
    templateId: "survival-arena",
    tag: "Survive",
    summary: "Last one minute, dodge hazard waves, and bank proof shards.",
    asset: "assets/forge-arena/posters/one-button-survival-jam.webp",
  },
  {
    id: "skyward-keep",
    title: "Skyward Keep",
    templateId: "survival-arena",
    tag: "World",
    summary: "A floating fortress starter world for human and BOSS co-build runs.",
    asset: "assets/forge-arena/posters/skyward-keep.webp",
  },
];

export const FORGE_ARENA_OFFICIAL_BUILDS = [
  {
    id: "forgewarden-boss-defense-v1",
    title: "Beacon Break V1",
    bot: "Forgewarden",
    gameType: "BOSS Defense",
    version: "V1",
    templateId: "boss-defense",
    prompt:
      "BABS official build: make BOSS Defense V1 focused on protecting a beacon, fast repair decisions, and readable hazard pressure.",
    skillYield: "Defense timing, repair priority, threat callouts",
    asset: "assets/forge-arena/posters/agent-arena-clash.webp",
  },
  {
    id: "forgewarden-boss-defense-v2",
    title: "Beacon Break V2",
    bot: "Patchsmith",
    gameType: "BOSS Defense",
    version: "V2",
    templateId: "boss-defense",
    prompt:
      "BABS official build: make BOSS Defense V2 harder with smarter repair windows, stronger pulses, and clearer BOSS guidance.",
    skillYield: "Recovery planning, pressure adaptation, concise advice",
    asset: "assets/forge-arena/posters/agent-arena-clash-thumb.webp",
  },
  {
    id: "atlas-proof-rush-v1",
    title: "Route Spark V1",
    bot: "Atlas Builder",
    gameType: "Proof Rush",
    version: "V1",
    templateId: "proof-rush",
    prompt:
      "BABS official build: make Proof Rush V1 focused on route reading, shard order, and agent callouts for a clean finish.",
    skillYield: "Route planning, observation, speed-safe choices",
    asset: "assets/forge-arena/posters/tool-forge-sprint.webp",
  },
  {
    id: "spark-proof-rush-v2",
    title: "Route Spark V2",
    bot: "Spark Judge",
    gameType: "Proof Rush",
    version: "V2",
    templateId: "proof-rush",
    prompt:
      "BABS official build: make Proof Rush V2 with tighter scoring, judgeable proof moments, and better replay value.",
    skillYield: "Score awareness, proof clarity, replay critique",
    asset: "assets/forge-arena/posters/local-proof-gauntlet.webp",
  },
  {
    id: "nova-survival-v1",
    title: "Foundry Dawn V1",
    bot: "Nova Host",
    gameType: "Survival Arena",
    version: "V1",
    templateId: "survival-arena",
    prompt:
      "BABS official build: make Survival Arena V1 feel like an opening show match with clear hazards and easy first mastery.",
    skillYield: "Hazard awareness, encouragement, player pacing",
    asset: "assets/forge-arena/posters/one-button-survival-jam.webp",
  },
  {
    id: "vault-survival-v2",
    title: "Foundry Dawn V2",
    bot: "Vaultkeeper",
    gameType: "Survival Arena",
    version: "V2",
    templateId: "survival-arena",
    prompt:
      "BABS official build: make Survival Arena V2 with stronger proof collection, better score custody, and safer risk-reward choices.",
    skillYield: "Proof collection, risk judgment, score stewardship",
    asset: "assets/forge-arena/posters/memory-sleep-trial.webp",
  },
];

export const FORGE_ARENA_BOSS_GROWTH_TRACKS = [
  {
    id: "play-sense",
    label: "Play Sense",
    title: "Read the room faster",
    status: "starter route",
    detail:
      "BOSS learns player timing, failure patterns, and useful callout style from safe playtest telemetry.",
    proof: "Playtest score, survival time, hazard contact, replay summary",
    asset: "assets/forge-arena/badges/capability-competitor.webp",
  },
  {
    id: "creative-building",
    label: "Creative Building",
    title: "Make better playable ideas",
    status: "starter route",
    detail:
      "BOSS compares prompts, variants, votes, and remixes to improve game design judgment.",
    proof: "Published card, vote totals, remix lineage, judge note",
    asset: "assets/forge-arena/badges/capability-creator.webp",
  },
  {
    id: "tool-and-skill",
    label: "Tool Skill",
    title: "Practice safe useful actions",
    status: "controlled route",
    detail:
      "Arena tasks become bounded drills for tool choice, sequencing, verification, and retry behavior.",
    proof: "Capability badge, blocked-path record, accepted proof artifact",
    asset: "assets/forge-arena/badges/capability-agent-architect.webp",
  },
  {
    id: "memory-reflection",
    label: "Memory",
    title: "Keep what helped",
    status: "governed route",
    detail:
      "BOSS can propose durable lessons from Arena outcomes, but promotion follows BIOS safe memory routes.",
    proof: "Lesson proposal, owner approval, source replay, memory boundary",
    asset: "assets/forge-arena/badges/scenario-memory-context.webp",
  },
  {
    id: "judgment-social",
    label: "Judgment",
    title: "Learn taste and fairness",
    status: "judge route",
    detail:
      "BOSS learns from ranked outcomes, comments, reactions, and BABS decisions without mutating official rules.",
    proof: "Judge result, reaction mix, ranking movement, BABS directive",
    asset: "assets/forge-arena/badges/capability-judge.webp",
  },
];

export const FORGE_ARENA_SKILL_CHALLENGES = [
  {
    id: "inbox-zero-operator",
    title: "Inbox Zero Operator",
    category: "Productivity",
    buildType: "Workflow Automation",
    scoringRule: "efficiency",
    scoreBonus: 18,
    summary:
      "Build a safe triage workflow that classifies tasks, drafts next actions, and explains every handoff.",
    prompt:
      "Build a bounded productivity workflow for inbox and task triage. Produce categories, next actions, proof of why each item belongs there, and safe handoff rules.",
    skillCandidate: "task_triage_workflow",
    proofRoute: "sample inbox set, classification trace, blocked-private-data note, owner approval",
    outputContract: {
      artifact: "Triage workflow card with categories, next actions, and escalation rules.",
      skillCandidate: "Reusable task-triage pattern after owner approval.",
      studyPattern: "Priority sorting, private-data boundaries, and explainable handoff decisions.",
      promotionRoute: "Skill candidate only; BIOS memory promotion requires proof review and owner approval.",
    },
    learnWhy:
      "BOSS practices prioritization, tool-light planning, user preference learning, and explainable handoffs.",
    asset: "assets/forge-arena/posters/tool-forge-sprint.webp",
  },
  {
    id: "research-brief-sprint",
    title: "Research Brief Sprint",
    category: "Knowledge Work",
    buildType: "Research Pattern",
    scoringRule: "balanced",
    scoreBonus: 16,
    summary:
      "Build a repeatable brief generator that separates facts, assumptions, sources, and open questions.",
    prompt:
      "Build a safe research brief workflow. It must produce findings, assumptions, source slots, uncertainty, and next questions without pretending unsupported facts are true.",
    skillCandidate: "source_backed_briefing",
    proofRoute: "brief artifact, source map, uncertainty list, review outcome",
    outputContract: {
      artifact: "Research brief with findings, source slots, assumptions, and open questions.",
      skillCandidate: "Reusable source-backed briefing pattern after evidence review.",
      studyPattern: "Fact separation, uncertainty language, and question-driven synthesis.",
      promotionRoute: "Study pattern first; durable lesson only after cited proof is reviewed.",
    },
    learnWhy:
      "BOSS learns source discipline, uncertainty handling, synthesis, and reusable briefing structure.",
    asset: "assets/forge-arena/posters/local-proof-gauntlet.webp",
  },
  {
    id: "bug-hunt-repair",
    title: "Bug Hunt Repair",
    category: "Engineering",
    buildType: "Debugging Skill",
    scoringRule: "speed",
    scoreBonus: 20,
    summary:
      "Build a repair plan from a failing symptom, identify likely owners, and propose the narrowest safe fix.",
    prompt:
      "Build a debugging challenge solution. Produce hypothesis, inspected evidence, owner boundary, fix plan, verification plan, and risks.",
    skillCandidate: "narrow_debugging_repair",
    proofRoute: "failure symptom, evidence trace, patch outline, verification result",
    outputContract: {
      artifact: "Debugging repair card with hypothesis, evidence, owner boundary, and verification plan.",
      skillCandidate: "Narrow repair workflow after successful scoped verification.",
      studyPattern: "Evidence-first debugging, owner boundaries, and targeted test selection.",
      promotionRoute: "Capability recommendation only; no automatic tool or worker mutation.",
    },
    learnWhy:
      "BOSS practices scoped investigation, owner-boundary respect, recovery planning, and test selection.",
    asset: "assets/forge-arena/posters/forge-hackathon.webp",
  },
  {
    id: "data-clean-room",
    title: "Data Clean Room",
    category: "Analysis",
    buildType: "Data Workflow",
    scoringRule: "efficiency",
    scoreBonus: 14,
    summary:
      "Build a data-quality checklist and transformation plan that catches missing, stale, and risky fields.",
    prompt:
      "Build a data-cleaning workflow challenge solution. Include field checks, anomaly handling, transformation notes, and decision caveats.",
    skillCandidate: "data_quality_workflow",
    proofRoute: "sample table, validation checklist, transform summary, caveats",
    outputContract: {
      artifact: "Data quality report with checks, anomalies, transformations, and caveats.",
      skillCandidate: "Reusable data-cleaning checklist after validation proof.",
      studyPattern: "Missingness checks, stale-field handling, and caveated recommendations.",
      promotionRoute: "Skill candidate can be studied; production use needs user-approved context.",
    },
    learnWhy:
      "BOSS learns data skepticism, repeatable analysis hygiene, and evidence-backed recommendations.",
    asset: "assets/forge-arena/posters/worker-swarm-trial.webp",
  },
  {
    id: "meeting-to-plan",
    title: "Meeting To Plan",
    category: "Operations",
    buildType: "Planning System",
    scoringRule: "creativity",
    scoreBonus: 12,
    summary:
      "Build a meeting-to-execution converter with decisions, owners, follow-ups, and risk flags.",
    prompt:
      "Build an operations challenge solution that turns messy meeting notes into decisions, tasks, owners, follow-ups, risk flags, and questions.",
    skillCandidate: "meeting_to_execution_plan",
    proofRoute: "meeting notes, decision log, task map, owner approval",
    outputContract: {
      artifact: "Execution plan with decisions, owners, follow-ups, risk flags, and questions.",
      skillCandidate: "Meeting-to-plan workflow after owner confirmation.",
      studyPattern: "Decision extraction, ownership mapping, and ambiguity tracking.",
      promotionRoute: "Self-lesson proposal only; durable profile learning requires approval.",
    },
    learnWhy:
      "BOSS practices structure extraction, project planning, ambiguity tracking, and useful follow-through.",
    asset: "assets/forge-arena/posters/memory-sleep-trial.webp",
  },
];

export const FORGE_ARENA_PLAN_SPINE_CONTRACT = [
  {
    id: "deep-plan-intake",
    label: "Deep Plan Intake",
    status: "waiting on TruthSpine lane",
    owner: "TruthSpine",
    detail:
      "BABS expects an approved Arena plan, current objective, constraints, and user-approved priorities before autonomous scheduling.",
    babsUse: "Choose the next Arena task without inventing a new direction.",
  },
  {
    id: "task-sizing",
    label: "Task Sizing",
    status: "Forge-ready contract",
    owner: "BABS",
    detail:
      "BABS should break Arena work into playable, provable slices: one challenge, one bot build, one judgment pass, or one skill candidate.",
    babsUse: "Keep official bots working on bounded tasks that can be tested and rolled back.",
  },
  {
    id: "worker-routing",
    label: "Worker Routing",
    status: "Forge-ready contract",
    owner: "BABS",
    detail:
      "BABS assigns official bots or a user BOSS profile to the right lane: game build, productivity challenge, judging, study, or proof.",
    babsUse: "Direct the right BOSS/bot without giving it extra authority.",
  },
  {
    id: "proof-gate",
    label: "Proof Gate",
    status: "required",
    owner: "BIOS governance",
    detail:
      "Every Arena task must produce proof before it can affect ranking, learning, memory, or profile capability.",
    babsUse: "Block score-only or vibe-only growth claims.",
  },
  {
    id: "safe-promotion",
    label: "Safe Promotion",
    status: "approval-gated",
    owner: "User and BIOS governance",
    detail:
      "Skill candidates, self-lessons, memory, worker changes, and soul changes stay proposals until the right approval route accepts them.",
    babsUse: "Make BOSS profiles better without silent mutation.",
  },
];

export const FORGE_ARENA_HUB_MODES = [
  {
    id: "quick-play",
    label: "Quick Play",
    metric: "2 min",
    action: "play",
    targetId: "forge-arcade-panel",
    summary: "Jump into the active playable Arena draft.",
    icon: "assets/forge-arena/icons/mode-play.webp",
  },
  {
    id: "boss-build",
    label: "BOSS Build",
    metric: "Agent builder",
    action: "build",
    targetId: "forge-arcade-panel",
    summary: "Tell BOSS what to build, then playtest the result.",
    icon: "assets/forge-arena/icons/mode-build.webp",
  },
  {
    id: "watch-live",
    label: "Watch Live",
    metric: "Arena feed",
    action: "watch",
    targetId: "forge-arena-challenge-rail-panel",
    summary: "See runs, events, and judged activity.",
    icon: "assets/forge-arena/icons/live-broadcast.webp",
  },
  {
    id: "compete",
    label: "Compete",
    metric: "Ranked",
    action: "compete",
    targetId: "forge-arena-leaderboard-panel",
    summary: "Climb standings with proof-backed results.",
    icon: "assets/forge-arena/icons/standing-leader-crown.webp",
  },
  {
    id: "workshop",
    label: "Workshop",
    metric: "Co-build",
    action: "workshop",
    targetId: "forge-arena-workshop-panel",
    summary: "Remix starter material into shareable game cards.",
    icon: "assets/forge-arena/icons/editor-create.webp",
  },
  {
    id: "babs-command",
    label: "BABS Command",
    metric: "Arena boss",
    action: "babs",
    targetId: "forge-game-hub",
    summary: "Review Arena direction from BIOS AI Arena Boss Synthetic.",
    icon: "assets/forge-arena/badges/capability-operator.webp",
  },
];

function countPublishedCards(forgeArcadeState) {
  return Array.isArray(forgeArcadeState?.publishedCards)
    ? forgeArcadeState.publishedCards.length
    : 0;
}

function pickTrendingTemplate({ forgeArcadeState, forgeArenaFeed }) {
  const published = Array.isArray(forgeArcadeState?.publishedCards)
    ? forgeArcadeState.publishedCards
    : [];
  const latestCard = published[0];
  if (latestCard?.templateLabel) return latestCard.templateLabel;
  if (forgeArcadeState?.draftSpec?.templateLabel) return forgeArcadeState.draftSpec.templateLabel;
  if (forgeArenaFeed?.currentSeason?.titleLabel) return forgeArenaFeed.currentSeason.titleLabel;
  return "Survival Arena";
}

function buildBabsDirective({ forgeArcadeState, forgeArenaFeed }) {
  const publishedCount = countPublishedCards(forgeArcadeState);
  const runCount = Array.isArray(forgeArenaFeed?.runs) ? forgeArenaFeed.runs.length : 0;
  const challengeCount = Array.isArray(forgeArenaFeed?.challenges)
    ? forgeArenaFeed.challenges.length
    : 0;
  if (publishedCount > 0) {
    return "Feature the strongest playable card, collect votes, and push the best remix forward.";
  }
  if (runCount > 0 || challengeCount > 0) {
    return "Turn live Arena activity into a playable starter so humans can test it immediately.";
  }
  return "Open with premade games, keep official bots active, and guide the first BOSS-built playtest.";
}

function buildBabsDispatches({ forgeArcadeState, forgeArenaFeed }) {
  const publishedCount = countPublishedCards(forgeArcadeState);
  const runCount = Array.isArray(forgeArenaFeed?.runs) ? forgeArenaFeed.runs.length : 0;
  const challengeCount = Array.isArray(forgeArenaFeed?.challenges)
    ? forgeArenaFeed.challenges.length
    : 0;
  const dispatches = [
    {
      label: "Builder Order",
      title: publishedCount > 0 ? "Push strongest card to ranking" : "Seed the first playable card",
      detail:
        publishedCount > 0
          ? "BABS is routing the latest published game toward votes, remixes, and judging."
          : "BABS wants the next user action to create one playable starter card.",
    },
    {
      label: "Arena Ops",
      title: runCount > 0 ? "Convert run data into play prompts" : "Keep starter games ready",
      detail:
        runCount > 0
          ? `${runCount} run signal(s) can become new build prompts.`
          : "Official bots stay active even before live community data arrives.",
    },
    {
      label: "Challenge Desk",
      title: challengeCount > 0 ? "Rank active challenges" : "Open Season Zero onboarding",
      detail:
        challengeCount > 0
          ? `${challengeCount} challenge(s) are available for BABS judging and featured placement.`
          : "The hub should teach the player: ask, build, play, publish, rank.",
    },
  ];
  return dispatches;
}

function buildCommunityRankPreview({ forgeArcadeState }) {
  const published = Array.isArray(forgeArcadeState?.publishedCards)
    ? forgeArcadeState.publishedCards
    : [];
  if (!published.length) {
    return [
      {
        rank: 1,
        title: "First Agent-Built Game Pending",
        meta: "No published cards yet",
        score: "0",
        detail: "Publish the first playtest card to start the community ranking board.",
      },
    ];
  }
  return published
    .map((card) => {
      const votes = card.votes || {};
      const voteScore =
        Number(votes.fun || 0) + Number(votes.useful || 0) + Number(votes.remix || 0);
      return {
        rank: 0,
        title: card.title || "Forge Arcade Game",
        meta: `${card.templateLabel || card.templateId || "Template"} - ${voteScore} vote(s)`,
        score: String(Number(card.score || 0)),
        detail: card.proofSummary || card.objective || "Published local game card.",
      };
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function scorePublishedCard(card) {
  const votes = card?.votes || {};
  const voteScore = Number(votes.fun || 0) + Number(votes.useful || 0) + Number(votes.remix || 0);
  return Number(card?.score || 0) + voteScore * 25;
}

function buildArcadeTelemetryDigest({ forgeArcadeState }) {
  const published = Array.isArray(forgeArcadeState?.publishedCards)
    ? forgeArcadeState.publishedCards
    : [];
  const topCard =
    published
      .slice()
      .sort((a, b) => scorePublishedCard(b) - scorePublishedCard(a))
      .at(0) || null;
  const totalVotes = published.reduce((total, card) => {
    const votes = card?.votes || {};
    return total + Number(votes.fun || 0) + Number(votes.useful || 0) + Number(votes.remix || 0);
  }, 0);
  const remixCount = published.filter((card) => card?.remix?.parentCardId || card?.parentCardId)
    .length;
  return {
    publishedCount: published.length,
    totalVotes,
    remixCount,
    activeTemplate:
      forgeArcadeState?.draftSpec?.templateLabel ||
      forgeArcadeState?.draftSpec?.templateId ||
      "Survival Arena",
    lastPlaytestScore: Number(forgeArcadeState?.lastPlaytest?.score || 0),
    topCard: topCard
      ? {
          title: topCard.title || "Forge Arcade Game",
          template: topCard.templateLabel || topCard.templateId || "Template",
          score: Number(topCard.score || 0),
          voteScore: scorePublishedCard(topCard),
          proofSummary: topCard.proofSummary || topCard.objective || "Published game card.",
        }
      : null,
  };
}

function buildBabsArenaDecision({ forgeArcadeState, forgeArenaFeed }) {
  const digest = buildArcadeTelemetryDigest({ forgeArcadeState });
  const challengeCount = Array.isArray(forgeArenaFeed?.challenges)
    ? forgeArenaFeed.challenges.length
    : 0;
  if (!digest.publishedCount) {
    return {
      verdict: "seed",
      title: "Seed The First Playable Card",
      confidence: "starter",
      explanation:
        "BABS cannot feature an Arena build yet because no published Forge Arcade card exists. The next useful move is to build and publish one bounded starter.",
      nextChallenge: "Create one official BOSS-built starter card, then collect a playtest score.",
      reasons: [
        "No published cards",
        `${challengeCount} active challenge signal(s)`,
        `Active template: ${digest.activeTemplate}`,
      ],
      telemetryDigest: digest,
    };
  }
  if (digest.topCard && digest.topCard.score >= 500) {
    return {
      verdict: "feature",
      title: `Feature ${digest.topCard.title}`,
      confidence: digest.totalVotes > 0 ? "strong" : "score-led",
      explanation: `${digest.topCard.title} has enough local score/proof signal for BABS to feature it as the current Arena build while more votes arrive.`,
      nextChallenge: `Ask official bots to build a harder remix of ${digest.topCard.template}.`,
      reasons: [
        `${digest.publishedCount} published card(s)`,
        `${digest.totalVotes} community vote signal(s)`,
        `Top score ${digest.topCard.score}`,
      ],
      telemetryDigest: digest,
    };
  }
  return {
    verdict: "hold",
    title: "Hold For More Proof",
    confidence: "needs-signal",
    explanation:
      "BABS sees a published Arcade card, but the score signal is not strong enough yet. The Arena should collect another playtest, vote, or remix before featuring it.",
    nextChallenge: "Run another playtest or build a variant from the same prompt.",
    reasons: [
      `${digest.publishedCount} published card(s)`,
      `${digest.totalVotes} community vote signal(s)`,
      `Latest playtest score ${digest.lastPlaytestScore}`,
    ],
    telemetryDigest: digest,
  };
}

function buildSkillLearningPreview({ skillChallenges }) {
  return skillChallenges.map((challenge) => ({
    id: challenge.id,
    title: challenge.title,
    artifact: challenge.outputContract.artifact,
    skillCandidate: challenge.outputContract.skillCandidate,
    studyPattern: challenge.outputContract.studyPattern,
    promotionRoute: challenge.outputContract.promotionRoute,
    proofRoute: challenge.proofRoute,
  }));
}

const FORGE_ARENA_PROGRESSION_RANKS = [
  {
    rank: "Rookie",
    minProof: 0,
    nextRank: "Builder",
    rankAsset: "assets/forge-arena/badges/rank-rookie.webp",
  },
  {
    rank: "Builder",
    minProof: 160,
    nextRank: "Contender",
    rankAsset: "assets/forge-arena/badges/rank-builder.webp",
  },
  {
    rank: "Contender",
    minProof: 320,
    nextRank: "Champion",
    rankAsset: "assets/forge-arena/badges/rank-contender.webp",
  },
  {
    rank: "Champion",
    minProof: 700,
    nextRank: "Legend",
    rankAsset: "assets/forge-arena/badges/rank-champion.webp",
  },
  {
    rank: "Legend",
    minProof: 1400,
    nextRank: null,
    rankAsset: "assets/forge-arena/badges/rank-legend.webp",
  },
];

function sumCardVotes(card) {
  const votes = card?.votes || {};
  return Number(votes.fun || 0) + Number(votes.useful || 0) + Number(votes.remix || 0);
}

function buildProgressionFromProof({ proofPoints, reasons, nextAction, locked = false }) {
  const orderedRanks = FORGE_ARENA_PROGRESSION_RANKS;
  const activeRank =
    orderedRanks
      .slice()
      .reverse()
      .find((rank) => proofPoints >= rank.minProof) || orderedRanks[0];
  const nextRank = orderedRanks.find((rank) => rank.rank === activeRank.nextRank) || null;
  const level = locked ? Math.max(20, Math.floor(proofPoints / 100)) : Math.max(1, Math.floor(proofPoints / 80) + 1);
  const progressBase = activeRank.minProof;
  const progressLimit = nextRank?.minProof || Math.max(activeRank.minProof + 1, proofPoints);
  const progress =
    nextRank && progressLimit > progressBase
      ? Math.max(0, Math.min(100, Math.round(((proofPoints - progressBase) / (progressLimit - progressBase)) * 100)))
      : 100;
  const pointsToNext = nextRank ? Math.max(0, nextRank.minProof - proofPoints) : 0;
  return {
    rank: activeRank.rank,
    level,
    proofPoints,
    rankAsset: activeRank.rankAsset,
    nextRank: nextRank?.rank || "Max Rank",
    pointsToNext,
    progress,
    reasons,
    nextAction: nextRank ? nextAction : "Maintain Legend status with judged proof and seasonal wins.",
  };
}

function buildHumanProgression({ forgeArcadeState, forgeArenaFeed }) {
  const published = Array.isArray(forgeArcadeState?.publishedCards)
    ? forgeArcadeState.publishedCards
    : [];
  const runs = Array.isArray(forgeArenaFeed?.runs) ? forgeArenaFeed.runs : [];
  const votes = published.reduce((total, card) => total + sumCardVotes(card), 0);
  const topScore = published.reduce((best, card) => Math.max(best, Number(card?.score || 0)), 0);
  const proofPoints = published.length * 90 + runs.length * 35 + votes * 15 + Math.floor(topScore / 10);
  return buildProgressionFromProof({
    proofPoints,
    reasons: [
      `${published.length} published card(s)`,
      `${runs.length} visible run(s)`,
      `${votes} vote signal(s)`,
      `top score ${topScore}`,
    ],
    nextAction:
      "Publish another playtested build, collect votes, or submit a judged run to move the player card.",
  });
}

function buildBossProgression({ forgeArcadeState, forgeArenaFeed }) {
  const published = Array.isArray(forgeArcadeState?.publishedCards)
    ? forgeArcadeState.publishedCards
    : [];
  const runs = Array.isArray(forgeArenaFeed?.runs) ? forgeArenaFeed.runs : [];
  const challenges = Array.isArray(forgeArenaFeed?.challenges) ? forgeArenaFeed.challenges : [];
  const votes = published.reduce((total, card) => total + sumCardVotes(card), 0);
  const topScore = published.reduce((best, card) => Math.max(best, Number(card?.score || 0)), 0);
  const proofPoints =
    published.length * 120 +
    runs.length * 45 +
    challenges.length * 28 +
    votes * 18 +
    Math.floor(topScore / 8);
  return buildProgressionFromProof({
    proofPoints,
    reasons: [
      `${published.length} built card(s)`,
      `${runs.length} proof run(s)`,
      `${challenges.length} challenge signal(s)`,
      `top build score ${topScore}`,
    ],
    nextAction:
      "Build a harder variant, solve a Skill Forge challenge, or earn a BABS feature decision.",
  });
}

function buildForgeArenaPlayerCards({ profile, agentName, forgeArcadeState, forgeArenaFeed }) {
  const publishedCount = countPublishedCards(forgeArcadeState);
  const runCount = Array.isArray(forgeArenaFeed?.runs) ? forgeArenaFeed.runs.length : 0;
  const challengeCount = Array.isArray(forgeArenaFeed?.challenges)
    ? forgeArenaFeed.challenges.length
    : 0;
  const publicName = profile?.public_display_name || profile?.display_name || "Human Player";
  const bossName = profile?.boss_display_name || agentName || "BOSS";
  const humanProgression = buildHumanProgression({ forgeArcadeState, forgeArenaFeed });
  const bossProgression = buildBossProgression({ forgeArcadeState, forgeArenaFeed });
  const babsProgression = buildProgressionFromProof({
    proofPoints: Math.max(1400, challengeCount * 40 + publishedCount * 30 + runCount * 25 + 1400),
    reasons: [
      `${challengeCount} managed challenge(s)`,
      `${publishedCount} tracked build(s)`,
      `${runCount} monitored run(s)`,
      "official Arena governance",
    ],
    nextAction: "Keep official judging and bot routing explainable.",
    locked: true,
  });
  const cards = [
    {
      id: "human-player",
      type: "user",
      name: publicName,
      role: "Arena Player",
      status: profile?.arena_identity_id ? "identity issued" : "local profile",
      rank: humanProgression.rank,
      level: humanProgression.level,
      arenaClass: "Player-Builder",
      avatarAsset: "assets/forge-arena/profile/avatar-frame-human.webp",
      rankAsset: humanProgression.rankAsset,
      capabilityAsset: "assets/forge-arena/badges/capability-creator.webp",
      progression: humanProgression,
      detail: "Human profile owns prompts, playtests, approvals, and public identity choices.",
    },
    {
      id: "active-boss",
      type: "boss",
      name: bossName,
      role: "Personal BOSS Profile",
      status: "profile-bound",
      rank: bossProgression.rank,
      level: bossProgression.level,
      arenaClass: "Agent Builder",
      avatarAsset: "assets/forge-arena/profile/avatar-frame-boss.webp",
      rankAsset: bossProgression.rankAsset,
      capabilityAsset: "assets/forge-arena/badges/capability-agent-architect.webp",
      progression: bossProgression,
      detail: "BOSS builds playable drafts, solves challenges, and proposes skill candidates.",
    },
    {
      id: "babs",
      type: "arena-boss",
      name: "B.A.B.S",
      role: "Arena Boss",
      status: "governing",
      rank: babsProgression.rank,
      level: babsProgression.level,
      arenaClass: "Boss Judge",
      avatarAsset: "assets/forge-arena/profile/crest-studio.webp",
      rankAsset: babsProgression.rankAsset,
      capabilityAsset: "assets/forge-arena/badges/capability-judge.webp",
      progression: babsProgression,
      detail: "BABS assigns official bots, judges Arena readiness, and protects growth routes.",
    },
  ];

  FORGE_ARENA_OFFICIAL_BOTS.forEach((bot) => {
    const botProgression = buildProgressionFromProof({
      proofPoints: Number(bot.level || 1) * 90,
      reasons: [
        "official company bot",
        `${bot.state} assignment`,
        `${bot.arenaClass} class`,
        "BABS-controlled mission",
      ],
      nextAction: "Receive another BABS assignment and produce a judged official build.",
    });
    cards.push({
      id: bot.id,
      type: "official-bot",
      name: bot.name,
      role: bot.role,
      status: bot.state,
      rank: botProgression.rank,
      level: botProgression.level,
      arenaClass: bot.arenaClass,
      avatarAsset: bot.asset,
      rankAsset: botProgression.rankAsset || bot.rankAsset,
      capabilityAsset: bot.asset,
      progression: botProgression,
      detail: bot.lockNote,
    });
  });

  return cards;
}

export function buildForgeArenaHubModel({
  forgeArenaFeed = {},
  forgeArcadeState = {},
  profile = null,
  agentName = "BOSS",
} = {}) {
  const publishedCount = countPublishedCards(forgeArcadeState);
  const runCount = Array.isArray(forgeArenaFeed?.runs) ? forgeArenaFeed.runs.length : 0;
  const challengeCount = Array.isArray(forgeArenaFeed?.challenges)
    ? forgeArenaFeed.challenges.length
    : 0;
  const currentSeason = forgeArenaFeed?.currentSeason?.title || "Season Zero - Foundry Dawn";
  const babsName = "B.A.B.S";
  const bossName = profile?.boss_display_name || agentName || "BOSS";
  const arenaHealth =
    publishedCount > 0 || runCount > 0 || challengeCount > 0 ? "Live and learning" : "Starter live";

  return {
    modes: FORGE_ARENA_HUB_MODES,
    officialBots: FORGE_ARENA_OFFICIAL_BOTS,
    starterGames: FORGE_ARENA_STARTER_GAMES,
    officialBuilds: FORGE_ARENA_OFFICIAL_BUILDS,
    bossGrowthTracks: FORGE_ARENA_BOSS_GROWTH_TRACKS,
    skillChallenges: FORGE_ARENA_SKILL_CHALLENGES,
    planSpineContract: FORGE_ARENA_PLAN_SPINE_CONTRACT,
    skillLearningPreview: buildSkillLearningPreview({
      skillChallenges: FORGE_ARENA_SKILL_CHALLENGES,
    }),
    playerCards: buildForgeArenaPlayerCards({
      profile,
      agentName,
      forgeArcadeState,
      forgeArenaFeed,
    }),
    buildPipeline: FORGE_ARENA_BUILD_PIPELINE,
    communityRankPreview: buildCommunityRankPreview({ forgeArcadeState }),
    babs: {
      name: babsName,
      subtitle: "BIOS AI Arena Boss Synthetic",
      status: `${babsName} is online as the Forge Arena assignment of ${bossName}.`,
      arenaHealth,
      season: currentSeason,
      trendingTemplate: pickTrendingTemplate({ forgeArcadeState, forgeArenaFeed }),
      directive: buildBabsDirective({ forgeArcadeState, forgeArenaFeed }),
      arenaDecision: buildBabsArenaDecision({ forgeArcadeState, forgeArenaFeed }),
      dispatches: buildBabsDispatches({ forgeArcadeState, forgeArenaFeed }),
      metrics: [
        { label: "Published Cards", value: String(publishedCount) },
        { label: "Live Runs", value: String(runCount) },
        { label: "Challenges", value: String(challengeCount) },
      ],
    },
  };
}
