export const FORGE_ARCADE_STORAGE_KEY = "bios-ai-forge-arcade-v1";
export const FORGE_ARCADE_TEMPLATE_ID = "survival-arena";
export const FORGE_ARCADE_TEMPLATE_IDS = ["survival-arena", "proof-rush", "boss-defense"];

const DEFAULT_PROMPT =
  "Build a fast one-minute survival arena where the player and BOSS dodge hazards, collect proof shards, and try to last until extraction.";

export const FORGE_ARCADE_TEMPLATES = [
  {
    id: "survival-arena",
    label: "Survival Arena",
    verb: "survive",
    objective:
      "Survive the arena clock, collect proof shards, and use BOSS callouts to avoid hazard waves.",
    pickupLabel: "Proof Shards",
    hazardLabel: "Fault Lines",
    coverAsset: "assets/forge-arena/posters/one-button-survival-jam.webp",
    defaultDurationSeconds: 60,
    scorePerPickup: 120,
    scorePerSecond: 8,
  },
  {
    id: "proof-rush",
    label: "Proof Rush",
    verb: "collect",
    objective:
      "Race through a compact arena, collect every proof shard, and let BOSS call the cleanest route.",
    pickupLabel: "Route Shards",
    hazardLabel: "Time Gates",
    coverAsset: "assets/forge-arena/posters/tool-forge-sprint.webp",
    defaultDurationSeconds: 45,
    scorePerPickup: 160,
    scorePerSecond: 5,
  },
  {
    id: "boss-defense",
    label: "BOSS Defense",
    verb: "protect",
    objective:
      "Protect the BOSS beacon while collecting repair shards and dodging incoming fault pulses.",
    pickupLabel: "Repair Shards",
    hazardLabel: "Fault Pulses",
    coverAsset: "assets/forge-arena/posters/agent-arena-clash.webp",
    defaultDurationSeconds: 70,
    scorePerPickup: 100,
    scorePerSecond: 10,
  },
];

const THEME_PRESETS = {
  sky: {
    label: "Skyward Keep",
    palette: ["#63f5d2", "#ffe08b", "#192a36"],
    coverAsset: "assets/forge-arena/posters/skyward-keep.webp",
    arenaAccent: "#63f5d2",
  },
  neon: {
    label: "Neon Foundry",
    palette: ["#7dffb4", "#ffb84a", "#121826"],
    coverAsset: "assets/forge-arena/posters/one-button-survival-jam.webp",
    arenaAccent: "#7dffb4",
  },
  clash: {
    label: "Agent Clash",
    palette: ["#ffa94d", "#85f5ff", "#18131d"],
    coverAsset: "assets/forge-arena/posters/agent-arena-clash.webp",
    arenaAccent: "#ffa94d",
  },
  forge: {
    label: "Forge Hackathon",
    palette: ["#ffd56a", "#79f2c6", "#17130d"],
    coverAsset: "assets/forge-arena/posters/forge-hackathon.webp",
    arenaAccent: "#ffd56a",
  },
};

function stableHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickTheme(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (/(sky|castle|cloud|float|keep)/.test(text)) return THEME_PRESETS.sky;
  if (/(battle|clash|boss|duel|enemy)/.test(text)) return THEME_PRESETS.clash;
  if (/(forge|hack|build|tool|factory)/.test(text)) return THEME_PRESETS.forge;
  return THEME_PRESETS.neon;
}

function titleFromPrompt(prompt, themeLabel) {
  const words = String(prompt || "")
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 4);
  if (!words.length) return `${themeLabel} Survival`;
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 44);
}

function getTemplate(templateId = FORGE_ARCADE_TEMPLATE_ID) {
  return (
    FORGE_ARCADE_TEMPLATES.find((template) => template.id === templateId) ||
    FORGE_ARCADE_TEMPLATES[0]
  );
}

export function createInitialForgeArcadeState(now = Date.now()) {
  const spec = buildSurvivalArenaSpecFromPrompt(DEFAULT_PROMPT, { now });
  return {
    version: 1,
    activeBrief: DEFAULT_PROMPT,
    activeTemplateId: spec.templateId,
    draftSpec: spec,
    lastPlaytest: null,
    publishedCards: [createForgeGameCardFromSpec(spec, null, { publishedAt: now })],
    remixLineage: [],
    communityVotes: {},
    selectedCardId: spec.id,
    status: "BOSS is ready to build a playable Forge Arcade run.",
  };
}

export function loadForgeArcadeState(storage = globalThis.localStorage) {
  if (!storage?.getItem) return createInitialForgeArcadeState();
  try {
    const raw = storage.getItem(FORGE_ARCADE_STORAGE_KEY);
    if (!raw) return createInitialForgeArcadeState();
    const parsed = JSON.parse(raw);
    const state = {
      ...createInitialForgeArcadeState(),
      ...parsed,
      publishedCards: Array.isArray(parsed?.publishedCards) ? parsed.publishedCards : [],
      remixLineage: Array.isArray(parsed?.remixLineage) ? parsed.remixLineage : [],
      communityVotes: parsed?.communityVotes || {},
    };
    const validation = validateForgeGameSpec(state.draftSpec);
    if (!validation.ok) return createInitialForgeArcadeState();
    return state;
  } catch {
    return createInitialForgeArcadeState();
  }
}

export function saveForgeArcadeState(state, storage = globalThis.localStorage) {
  if (!storage?.setItem) return false;
  storage.setItem(FORGE_ARCADE_STORAGE_KEY, JSON.stringify(state));
  return true;
}

export function buildSurvivalArenaSpecFromPrompt(prompt = DEFAULT_PROMPT, options = {}) {
  return buildForgeGameSpecFromPrompt(prompt, { ...options, templateId: FORGE_ARCADE_TEMPLATE_ID });
}

export function buildForgeGameSpecFromPrompt(prompt = DEFAULT_PROMPT, options = {}) {
  const cleanPrompt = String(prompt || DEFAULT_PROMPT).trim() || DEFAULT_PROMPT;
  const template = getTemplate(options.templateId);
  const seed = stableHash(`${template.id}:${cleanPrompt}:${options.iteration || 0}`);
  const theme = pickTheme(cleanPrompt);
  const intensity =
    /hard|brutal|chaos|nightmare|boss|swarm/i.test(cleanPrompt) || options.harder ? 3 : 2;
  const companionMode = /co-?op|partner|team|boss|agent|companion/i.test(cleanPrompt)
    ? "tactical-companion"
    : "guide-companion";
  const title = titleFromPrompt(cleanPrompt, theme.label);
  const hazardBase = template.id === "proof-rush" ? 3 : template.id === "boss-defense" ? 7 : 5;
  const pickupBase = template.id === "proof-rush" ? 8 : template.id === "boss-defense" ? 5 : 5;
  const hazardCount = hazardBase + intensity + (seed % 3);
  const pickupCount = pickupBase + ((seed >>> 3) % 4);
  const durationSeconds = Math.max(
    30,
    Math.min(95, Number(options.durationSeconds || template.defaultDurationSeconds)),
  );

  return {
    id: `forge-game-${seed.toString(16)}`,
    version: 1,
    templateId: template.id,
    templateLabel: template.label,
    title,
    prompt: cleanPrompt,
    theme: theme.label,
    objective: template.objective,
    controls: ["WASD", "Arrow keys", "Start", "Publish"],
    rules: {
      durationSeconds,
      playerSpeed: template.id === "proof-rush" ? 285 + intensity * 8 : 245 + intensity * 8,
      bossAssistCooldownSeconds: Math.max(8, 14 - intensity),
      hazardCount,
      pickupCount,
      scorePerShard: template.scorePerPickup,
      survivalScorePerSecond: template.scorePerSecond,
      winCondition:
        template.id === "proof-rush"
          ? "collect-all"
          : template.id === "boss-defense"
            ? "protect-beacon"
            : "survive-clock",
    },
    entities: {
      player: { label: "Human Player", color: theme.palette[0] },
      companion: { label: "BOSS", mode: companionMode, color: theme.palette[1] },
      hazards: { label: template.hazardLabel, count: hazardCount, color: "#ff5c7a" },
      pickups: { label: template.pickupLabel, count: pickupCount, color: theme.palette[1] },
      beacon:
        template.id === "boss-defense"
          ? { label: "BOSS Beacon", color: "#85f5ff", integrity: 100 }
          : null,
    },
    assets: {
      cover: template.coverAsset || theme.coverAsset,
      stage: "assets/forge-arena/backgrounds/hero-featured-run-season-zero.webp",
      ambient: "assets/forge-arena/backgrounds/forge-page-ambient-season-zero.webp",
      badge: "assets/forge-arena/badges/capability-builder.webp",
    },
    visual: {
      palette: theme.palette,
      arenaAccent: theme.arenaAccent,
    },
    governance: {
      authoringMode: "template-data-only",
      allowedHostPowers: [],
      publishState: "local-draft",
      templateCatalog: "forge-arcade-season-zero",
      safetySummary:
        `This game is generated from the bounded ${template.label} template; no arbitrary code, shell, network, or filesystem access is granted.`,
    },
    remix: {
      parentSpecId: options.parentSpecId || null,
      generation: Math.max(0, Number(options.generation || 0)),
      remixNote: options.remixNote || "",
    },
  };
}

export function validateForgeGameSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") errors.push("spec must be an object");
  if (!FORGE_ARCADE_TEMPLATE_IDS.includes(spec?.templateId)) errors.push("unsupported template");
  if (!spec?.title) errors.push("title is required");
  if (!spec?.rules || typeof spec.rules !== "object") errors.push("rules are required");
  if (Number(spec?.rules?.durationSeconds || 0) < 10) errors.push("duration is too short");
  if (Number(spec?.rules?.hazardCount || 0) < 1) errors.push("at least one hazard is required");
  if (!spec?.governance || spec.governance.authoringMode !== "template-data-only") {
    errors.push("template governance is required");
  }
  if (Array.isArray(spec?.governance?.allowedHostPowers) && spec.governance.allowedHostPowers.length) {
    errors.push("host powers must remain empty");
  }
  return { ok: errors.length === 0, errors };
}

export function createForgeGameCardFromSpec(spec, playtest = null, options = {}) {
  const score = Number(playtest?.score || 0);
  const votes = options.votes || {};
  return {
    id: options.cardId || spec.id,
    specId: spec.id,
    title: spec.title,
    templateId: spec.templateId,
    templateLabel: spec.templateLabel || getTemplate(spec.templateId).label,
    theme: spec.theme,
    cover: spec.assets?.cover || "assets/forge-arena/posters/one-button-survival-jam.webp",
    objective: spec.objective,
    score,
    plays: Number(options.plays || 1),
    votes: {
      fun: Number(votes.fun || 0),
      useful: Number(votes.useful || 0),
      remix: Number(votes.remix || 0),
    },
    remix: spec.remix || { parentSpecId: null, generation: 0, remixNote: "" },
    status: options.status || "local-published",
    publishedAt: options.publishedAt || Date.now(),
    proofSummary: playtest
      ? `Playtest scored ${score} with ${playtest.shardsCollected || 0} shard(s) and ${Math.round(playtest.survivedSeconds || 0)} second(s) survived.`
      : `Starter card generated from the bounded ${spec.templateLabel || getTemplate(spec.templateId).label} template.`,
  };
}

export function summarizeForgeGameSpec(spec) {
  const validation = validateForgeGameSpec(spec);
  return {
    ok: validation.ok,
    title: spec?.title || "Untitled Forge Game",
    theme: spec?.theme || "Unknown theme",
    template: spec?.templateLabel || getTemplate(spec?.templateId).label,
    runtime:
      spec?.governance?.authoringMode === "template-data-only"
        ? "Template-bound playable runtime"
        : "Unknown runtime",
    difficulty: `${Number(spec?.rules?.hazardCount || 0)} hazards / ${Number(spec?.rules?.pickupCount || 0)} shards`,
    safety: spec?.governance?.safetySummary || validation.errors.join("; "),
  };
}
