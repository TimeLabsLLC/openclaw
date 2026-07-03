import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appRoot = path.join(repoRoot, "aether-canvas");
const host = "127.0.0.1";
const port = Number(process.env.BIOS_AI_UX_AUDIT_PORT || 4173);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
  [".ico", "image/x-icon"],
]);

function contentTypeFor(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function buildAuditPrelude(scenario) {
  return `
<script>
(() => {
  const scenario = ${JSON.stringify(scenario)};
  const routeBlockedScenario =
    scenario === "diagnostics-recovery" || scenario === "stale-saved-route-bypass";
  let workerDownloadStarted = false;
  let workerDownloadVariant = null;
  const forgeAuditStorageKey = "forge-arena-audit-profile";
  const biosAuditProfileStorageKey = "bios-audit-profile-detail";
  const biosAuditProviderStorageKey = "bios-audit-provider-config";
  const biosAuditConnectorStorageKey = "bios-audit-connector-config";
  const biosAuditProfileIsolationStorageKey = "bios-audit-profile-isolation-detail";
  const biosAuditProviderIsolationStorageKey = "bios-audit-profile-isolation-provider-config";
  const biosAuditConnectorIsolationStorageKey = "bios-audit-profile-isolation-connector-config";
  const profileScenarios = new Set([
    "forge-profile",
    "profile-lifecycle",
    "profile-isolation",
    "soul-governance",
    "nervous-system",
    "organ-supervisor",
    "settings-surface",
    "sandbox-promotion-lifecycle",
    "diagnostics-recovery",
    "stale-saved-route-bypass",
    "delete-last-profile",
    "profiles-no-active",
    "resume-runtime-setup",
  ]);
  const biosProfileSummary = {
    id: "claw",
    display_name: "Claw",
    created_at: "1",
    updated_at: "1",
    completed: true,
    model_pref: "local",
    preferred_local_backend: "bios-managed",
    local_worker_ready: true,
  };
  const biosProfileDetail = {
    profile: biosProfileSummary,
    onboarding: {
      completed: true,
      agent_name: "Claw",
      model_pref: "local",
      preferred_local_backend: "bios-managed",
      local_worker_download_status: "completed",
      local_worker_model_variant: "gemma-3-1b",
      bios_worker_roster: [
        { role: "boss_brain", variant: "gemma-3-1b", path: null },
        { role: "medium_worker", variant: "gemma-3-1b", path: null },
        { role: "small_worker", variant: "gemma-3-1b", path: null },
      ],
      safety_posture_label: "Native boxed-lane hardened",
      execution_mode: "Sandbox-first",
      sandbox_backend: "Native boxed lane",
      tool_creation_policy: "Build and test in sandbox first",
      host_access: "Promotion required before host writes",
      promotion_policy: "Approval and validation before host adoption",
      permission_mode: "not_allowed",
      preferred_cloud_provider: "openai",
      api_keys: [
        { provider: "openai", key: "sk-openai", source: "manual", label: "OpenAI" },
        { provider: "anthropic", key: "sk-anthropic", source: "manual", label: "Anthropic" },
      ],
    },
  };
  const emberProfileSummary = {
    ...biosProfileSummary,
    id: "ember",
    display_name: "Ember",
    model_pref: "hybrid",
  };
  const emberProfileDetail = {
    profile: emberProfileSummary,
    onboarding: {
      ...biosProfileDetail.onboarding,
      agent_name: "Ember",
      model_pref: "hybrid",
      preferred_cloud_provider: "anthropic",
      local_worker_model_variant: "qwen-3-8b",
      bios_worker_roster: [
        { role: "boss_brain", variant: "qwen-3-8b", path: null },
        { role: "medium_worker", variant: "gemma-3-1b", path: null },
        { role: "small_worker", variant: "gemma-3-1b", path: null },
      ],
    },
  };
  const profileIsolationDetails = {
    claw: JSON.parse(JSON.stringify(biosProfileDetail)),
    ember: JSON.parse(JSON.stringify(emberProfileDetail)),
  };
  let biosProfilesState = profileScenarios.has(scenario) ? [{ ...biosProfileSummary }] : [];
  let activeBiosProfileIdState = profileScenarios.has(scenario) ? "claw" : null;
  if (scenario === "profiles-no-active") {
    biosProfilesState = [
      { ...biosProfileSummary },
      {
        ...biosProfileSummary,
        id: "ember",
        display_name: "Ember",
      },
    ];
    activeBiosProfileIdState = null;
  }
  const multiProfileLifecycleScenario =
    scenario === "profile-isolation" || scenario === "profile-lifecycle";
  if (multiProfileLifecycleScenario) {
    biosProfilesState = [{ ...biosProfileSummary }, { ...emberProfileSummary }];
    activeBiosProfileIdState = "claw";
  }
  if (scenario === "resume-runtime-setup") {
    biosProfileDetail.profile = {
      ...biosProfileDetail.profile,
      completed: false,
      local_worker_ready: false,
    };
    biosProfileDetail.onboarding = {
      ...biosProfileDetail.onboarding,
      completed: false,
      local_worker_download_status: "failed",
      local_worker_model_variant: null,
      local_worker_model_path: null,
      bios_worker_roster: [],
    };
    biosProfilesState = [{ ...biosProfileDetail.profile }];
    activeBiosProfileIdState = "claw";
  }
  let providerConfigState = {
    active_provider: "bios-managed",
    active_model: "",
    keys: [
      { provider: "openai", key: "sk-openai", source: "manual", label: "OpenAI" },
      { provider: "anthropic", key: "sk-anthropic", source: "manual", label: "Anthropic" },
      { provider: "telegram", key: "tg-secret", source: "import", label: "Telegram" },
    ],
    conversation_history: [],
  };
  if (scenario === "stale-saved-route-bypass") {
    providerConfigState = {
      ...providerConfigState,
      active_provider: "lmstudio",
      active_model: "stale-local-model",
    };
  }
  const profileIsolationProviderConfigs = {
    claw: { ...providerConfigState },
    ember: {
      active_provider: "anthropic",
      active_model: "",
      keys: [
        { provider: "anthropic", key: "sk-anthropic-ember", source: "manual", label: "Anthropic" },
        { provider: "telegram", key: "tg-secret-ember", source: "import", label: "Telegram" },
      ],
      conversation_history: [],
    },
  };
  let connectorStatusState = {
    profile_id: "claw",
    connectors: [
      {
        connector: "telegram",
        configured: true,
        ready: false,
        enabled: false,
        profile_bound: false,
        has_key: true,
        permission_mode: "not_allowed",
        target_id: null,
        target_summary: "No Telegram target bound yet",
        allowed_actions: ["send_message"],
        label: "Telegram key found, connector disabled",
        detail: "Telegram is configured but disabled for this BOSS profile.",
      },
    ],
  };
  const profileIsolationConnectorStatus = {
    claw: { ...connectorStatusState },
    ember: {
      profile_id: "ember",
      connectors: [
        {
          connector: "telegram",
          configured: true,
          ready: true,
          enabled: true,
          profile_bound: true,
          has_key: true,
          permission_mode: "ask_first",
          target_id: "ember-room",
          target_summary: "Bound to Telegram target ember-room",
          allowed_actions: ["send_message"],
          label: "Telegram connector ready",
          detail: "BIOS AI can use Telegram through Ember's profile-bound connector lane.",
        },
      ],
    },
  };
  const biosLocalToolRegistryState = {
    tools: [
      {
        name: "capability.inventory.read",
        label: "Read BIOS capability inventory",
        category: "capability_inventory",
        execution_class: "safe_local_read",
        summary: "Read the BIOS-owned local action inventory and execution class boundaries.",
        approval_required: false,
        profile_required: false,
      },
      {
        name: "machine.inspect",
        label: "Inspect machine profile",
        category: "machine_inspection",
        execution_class: "safe_local_read",
        summary: "Read the real local machine profile BIOS AI discovered.",
        approval_required: false,
        profile_required: false,
      },
      {
        name: "runtime.inspect",
        label: "Inspect BIOS runtime",
        category: "runtime_inspection",
        execution_class: "safe_local_read",
        summary: "Read the live BIOS shell contract for this BOSS profile.",
        approval_required: false,
        profile_required: true,
      },
      {
        name: "memory.surface.read",
        label: "Read BIOS memory surface",
        category: "memory_read",
        execution_class: "safe_local_read",
        summary: "Read the active BIOS memory surface for this BOSS profile.",
        approval_required: false,
        profile_required: true,
      },
      {
        name: "profile.document.read",
        label: "Read BIOS profile document",
        category: "profile_read",
        execution_class: "safe_local_read",
        summary: "Read BIOS-owned profile documents like SOUL, IDENTITY, USER, or MEMORY.",
        approval_required: false,
        profile_required: true,
      },
      {
        name: "profile.runtime_preferences.update",
        label: "Update BIOS runtime preferences",
        category: "profile_mutation",
        execution_class: "approval_required_host_action",
        summary: "Change permission mode, route posture, or preferred local backend.",
        approval_required: true,
        profile_required: true,
      },
      {
        name: "runtime.model.select_managed",
        label: "Select BIOS managed model",
        category: "runtime_management",
        execution_class: "approval_required_host_action",
        summary: "Bind an installed BIOS AI managed local model to this BOSS profile.",
        approval_required: true,
        profile_required: true,
      },
      {
        name: "profile.memory.append_note",
        label: "Append BIOS memory note",
        category: "profile_mutation",
        execution_class: "boxed_first_risky_action",
        summary: "Stage a BIOS-owned memory note in the boxed lane before host promotion.",
        approval_required: true,
        profile_required: true,
      },
    ],
  };
  const managedWorkerCatalogEntries = [
    {
      variant: "gemma-3-1b",
      label: "Gemma 3 1B",
      family: "Gemma",
      role: "Fastest owned BOSS start for smaller machines.",
      summary: "Lightest BIOS AI managed local BOSS brain.",
      size_label: "~0.8 GB download",
      license_label: "Gemma Terms of Use",
      source_url: "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF",
      enabled: true,
      managed: true,
      installed: true,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
    {
      variant: "gemma-3-4b",
      label: "Gemma 3 4B",
      family: "Gemma",
      role: "Balanced owned BOSS choice for most people.",
      summary: "Steadier local BOSS brain without becoming too heavy.",
      size_label: "~3.0 GB download",
      license_label: "Gemma Terms of Use",
      source_url: "https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
    {
      variant: "qwen-3-8b",
      label: "Qwen3 8B",
      family: "Qwen",
      role: "Stronger reasoning headroom for a serious local BOSS.",
      summary: "Gives BIOS AI more local reasoning room than the balanced 4B lane.",
      size_label: "~5.2 GB download",
      license_label: "Apache-2.0",
      source_url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: true,
    },
    {
      variant: "qwen-3-14b",
      label: "Qwen3 14B",
      family: "Qwen",
      role: "Deep local reasoning headroom for a stronger owned BOSS.",
      summary: "A larger Qwen lane for more owned reasoning depth.",
      size_label: "~9.0 GB download",
      license_label: "Apache-2.0",
      source_url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
    {
      variant: "gemma-3-12b",
      label: "Gemma 3 12B",
      family: "Gemma",
      role: "Deepest managed on-device BOSS brain in the starter lane.",
      summary: "Largest BIOS AI managed starter option.",
      size_label: "~8.1 GB download",
      license_label: "Gemma Terms of Use",
      source_url: "https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
    {
      variant: "llama-3-1-8b",
      label: "Llama 3.1 8B",
      family: "Llama",
      role: "Popular general-purpose local BOSS brain with strong ecosystem compatibility.",
      summary: "A widely supported 8B local reasoning lane.",
      size_label: "~4.9 GB download",
      license_label: "Llama 3.1 Community License",
      source_url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
    {
      variant: "mistral-7b-v0-3",
      label: "Mistral 7B Instruct v0.3",
      family: "Mistral",
      role: "Efficient open-weight worker lane for fast general tasks.",
      summary: "A compact, capable local worker option.",
      size_label: "~4.4 GB download",
      license_label: "Apache-2.0",
      source_url: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
    {
      variant: "phi-3-5-mini",
      label: "Phi-3.5 Mini Instruct",
      family: "Phi",
      role: "Small fast reasoning worker for lighter helper tasks.",
      summary: "A small managed worker choice for quick local helper tasks.",
      size_label: "~2.2 GB download",
      license_label: "MIT",
      source_url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF",
      enabled: true,
      managed: true,
      installed: false,
      source: "bios-managed",
      download_supported: true,
      recommended_for_local: false,
      recommended_for_hybrid: false,
    },
  ];
  let forgeArenaProfileState = {
    bios_profile_id: "claw",
    arena_identity_id: "forge-local:claw",
    connected_identity_version: "forge-arena-connected-identity-v1",
    connected_backend_status: "local_contract_ready_backend_not_attached",
    public_visibility: "local_private",
    public_identity_scope: [
      "public_display_name",
      "boss_display_name",
      "presentation_mode",
      "first_use_preferences",
      "rank_class",
      "capability_class",
      "badges",
      "featured_work",
      "history_summary",
    ],
    private_truth_boundary:
      "Private BIOS memory, local files, provider keys, worker credentials, private prompts, and unsubmitted artifacts stay owned by the local BIOS profile and are not part of the connected Forge Arena identity contract.",
    ready: false,
    first_entry_completed: false,
    public_display_name: "Claw",
    boss_display_name: "Claw",
    presentation_mode: "duo",
    first_path_preference: null,
    entry_role_preference: null,
    rank_class: "Rookie",
    capability_class: "Local contender",
    capability_summary: "Runs from local BIOS AI runtime lanes and keeps primary work on this machine.",
    reputation_label: "Unranked founder",
    tagline: "New to Forge Arena",
    public_narrative: "Forge Arena is ready to give this BIOS profile a public face without giving up local sovereignty.",
    featured_work_title: "First Arena mark pending",
    featured_work_summary: "This profile has not published a judged run, co-build, tool, skill, or playable build yet.",
    history_summary: "No public Arena history yet. The first accepted action will start this profile's visible record.",
    badges: ["Season Zero Founder", "Local contender"],
    avatar_style: "signal",
    banner_style: "season-zero",
    created_at: 1,
    updated_at: 1,
  };
  let forgeArenaLocalState = {
    version: "forge-arena-local-v1",
    profile_id: "claw",
    ready: true,
    mode: "local_proving_ground",
    summary:
      "Forge Arena local proving ground is live with seeded bots, one official prompt, judged seed artifacts, and BOSS run measurement.",
    event: {
      id: "season-zero-weekly-build",
      title: "Season Zero Weekly Build",
      prompt:
        "Build a small useful thing, explain the work, respect blocks, and leave proof behind.",
      status: "live",
      scoring_rule: "proof, usefulness, recovery, and truthful limits",
    },
    bots: [
      {
        id: "bot-judge-spark",
        name: "Spark Judge",
        role: "judge",
        summary: "Scores clarity, usefulness, and proof discipline.",
        score: 86,
      },
      {
        id: "bot-builder-mica",
        name: "Mica Builder",
        role: "builder",
        summary: "Seeds small playable build ideas for the local Arena.",
        score: 78,
      },
      {
        id: "bot-sentinel-vale",
        name: "Vale Sentinel",
        role: "safety",
        summary: "Calls out missing permissions, sandbox gaps, and blocked capability claims.",
        score: 81,
      },
    ],
    artifacts: [
      {
        id: "seed-mica-build-card",
        owner_id: "bot-builder-mica",
        owner_label: "Mica Builder",
        kind: "seed_build",
        title: "Tiny Proof Deck",
        summary:
          "A bot-seeded challenge card that asks every entrant to show proof, limits, and next steps.",
        status: "judged",
        score: 78,
        verdict: "hold",
        judge_summary: "Useful seed content; waiting for BOSS entries to raise the bar.",
        blocked_capabilities: [],
        proof_refs: ["local-seed"],
        created_at: 1,
      },
    ],
    signals: [
      {
        id: "signal-seed-1",
        kind: "arena.seeded",
        summary: "Local Arena seeded bot content before connected expansion.",
        severity: "info",
        created_at: 1,
      },
    ],
    standings: [
      {
        rank: 1,
        label: "Mica Builder",
        score: 78,
        summary: "Tiny Proof Deck - hold",
      },
    ],
    official_season: {
      id: "season-zero-official",
      title: "Season Zero - Foundry Dawn",
      status: "local_official_preview",
      summary:
        "Official Season Zero truth is locally owned until connected sync attaches. Build a small useful thing, explain the work, respect blocks, and leave proof behind.",
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
        {
          id: "play-tonight",
          title: "Play Tonight",
          summary: "Low-friction playable events and replayable runs.",
        },
        {
          id: "co-build",
          title: "Co-Build",
          summary: "Collaborative contributions with visible credit.",
        },
      ],
      updated_at: 1,
    },
    official_events: [
      {
        id: "season-zero-weekly-build",
        title: "Season Zero Weekly Build",
        prompt:
          "Build a small useful thing, explain the work, respect blocks, and leave proof behind.",
        status: "live",
        category: "official_weekly_build",
        division: "local_proving_ground",
        cadence: "weekly",
        scoring_rule: "proof, usefulness, recovery, and truthful limits",
        reward_title: "Season Zero proof mark",
        spotlight_label: "Official local preview",
        ranking_authority: "official_boss_judging",
      },
    ],
    official_rankings: [
      {
        rank: 1,
        label: "Mica Builder",
        score: 78,
        rank_class: "Silver",
        seasonal_title: "Foundry Dawn Leader",
        division: "Local proving ground",
        summary: "Official ranking from judged local Arena artifacts: Tiny Proof Deck - hold",
        trend: "leading",
      },
    ],
    official_hall_of_fame: [],
    latest_measurement: null,
    measurement_history: [],
    learning_bridge: {
      ready: false,
      summary:
        "Learning bridge cold. Run a local BOSS proving round to connect Arena outcomes to BIOS learning.",
      repeated_run_count: 0,
      average_score: 0,
      latest_score_delta: 0,
      blocked_trend: "cold",
      worker_governance_summary:
        "No BOSS proving round has produced worker-governance history yet.",
      reflex_candidate:
        "Run a local BOSS proving round to produce a reusable reflex candidate.",
      next_actions: ["Run a local BOSS proving round to start the learning bridge."],
    },
    updated_at: 1,
  };
  function forgeRankClass(score) {
    if (score >= 118) return "Mythic";
    if (score >= 108) return "Diamond";
    if (score >= 98) return "Platinum";
    if (score >= 88) return "Gold";
    if (score >= 78) return "Silver";
    return "Rookie";
  }
  function buildForgeGovernance(state) {
    const signals = Array.isArray(state.signals) ? state.signals : [];
    const standings = Array.isArray(state.standings) ? state.standings : [];
    const learningBridge = state.learning_bridge || {};
    const leaderBonus = Math.min(18, standings.length * 3);
    const learningBonus = learningBridge.ready ? 6 : 0;
    const reviewPenalty = learningBridge.blocked_trend === "needs_review" ? 8 : 0;
    const arenaHealthScore = Math.min(96, Math.max(0, 72 + leaderBonus + learningBonus - reviewPenalty));
    const worker_lanes = [
      {
        id: "worker-spark-judge",
        label: "Spark Judge",
        lane: "judging",
        public_role: "Official judging support",
        hidden_scope:
          "Scores proof, usefulness, recovery, and truthful limits before Forgewarden approval.",
        status: "active_local_lane",
      },
      {
        id: "worker-mica-curator",
        label: "Mica Curator",
        lane: "curation",
        public_role: "Arena feed curation",
        hidden_scope:
          "Groups local creations, replay notes, and visible credits without changing official rank.",
        status: "active_local_lane",
      },
      {
        id: "worker-vale-sentinel",
        label: "Vale Sentinel",
        lane: "anti_abuse",
        public_role: "Anti-abuse and safety review",
        hidden_scope:
          "Flags permission gaps, unsafe publishing claims, and bypass attempts before public action.",
        status: "active_local_lane",
      },
      {
        id: "worker-hearth-nudger",
        label: "Hearth Nudger",
        lane: "participation_health",
        public_role: "Participation health",
        hidden_scope:
          "Suggests low-friction return loops and recovery prompts while keeping user agency intact.",
        status: "active_local_lane",
      },
      {
        id: "worker-echo-amplifier",
        label: "Echo Amplifier",
        lane: "media",
        public_role: "Media and spotlight preparation",
        hidden_scope: "Prepares truthful spotlight copy only from accepted proof records.",
        status: "active_local_lane",
      },
      {
        id: "worker-provenance-keeper",
        label: "Provenance Keeper",
        lane: "lineage",
        public_role: "Lineage and proof tracking",
        hidden_scope: "Keeps artifact lineage, proof refs, and replay ownership attached.",
        status: "active_local_lane",
      },
      {
        id: "worker-badge-steward",
        label: "Badge Steward",
        lane: "rewards",
        public_role: "Rewards and badge stewardship",
        hidden_scope:
          "Prepares local reward marks without granting connected rewards before sync proof exists.",
        status: "active_local_lane",
      },
      {
        id: "worker-prompt-smith",
        label: "Prompt Smith",
        lane: "event_design",
        public_role: "Event design support",
        hidden_scope:
          "Drafts weekly, co-build, replay, and surprise-event prompts for Forgewarden approval.",
        status: "active_local_lane",
      },
    ];
    const laneForSignal = (kind) => {
      if (kind === "arena.boss_round_judged") return "judging";
      if (kind === "arena.learning_bridge_updated") return "participation_health";
      if (kind === "arena.local_participation_recorded") return "curation";
      if (kind === "arena.seeded") return "event_design";
      return "lineage";
    };
    return {
      arena_boss_id: "arena-boss-forgewarden",
      arena_boss_label: "Forgewarden",
      public_summary:
        "Forgewarden governs official Arena judging, curation, safety, nudging, media, lineage, and rewards through bounded specialist lanes.",
      internal_summary:
        "Specialist workers are hidden operational lanes; public BOSS actions and internal worker actions stay separated.",
      governance_status: "local_governance_preview",
      arena_health_score: arenaHealthScore,
      surprise_event_policy:
        "Surprise events require Forgewarden approval, explicit proof records, and must not override official seasonal ranking.",
      worker_lanes,
      records: [
        {
          id: "governance-seeded-" + (state.updated_at || 1),
          kind: "governance.seeded",
          summary: "Forgewarden initialized local governance lanes for Season Zero.",
          public_visible: true,
          worker_lane: "event_design",
          created_at: state.updated_at || 1,
        },
        ...signals.slice(0, 8).map((signal) => ({
          id: "governance-" + signal.id,
          kind: "worker_audit",
          summary: (signal.summary || "Arena signal") + " routed through " + laneForSignal(signal.kind) + ".",
          public_visible: signal.kind !== "arena.learning_bridge_updated",
          worker_lane: laneForSignal(signal.kind),
          created_at: signal.created_at || state.updated_at || 1,
        })),
      ],
      updated_at: state.updated_at || 1,
    };
  }
  function buildForgeCommunityResponse(state, officialRankings) {
    const artifacts = Array.isArray(state.artifacts) ? state.artifacts : [];
    const humanSignalCount = Math.max(
      1,
      artifacts.filter((artifact) =>
        ["publish_local", "co_build", "replay"].includes(String(artifact.kind || "")),
      ).length,
    );
    const agentSignalCount = Math.max(
      1,
      artifacts.filter(
        (artifact) =>
          String(artifact.owner_id || "").startsWith("bot-") ||
          String(artifact.kind || "") === "boss_proving_run",
      ).length,
    );
    const firstOwner = artifacts[0]?.owner_label || "";
    const anomalyStatus =
      artifacts.filter((artifact) => artifact.owner_label === firstOwner).length > 5
        ? "review_required"
        : "clear";
    const tagsForArtifact = (artifact) => {
      const tags = ["proof", "replay_value"];
      const kind = String(artifact.kind || "");
      if (kind === "boss_proving_run") tags.push("boss_run");
      else if (kind === "publish_local") tags.push("creation");
      else if (kind === "co_build") tags.push("co_build");
      else if (kind === "replay") tags.push("replay");
      else if (kind === "seed_safety") tags.push("safety_pattern");
      else tags.push("local_artifact");
      if (artifact.verdict === "promote" || Number(artifact.score || 0) >= 100) {
        tags.push("spotlight_candidate");
      }
      if (Array.isArray(artifact.blocked_capabilities) && artifact.blocked_capabilities.length) {
        tags.push("truthful_limits");
      }
      return tags;
    };
    const nominations = artifacts.slice(0, 6).map((artifact) => ({
      id: "nomination-" + artifact.id,
      artifact_id: artifact.id,
      artifact_title: artifact.title,
      tags: tagsForArtifact(artifact),
      reasoning:
        (artifact.summary || "Local Arena artifact") +
        " Community response can lift visibility, but official rank remains owned by official_boss_judging.",
      lane: String(artifact.owner_id || "").startsWith("bot-") ? "agent_vote" : "human_vote",
      status:
        artifact.verdict === "promote" || Number(artifact.score || 0) >= 100
          ? "spotlight_review"
          : "nominated",
      created_at: artifact.created_at || state.updated_at || 1,
    }));
    const spotlight_candidates = artifacts
      .filter((artifact) => artifact.verdict === "promote" || Number(artifact.score || 0) >= 90)
      .slice(0, 4)
      .map((artifact) => ({
        id: "spotlight-" + artifact.id,
        artifact_id: artifact.id,
        title: artifact.title,
        candidate_type:
          artifact.kind === "boss_proving_run"
            ? "run"
            : artifact.kind === "publish_local"
              ? "creation"
              : artifact.kind === "co_build"
                ? "co_build"
                : artifact.kind === "replay"
                  ? "replay"
                  : "local_artifact",
        status: anomalyStatus === "review_required" ? "quarantined_for_review" : "forgewarden_review",
        side_award:
          Array.isArray(artifact.blocked_capabilities) && artifact.blocked_capabilities.length
            ? "Truthful Limits"
            : "Crowd Spark",
        visibility_boost: "local_spotlight_queue",
        modest_bonus: "non_ranking_bonus",
        official_rank_boundary:
          "Community response does not override official_boss_judging or official rankings.",
        summary:
          (artifact.title || "Local artifact") +
          " is eligible for spotlight review from community response without changing official rank.",
        created_at: artifact.created_at || state.updated_at || 1,
      }));
    const leader = officialRankings?.[0]?.label
      ? " Current official leader remains " + officialRankings[0].label + "."
      : "";
    return {
      status: "local_community_response_preview",
      summary:
        "Community response is active locally with human and agent vote lanes, structured nominations, side awards, and spotlight review." +
        leader,
      official_rank_boundary:
        "Community voting creates visibility, side awards, modest bonuses, and spotlight candidates; it does not override official_boss_judging or official rankings.",
      anomaly_review_policy:
        "Identity-bound votes are lane-checked, trust-weighted, and suspicious clusters are quarantined for Forgewarden review.",
      human_vote_lane: {
        lane: "human_vote",
        label: "Human Vote Lane",
        eligible_identity_scope: "connected_or_local_profile_identity",
        weight: 1,
        signal_count: humanSignalCount,
        trust_summary:
          "Human response measures fun, replay value, delight, usefulness, and spotlight energy.",
        anomaly_status: anomalyStatus,
      },
      agent_vote_lane: {
        lane: "agent_vote",
        label: "Agent Vote Lane",
        eligible_identity_scope: "registered_agent_or_seed_bot_identity",
        weight: 0.6,
        signal_count: agentSignalCount,
        trust_summary:
          "Agent response can nominate useful patterns and safety signals but is weighted below human response.",
        anomaly_status: anomalyStatus,
      },
      nomination_tags: [
        "proof",
        "replay_value",
        "delight",
        "usefulness",
        "truthful_limits",
        "spotlight_candidate",
        "co_build",
        "safety_pattern",
      ],
      nominations,
      spotlight_candidates,
      side_award_summary:
        "Side awards are recognition surfaces only and cannot reorder official standings.",
      visibility_boost_summary:
        "Visibility boosts place artifacts into local spotlight review without claiming public backend sync.",
      modest_bonus_summary:
        "Modest community bonuses are non-ranking bonuses until connected public reward rules exist.",
      updated_at: state.updated_at || 1,
    };
  }
  function buildForgeStudyLineage(state) {
    const artifacts = Array.isArray(state.artifacts) ? [...state.artifacts] : [];
    artifacts.sort(
      (left, right) =>
        Number(right.score || 0) - Number(left.score || 0) ||
        Number(right.created_at || 0) - Number(left.created_at || 0),
    );
    const learnablePattern = (artifact) => {
      if (Array.isArray(artifact.blocked_capabilities) && artifact.blocked_capabilities.length) {
        return "truthful_blocked_capability_handling";
      }
      if (artifact.kind === "co_build") return "co_build_attribution";
      if (artifact.kind === "replay") return "replayable_result_summary";
      if (artifact.verdict === "promote" || Number(artifact.score || 0) >= 100) {
        return "high_signal_proof_pattern";
      }
      return "local_build_pattern";
    };
    const lineageKind = (artifact) => {
      if (artifact.kind === "co_build") return "co_build_lineage";
      if (artifact.kind === "replay") return "replay_lineage";
      if (artifact.kind === "publish_local") return "published_local_lineage";
      if (artifact.kind === "boss_proving_run") return "boss_proving_lineage";
      if (String(artifact.kind || "").startsWith("seed_")) return "seed_pattern_lineage";
      return "local_artifact_lineage";
    };
    const study_queue = artifacts.slice(0, 6).map((artifact) => ({
      id: "study-lineage-" + artifact.id,
      artifact_id: artifact.id,
      title: artifact.title,
      source_owner_label: artifact.owner_label,
      lineage_kind: lineageKind(artifact),
      study_status:
        artifact.verdict === "promote" || Number(artifact.score || 0) >= 90
          ? "study_ready"
          : "watchlist",
      permission_boundary:
        "Study can teach BIOS AI patterns, but remix or reuse requires source consent and a new proof record.",
      authorship_boundary:
        "authorship_preserved: studying an artifact does not transfer ownership, private truth, or official rank.",
      learnable_pattern: learnablePattern(artifact),
      remix_policy: "remix_requires_consent; derived work must keep lineage and proof refs attached.",
      proof_refs: Array.isArray(artifact.proof_refs) ? artifact.proof_refs : [],
      created_at: artifact.created_at || state.updated_at || 1,
    }));
    const learnable_patterns = [...new Set(study_queue.map((entry) => entry.learnable_pattern))].sort();
    return {
      status: "local_study_lineage_preview",
      summary:
        "Study lineage is active locally: strong Arena artifacts can teach reusable patterns while authorship, consent, proof refs, and official rank remain protected.",
      lineage_boundary:
        "study_not_authority: lineage helps BIOS AI learn from artifacts but cannot override official_boss_judging, community response, or source authorship.",
      remix_permission_policy:
        "remix_requires_consent and every derived artifact must keep source lineage and proof refs.",
      study_queue,
      learnable_patterns,
      updated_at: state.updated_at || 1,
    };
  }
  function refreshForgeOfficialTruth(state) {
    const standings = Array.isArray(state.standings) ? state.standings : [];
    const leader = standings[0];
    const officialRankings = standings.map((standing) => ({
      rank: standing.rank,
      label: standing.label,
      score: standing.score,
      rank_class: forgeRankClass(Number(standing.score || 0)),
      seasonal_title: standing.rank === 1 ? "Foundry Dawn Leader" : "Season Zero Entrant",
      division: "Local proving ground",
      summary: "Official ranking from judged local Arena artifacts: " + (standing.summary || ""),
      trend: standing.rank === 1 ? "leading" : "steady",
    }));
    const officialHall = (Array.isArray(state.artifacts) ? state.artifacts : [])
      .filter((artifact) => artifact.verdict === "promote" || Number(artifact.score || 0) >= 90)
      .slice(0, 4)
      .map((artifact) => ({
        id: "hof-" + artifact.id,
        title: artifact.title,
        kind: "official_moment",
        season_label: "Season Zero - Foundry Dawn",
        honor: Number(artifact.score || 0) >= 100 ? "Official standout" : "Official proof mark",
        summary:
          (artifact.judge_summary || artifact.summary || "Official Arena result recorded.") +
          " Ranked by proof, usefulness, recovery, and truthful limits.",
        recorded_at: artifact.created_at || state.updated_at || 0,
      }));
    return {
      ...state,
      official_season: {
        ...state.official_season,
        summary:
          "Official Season Zero truth is locally owned until connected sync attaches. " +
          (state.event?.prompt ||
            "Build a small useful thing, explain the work, respect blocks, and leave proof behind.") +
          (leader ? " Current leader: " + leader.label + " with " + leader.score + " points." : ""),
        updated_at: state.updated_at || 1,
      },
      official_rankings: officialRankings,
      official_hall_of_fame: officialHall,
      governance: buildForgeGovernance(state),
      community_response: buildForgeCommunityResponse(state, officialRankings),
      study_lineage: buildForgeStudyLineage(state),
    };
  }
  forgeArenaLocalState = refreshForgeOfficialTruth(forgeArenaLocalState);
  let biosMemorySurfaceState = {
    total_events: 4,
    standing_orders: [{ id: "order-1", summary: "Always explain guarded identity changes before approval." }],
    user_preferences: [{ id: "pref-1", summary: "Keep core identity deliberate and reviewable." }],
    mission_facts: [{ id: "fact-1", summary: "BOSS grows through governed memory and soul revisions." }],
    relationship_notes: [],
    identity_notes: [],
    skill_candidates: [],
    pending_approval_changes: [],
    promotion_queue: [],
    live_learning_count: 3,
    live_learning_summary:
      "3 live learning item(s) are usable now; 0 item(s) are queued for dream consolidation into durable memory.",
    latest_live_learning: "BOSS grows through governed memory and soul revisions.",
    immediate_learning_ready: true,
    recent_events: [],
    consolidated_memory: [
      {
        id: "durable-1",
        summary: "Claw is building toward a governed local-first BOSS runtime.",
        detail: "Durable BIOS memory should stay profile-owned and reviewable.",
        lane: "durable_memory",
      },
    ],
  };
  let biosSoulGovernanceState = {
    pending_changes: [
      {
        id: "soul-change-1",
        summary: "Add direct, calm, practical to Claw's governed helper tone.",
        detail: "BIOS AI wants to update the governed soul guidance after repeated user preference signals.",
        tags: ["identity", "tone", "governed_change"],
        area: "core_identity",
        target_section: "Core Identity",
        approval_tier: "kernel_locked",
        approval_reason:
          "Core identity changes alter who the BOSS is, so BIOS must explain the change and wait for explicit operator approval.",
        requires_explanation: true,
        source: "bios_brainstem",
        created_at: "2026-06-13T10:00:00Z",
        status: "pending",
      },
    ],
    recent_revisions: [],
    revision_log_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/revisions/soul.jsonl",
    soul_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/SOUL.md",
    user_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/USER.md",
    identity_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/IDENTITY.md",
    last_revision_at: null,
    summary:
      "One guarded soul change is waiting for review before BIOS AI mutates core identity truth.",
  };
  let biosNervousSystemContractState = {
    total_signals: 4,
    dominant_source: "connector",
    dominant_signal: "approval.requested",
    dominant_state: "idle",
    coordination_state: "needs_attention",
    attention_signal_count: 1,
    recovery_signal_count: 0,
    validation_signal_count: 1,
    promotion_signal_count: 1,
    latest_source: "connector",
    latest_signal: "approval.requested",
    latest_detail: "Waiting for operator approval before Telegram delivery.",
    latest_priority: "high",
    last_signal_at: "2026-06-13T12:00:00Z",
    summary:
      "Nervous system needs attention: 1 attention signal is active. Latest: approval.requested from connector.",
  };
  const enrichMockOrganContract = (organ) => {
    const restartable = !String(organ.restart_policy || "").startsWith("manual_");
    const boundaryByKind = {
      native_supervised: "native_supervised_module",
      managed_process: "managed_process",
      body_worker: "body_worker",
      boxed_lane: "boxed_lane",
    };
    const responsibilityById = {
      brainstem: "Keep route, recovery, approval pauses, and sleep timing aligned.",
      nervous_system: "Aggregate BIOS body signals and coordinate attention/recovery truth.",
      memory_dream:
        "Keep live memory, durable memory, dream consolidation, and learned context coherent.",
      local_model_worker_controller:
        "Own local worker process readiness and selected BOSS brain runtime health.",
      virtual_desktop_body:
        "Provide the private work surface so BIOS can act without ghosting the user desktop.",
      sandbox_validator:
        "Validate untrusted work and promotion candidates inside the boxed lane before host adoption.",
    };
    const contractById = {
      brainstem: "load_bios_brainstem_state/run_bios_brainstem_tick",
      nervous_system: "load_bios_nervous_system_state/record_bios_nervous_system_event",
      memory_dream: "load_bios_memory_surface/record_bios_memory_event/run_bios_dream_cycle",
      local_model_worker_controller: "bios_runtime_status/chat_with_local_worker/probe_local_runtime",
      virtual_desktop_body: "load_bios_observation_state/update_bios_observation_state",
      sandbox_validator: "load_bios_sandbox_state/resolve_bios_sandbox_promotion",
    };
    const strategyById = {
      brainstem: "Rehydrate brainstem state and rerun the tick loop.",
      nervous_system: "Rehydrate the signal ledger and resume coordination.",
      memory_dream: "Rehydrate profile memory and resume consolidation without restarting the shell.",
      local_model_worker_controller: "Restart or re-probe the managed local model worker process.",
      virtual_desktop_body: "Restart the private body worker and refresh observation state.",
      sandbox_validator: "Provision the boxed substrate before supervisor restarts can apply.",
    };
    let recoveryActionLabel = "Manual setup required before " + organ.label + " can run";
    if (restartable) {
      recoveryActionLabel = "Restart " + organ.label + " without restarting BIOS AI";
    }
    return {
      ...organ,
      responsibility: responsibilityById[organ.id] || "Report BIOS organ health.",
      contract_surface: contractById[organ.id] || "load_bios_organ_supervisor_state",
      isolation_boundary: boundaryByKind[organ.kind] || "native_supervised_module",
      heartbeat_status:
        organ.health === "healthy" ? "fresh" : organ.health === "blocked" ? "manual_blocked" : organ.health,
      restartable,
      restart_strategy: strategyById[organ.id] || "Restart under supervisor control.",
      last_health_check_at: organ.last_health_check_at || organ.last_heartbeat_at,
      recovery_action_label: recoveryActionLabel,
    };
  };
  let biosOrganSupervisorState = {
    profile_id: "claw",
    state: "partially_blocked",
    supervisor_mode: "native_restart_controller",
    summary:
      "Five supervised organs are healthy; one organ is blocked by substrate setup. 5 organ(s) can restart without restarting BIOS AI.",
    organ_count: 6,
    healthy_count: 5,
    recovering_count: 0,
    blocked_count: 1,
    needs_attention_count: 0,
    restartable_count: 5,
    manual_count: 1,
    stale_count: 0,
    process_isolation_count: 3,
    restart_count: 0,
    last_event: null,
    last_event_at: null,
    latest_recovery_action: "Manual setup required before Sandbox Validator can run",
    organs: [
      {
        id: "brainstem",
        label: "Brainstem",
        kind: "native_supervised",
        health: "healthy",
        restart_policy: "restart_on_failure",
        restart_count: 0,
        last_started_at: "2026-06-13T12:00:00Z",
        last_heartbeat_at: "2026-06-13T12:00:00Z",
        last_restarted_at: null,
        last_error: null,
        log_lane: "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/organs/brainstem.jsonl",
        summary: "Brainstem is holding route, approval pauses, and recovery timing steady.",
      },
      {
        id: "nervous_system",
        label: "Nervous System",
        kind: "native_supervised",
        health: "healthy",
        restart_policy: "restart_on_failure",
        restart_count: 0,
        last_started_at: "2026-06-13T12:00:00Z",
        last_heartbeat_at: "2026-06-13T12:00:00Z",
        last_restarted_at: null,
        last_error: null,
        log_lane:
          "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/organs/nervous_system.jsonl",
        summary: "Nervous system is tracking 4 signal(s).",
      },
      {
        id: "memory_dream",
        label: "Memory And Dreaming",
        kind: "native_supervised",
        health: "healthy",
        restart_policy: "restart_on_failure",
        restart_count: 0,
        last_started_at: "2026-06-13T12:00:00Z",
        last_heartbeat_at: "2026-06-13T12:00:00Z",
        last_restarted_at: null,
        last_error: null,
        log_lane: "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/organs/memory_dream.jsonl",
        summary: "Memory organism has 4 event(s) and 1 durable memory item.",
      },
      {
        id: "local_model_worker_controller",
        label: "Local Model Worker Controller",
        kind: "managed_process",
        health: "healthy",
        restart_policy: "restart_managed_process_on_failure",
        restart_count: 0,
        last_started_at: "2026-06-13T12:00:00Z",
        last_heartbeat_at: "2026-06-13T12:00:00Z",
        last_restarted_at: null,
        last_error: null,
        log_lane:
          "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/organs/local_model_worker_controller.jsonl",
        summary: "Managed worker ready",
      },
      {
        id: "virtual_desktop_body",
        label: "Virtual Desktop Body",
        kind: "body_worker",
        health: "healthy",
        restart_policy: "restart_body_worker_on_failure",
        restart_count: 0,
        last_started_at: "2026-06-13T12:00:00Z",
        last_heartbeat_at: "2026-06-13T12:00:00Z",
        last_restarted_at: null,
        last_error: null,
        log_lane:
          "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/organs/virtual_desktop_body.jsonl",
        summary: "The private desktop body is ready and not touching the user surface.",
      },
      {
        id: "sandbox_validator",
        label: "Sandbox Validator",
        kind: "boxed_lane",
        health: "blocked",
        restart_policy: "manual_until_boxed_substrate_ready",
        restart_count: 0,
        last_started_at: "2026-06-13T12:00:00Z",
        last_heartbeat_at: "2026-06-13T12:00:00Z",
        last_restarted_at: null,
        last_error: null,
        log_lane:
          "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/organs/sandbox_validator.jsonl",
        summary:
          "Windows boxed lane is available; BIOS-managed Linux substrate still needs provisioning.",
      },
    ],
  };
  biosOrganSupervisorState = {
    ...biosOrganSupervisorState,
    organs: biosOrganSupervisorState.organs.map(enrichMockOrganContract),
  };
  let biosTruthSpineState = {
    ready: true,
    profile_id: "claw",
    record_count: 5,
    latest_record_id: "truth-20260613-120000-abc12345",
    latest_record_at: "2026-06-13T12:00:00Z",
    records_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/runtime/truth-spine/records.jsonl",
    governance_state: "clear",
    summary:
      "BOSS operating truth is folded from memory, proof, body, sandbox, and nervous-system inputs.",
    tiny_pack: {
      profile_id: "claw",
      readiness: "ready",
      record_count: 5,
      latest_record_id: "truth-20260613-120000-abc12345",
      compact_summary:
        "BOSS operating truth is folded from memory, proof, body, sandbox, and nervous-system inputs.",
      active_decisions: [
        "Use the BIOS-managed local worker for local-only chat until the operator changes routing.",
      ],
      dead_ends: ["Do not promote host writes until boxed proof is available."],
      next_actions: ["Keep the route steady and collect boxed proof before promotion."],
      brainstorm: ["C? Consider detached truth import only after native runtime proof."],
      proof_refs: ["proof:runtime-ready", "proof:memory-surface"],
      body_inputs: ["memory", "proof_spine", "nervous_system", "sandbox", "observation"],
      warnings: [],
    },
    standard_pack: {
      profile_id: "claw",
      readiness: "ready",
      record_count: 5,
      latest_record_id: "truth-20260613-120000-abc12345",
      compact_summary:
        "BOSS operating truth is folded from memory, proof, body, sandbox, and nervous-system inputs.",
      active_decisions: [
        "Use the BIOS-managed local worker for local-only chat until the operator changes routing.",
      ],
      dead_ends: ["Do not promote host writes until boxed proof is available."],
      next_actions: ["Keep the route steady and collect boxed proof before promotion."],
      brainstorm: ["C? Consider detached truth import only after native runtime proof."],
      proof_refs: ["proof:runtime-ready", "proof:memory-surface"],
      body_inputs: ["memory", "proof_spine", "nervous_system", "sandbox", "observation"],
      warnings: [],
      recent_records: [],
    },
    stale_action_count: 0,
    latest_usage: null,
  };
  const discoveryByScenario = {
    "onboarding-discovery": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-4-4b-it-q4", source: "ollama" }],
      ssh_key_types: ["ed25519"],
      ai_tools: [{ tool: "Cursor", config_path: "C:/Users/test/.cursor" }],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "onboarding-model": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "onboarding-model-import-fail": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "onboarding-hybrid-managed": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "onboarding-lmstudio": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "lmstudio-local-model", source: "lmstudio" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "onboarding-ollama": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "qwen3:8b", source: "ollama" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "legacy-ready-without-profile": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "worker-small-machine": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 8, total_memory_gb: 8 },
      scan_duration_ms: 123,
    },
    "status-surface": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-4-4b-it-q4", source: "ollama" }],
      ssh_key_types: ["ed25519"],
      ai_tools: [{ tool: "Cursor", config_path: "C:/Users/test/.cursor" }],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "settings-surface": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-4-4b-it-q4", source: "ollama" }],
      ssh_key_types: ["ed25519"],
      ai_tools: [{ tool: "Cursor", config_path: "C:/Users/test/.cursor" }],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "delete-last-profile": {
      api_keys: [{ key_id: "disc-openai-1", provider: "openai", env_var: "OPENAI_API_KEY", source: "env", masked_value: "sk-t...cdef" }],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-4-4b-it-q4", source: "ollama" }],
      ssh_key_types: ["ed25519"],
      ai_tools: [{ tool: "Cursor", config_path: "C:/Users/test/.cursor" }],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "forge-profile": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-3-1b-it-q4", source: "bios-managed" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "profiles-no-active": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-3-1b-it-q4", source: "bios-managed" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "profile-isolation": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-3-1b-it-q4", source: "bios-managed" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "profile-lifecycle": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-3-1b-it-q4", source: "bios-managed" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
    "soul-governance": {
      api_keys: [],
      git_identity: { name: "Nick Example", email: "nick@example.com" },
      local_models: [{ model_id: "gemma-3-1b-it-q4", source: "bios-managed" }],
      ssh_key_types: [],
      ai_tools: [],
      agent_identity: null,
      machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
      scan_duration_ms: 123,
    },
  };
  const managedModelFileByVariant = {
    "gemma-3-1b": {
      variant: "gemma-3-1b",
      model_id: "gemma-3-1b-it",
      file_name: "gemma-3-1b-it-Q4_K_M.gguf",
      path: "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf",
      size_bytes: 806058240,
    },
    "gemma-3-4b": {
      variant: "gemma-3-4b",
      model_id: "gemma-3-4b-it",
      file_name: "gemma-3-4b-it-Q4_K_M.gguf",
      path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
      size_bytes: 3221225472,
    },
    "qwen-3-8b": {
      variant: "qwen-3-8b",
      model_id: "qwen3-8b-instruct",
      file_name: "qwen-3-8b-instruct-Q4_K_M.gguf",
      path: "C:/Users/test/.bios-ai/models/qwen-3-8b-instruct-Q4_K_M.gguf",
      size_bytes: 5583457484,
    },
  };
  function managedModelFileForVariant(variant) {
    return managedModelFileByVariant[variant] || managedModelFileByVariant["gemma-3-1b"];
  }
  const discovery = discoveryByScenario[scenario] || discoveryByScenario["onboarding-discovery"];
  if (!profileScenarios.has(scenario)) {
    localStorage.clear();
    if (scenario === "legacy-ready-without-profile") {
      localStorage.setItem(
        "bios-ai-onboarding",
        JSON.stringify({
          completed: true,
          agentName: "Legacy Claw",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerDownloadStatus: "completed",
          localWorkerModelVariant: "qwen-3-8b",
        }),
      );
    }
  } else {
    if (scenario === "stale-saved-route-bypass") {
      localStorage.setItem("bios-ai-active-profile", "claw");
      localStorage.setItem(
        "bios-ai-onboarding:claw",
        JSON.stringify({
          completed: true,
          agentName: "Claw",
          modelPref: "local",
          preferredLocalBackend: "lmstudio",
          localWorkerDownloadStatus: "completed",
          localWorkerModelVariant: "qwen-3-8b",
        }),
      );
    }
    if (scenario !== "resume-runtime-setup") {
      try {
        const persistedBiosProfile = localStorage.getItem(biosAuditProfileStorageKey);
        if (persistedBiosProfile) {
          const parsed = JSON.parse(persistedBiosProfile);
          if (parsed?.profile && parsed?.onboarding) {
            biosProfileDetail.profile = parsed.profile;
            biosProfileDetail.onboarding = parsed.onboarding;
          }
        }
      } catch {}
    }
    try {
      const persistedProviderConfig = localStorage.getItem(biosAuditProviderStorageKey);
      if (persistedProviderConfig) {
        const parsed = JSON.parse(persistedProviderConfig);
        if (parsed && typeof parsed === "object") {
          providerConfigState = {
            ...providerConfigState,
            ...parsed,
          };
        }
      }
    } catch {}
    try {
      const persistedConnectorConfig = localStorage.getItem(biosAuditConnectorStorageKey);
      if (persistedConnectorConfig) {
        const parsed = JSON.parse(persistedConnectorConfig);
        if (parsed && typeof parsed === "object") {
          connectorStatusState = {
            ...connectorStatusState,
            ...parsed,
          };
        }
      }
    } catch {}
    try {
      const persistedForgeProfile = localStorage.getItem(forgeAuditStorageKey);
      if (persistedForgeProfile) {
        forgeArenaProfileState = JSON.parse(persistedForgeProfile);
      }
    } catch {}
    if (multiProfileLifecycleScenario) {
      if (scenario === "profile-lifecycle") {
        localStorage.removeItem(biosAuditProfileIsolationStorageKey);
        localStorage.removeItem(biosAuditProviderIsolationStorageKey);
        localStorage.removeItem(biosAuditConnectorIsolationStorageKey);
      }
      try {
        const persistedIsolationProfiles = localStorage.getItem(
          biosAuditProfileIsolationStorageKey,
        );
        if (persistedIsolationProfiles) {
          const parsed = JSON.parse(persistedIsolationProfiles);
          if (parsed && typeof parsed === "object") {
            if (parsed.claw?.profile && parsed.claw?.onboarding) {
              profileIsolationDetails.claw = parsed.claw;
            }
            if (parsed.ember?.profile && parsed.ember?.onboarding) {
              profileIsolationDetails.ember = parsed.ember;
            }
          }
        }
      } catch {}
      biosProfilesState = [
        { ...profileIsolationDetails.claw.profile },
        { ...profileIsolationDetails.ember.profile },
      ];
      try {
        const persistedIsolationProviders = localStorage.getItem(
          biosAuditProviderIsolationStorageKey,
        );
        if (persistedIsolationProviders) {
          const parsed = JSON.parse(persistedIsolationProviders);
          if (parsed && typeof parsed === "object") {
            if (parsed.claw) {
              profileIsolationProviderConfigs.claw = {
                ...profileIsolationProviderConfigs.claw,
                ...parsed.claw,
              };
            }
            if (parsed.ember) {
              profileIsolationProviderConfigs.ember = {
                ...profileIsolationProviderConfigs.ember,
                ...parsed.ember,
              };
            }
          }
        }
      } catch {}
      try {
        const persistedIsolationConnectors = localStorage.getItem(
          biosAuditConnectorIsolationStorageKey,
        );
        if (persistedIsolationConnectors) {
          const parsed = JSON.parse(persistedIsolationConnectors);
          if (parsed && typeof parsed === "object") {
            if (parsed.claw) {
              profileIsolationConnectorStatus.claw = parsed.claw;
            }
            if (parsed.ember) {
              profileIsolationConnectorStatus.ember = parsed.ember;
            }
          }
        }
      } catch {}
    }
  }
  window.__TAURI__ = {
    core: {
      invoke: async (command, payload) => {
        if (multiProfileLifecycleScenario) {
          const activeIsolationProfileId = activeBiosProfileIdState || "claw";
          const persistIsolationProfiles = () => {
            try {
              localStorage.setItem(
                biosAuditProfileIsolationStorageKey,
                JSON.stringify(profileIsolationDetails),
              );
            } catch {}
          };
          const persistIsolationProviders = () => {
            try {
              localStorage.setItem(
                biosAuditProviderIsolationStorageKey,
                JSON.stringify(profileIsolationProviderConfigs),
              );
            } catch {}
          };
          const persistIsolationConnectors = () => {
            try {
              localStorage.setItem(
                biosAuditConnectorIsolationStorageKey,
                JSON.stringify(profileIsolationConnectorStatus),
              );
            } catch {}
          };
          const currentIsolationProfileId = payload?.profileId || activeIsolationProfileId;
          const currentIsolationDetail =
            profileIsolationDetails[currentIsolationProfileId] || profileIsolationDetails.claw;
          if (command === "load_bios_profile") {
            return currentIsolationDetail;
          }
          if (command === "load_provider_config") {
            return (
              profileIsolationProviderConfigs[currentIsolationProfileId] ||
              profileIsolationProviderConfigs.claw
            );
          }
          if (command === "save_provider_config") {
            const currentConfig =
              profileIsolationProviderConfigs[currentIsolationProfileId] ||
              profileIsolationProviderConfigs.claw;
            const nextConfig = payload?.config || {};
            profileIsolationProviderConfigs[currentIsolationProfileId] = {
              ...currentConfig,
              ...nextConfig,
              keys: Array.isArray(nextConfig.keys) ? nextConfig.keys : currentConfig.keys,
            };
            persistIsolationProviders();
            return null;
          }
          if (command === "load_bios_local_connector_status") {
            return (
              profileIsolationConnectorStatus[currentIsolationProfileId] ||
              profileIsolationConnectorStatus.claw
            );
          }
          if (command === "bios_local_tool_registry") {
            return biosLocalToolRegistryState;
          }
          if (command === "load_bios_truth_spine_state") {
            return biosTruthSpineState;
          }
          if (command === "record_bios_truth_event") {
            const input = payload?.input || {};
            const nextCount = (biosTruthSpineState.record_count || 0) + 1;
            const summary =
              input.summary || "BOSS operating truth recorded this profile-scoped local event.";
            biosTruthSpineState = {
              ...biosTruthSpineState,
              record_count: nextCount,
              latest_record_id: "truth-smoke-" + nextCount,
              latest_record_at: "2026-06-13T12:02:00Z",
              summary,
              tiny_pack: {
                ...biosTruthSpineState.tiny_pack,
                record_count: nextCount,
                latest_record_id: "truth-smoke-" + nextCount,
                compact_summary: summary,
              },
              standard_pack: {
                ...biosTruthSpineState.standard_pack,
                record_count: nextCount,
                latest_record_id: "truth-smoke-" + nextCount,
                compact_summary: summary,
              },
            };
            return biosTruthSpineState;
          }
          if (command === "record_bios_truth_session_update") {
            const input = payload?.input || {};
            const nextCount =
              (biosTruthSpineState.record_count || 0) + (Array.isArray(input.events) ? input.events.length : 0);
            const accepted = (input.events || []).find((event) =>
              ["decision_accept", "done", "proof"].includes(String(event?.type || "")),
            );
            const candidateSummaries = (input.events || [])
              .filter((event) => ["candidate", "question", "explore"].includes(String(event?.type || "")))
              .map(
                (event) =>
                  (String(event.type || "candidate") === "question" ? "Q?" : "C?") +
                  " " +
                  event.summary,
              )
              .filter(Boolean);
            const summary =
              accepted?.summary || "BOSS operating truth recorded this session update.";
            const latestUsage = input.usage?.baseline_tokens && input.usage?.truthspine_context_tokens
              ? {
                  context_profile: input.usage.context_profile || "tiny",
                  baseline_tokens: input.usage.baseline_tokens,
                  truthspine_context_tokens: input.usage.truthspine_context_tokens,
                  token_savings_percent:
                    Math.round(
                      ((input.usage.baseline_tokens - input.usage.truthspine_context_tokens) /
                        input.usage.baseline_tokens) *
                        10000,
                    ) / 100,
                  savings_confidence: "measured",
                  label: input.usage.label || null,
                  captured_at: "2026-06-13T12:03:00Z",
                }
              : biosTruthSpineState.latest_usage;
            biosTruthSpineState = {
              ...biosTruthSpineState,
              record_count: nextCount,
              latest_record_id: "truth-session-smoke-" + nextCount,
              latest_record_at: "2026-06-13T12:03:00Z",
              latest_usage: latestUsage,
              summary,
              tiny_pack: {
                ...biosTruthSpineState.tiny_pack,
                record_count: nextCount,
                latest_record_id: "truth-session-smoke-" + nextCount,
                compact_summary: summary,
                active_decisions: accepted?.summary
                  ? [accepted.summary, ...(biosTruthSpineState.tiny_pack.active_decisions || [])]
                  : biosTruthSpineState.tiny_pack.active_decisions,
                brainstorm: [
                  ...candidateSummaries,
                  ...(biosTruthSpineState.tiny_pack.brainstorm || []),
                ],
              },
              standard_pack: {
                ...biosTruthSpineState.standard_pack,
                record_count: nextCount,
                latest_record_id: "truth-session-smoke-" + nextCount,
                compact_summary: summary,
                active_decisions: accepted?.summary
                  ? [accepted.summary, ...(biosTruthSpineState.standard_pack.active_decisions || [])]
                  : biosTruthSpineState.standard_pack.active_decisions,
                brainstorm: [
                  ...candidateSummaries,
                  ...(biosTruthSpineState.standard_pack.brainstorm || []),
                ],
              },
            };
            return biosTruthSpineState;
          }
          if (command === "save_bios_local_connector_binding") {
            const input = payload?.input || {};
            const profileId = input.profile_id || currentIsolationProfileId;
            const providerConfig =
              profileIsolationProviderConfigs[profileId] || providerConfigState;
            const enabled = Boolean(input.enabled);
            const targetId = String(input.target_id || "").trim() || null;
            const hasKey = providerConfig.keys.some((key) => key.provider === "telegram");
            const ready = hasKey && enabled && Boolean(targetId);
            profileIsolationConnectorStatus[profileId] = {
              profile_id: profileId,
              connectors: [
                {
                  connector: "telegram",
                  configured: hasKey || enabled || Boolean(targetId),
                  ready,
                  enabled,
                  profile_bound: Boolean(targetId),
                  has_key: hasKey,
                  permission_mode: profileId === "ember" ? "ask_first" : "not_allowed",
                  target_id: targetId,
                  target_summary: targetId
                    ? "Bound to Telegram target " + targetId
                    : "No Telegram target bound yet",
                  allowed_actions: ["send_message"],
                  label: ready
                    ? "Telegram connector ready"
                    : hasKey && enabled
                      ? "Telegram key found, target still missing"
                      : hasKey
                        ? "Telegram key found, connector disabled"
                        : "Telegram connector not configured",
                  detail: ready
                    ? "BIOS AI can use Telegram through this profile-bound connector lane. Permission mode: ask first."
                    : !hasKey
                      ? "BIOS AI cannot use Telegram here until a real Telegram bot token is imported."
                      : !enabled
                        ? "Telegram is configured but disabled for this BOSS profile."
                        : "Telegram still needs a bound target id before BIOS AI can send messages.",
                },
              ],
            };
            persistIsolationConnectors();
            return profileIsolationConnectorStatus[profileId];
          }
          if (command === "invoke_bios_local_connector") {
            const telegram =
              profileIsolationConnectorStatus[currentIsolationProfileId]?.connectors?.[0];
            if (!telegram?.ready) {
              throw new Error(telegram?.detail || "Telegram connector is not ready.");
            }
            return {
              ok: true,
              connector: "telegram",
              action: payload?.input?.action || "send_message",
              state: "completed",
              approval_required: false,
              approval_id: null,
              summary: "Telegram connector delivered the message through BIOS AI.",
              detail: "BIOS AI used the profile-bound Telegram connector lane.",
              data: {
                delivered: true,
                target_id: telegram.target_id,
                text: payload?.input?.arguments?.text || "",
              },
            };
          }
          if (command === "save_bios_profile") {
            const input = payload?.input || {};
            const onboarding = input.onboarding || {};
            const profileId = input.profile_id || activeIsolationProfileId;
            const existing =
              profileIsolationDetails[profileId] || profileIsolationDetails.claw;
            const nextProfile = {
              ...existing.profile,
              display_name: input.display_name || existing.profile.display_name || "Claw",
              completed: Boolean(onboarding.completed ?? existing.profile.completed),
              model_pref: onboarding.model_pref || existing.profile.model_pref,
              preferred_local_backend:
                onboarding.preferred_local_backend ||
                existing.profile.preferred_local_backend,
              local_worker_ready: Boolean(
                onboarding.local_worker_download_status === "completed" ||
                  onboarding.local_worker_download_status === "installed" ||
                  existing.profile.local_worker_ready,
              ),
              updated_at: String(Number(existing.profile.updated_at || "1") + 1),
            };
            profileIsolationDetails[profileId] = {
              profile: nextProfile,
              onboarding: {
                ...existing.onboarding,
                ...onboarding,
              },
            };
            biosProfilesState = [
              { ...profileIsolationDetails.claw.profile },
              { ...profileIsolationDetails.ember.profile },
            ];
            activeBiosProfileIdState = profileId;
            persistIsolationProfiles();
            return profileIsolationDetails[profileId];
          }
          if (command === "set_active_bios_profile") {
            activeBiosProfileIdState = payload?.profileId || "claw";
            return {
              active_profile_id: activeBiosProfileIdState,
              profiles: biosProfilesState,
            };
          }
          if (command === "delete_bios_profile") {
            const profileId = payload?.profileId || null;
            delete profileIsolationDetails[profileId];
            delete profileIsolationProviderConfigs[profileId];
            delete profileIsolationConnectorStatus[profileId];
            biosProfilesState = biosProfilesState.filter((profile) => profile.id !== profileId);
            activeBiosProfileIdState = biosProfilesState[0]?.id || null;
            persistIsolationProfiles();
            persistIsolationProviders();
            persistIsolationConnectors();
            return {
              deleted_profile_id: profileId,
              active_profile_id: activeBiosProfileIdState,
              remaining_profiles: biosProfilesState.length,
            };
          }
          if (command === "save_worker_runtime_selection") {
            const profileId = payload?.profileId || activeIsolationProfileId;
            const detail = profileIsolationDetails[profileId] || profileIsolationDetails.claw;
            const variant = payload?.variant || detail.onboarding.local_worker_model_variant || "gemma-3-1b";
            const path =
              variant === "qwen-3-8b"
                ? "C:/Users/test/.bios-ai/models/qwen-3-8b-instruct-Q4_K_M.gguf"
                : "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf";
            detail.onboarding.local_worker_model_variant = variant;
            detail.onboarding.local_worker_model_path = path;
            detail.onboarding.local_worker_download_status = "installed";
            persistIsolationProfiles();
            return {
              variant,
              model_id: variant === "qwen-3-8b" ? "qwen3-8b-instruct" : "gemma-3-1b-it",
              file_name:
                variant === "qwen-3-8b"
                  ? "qwen-3-8b-instruct-Q4_K_M.gguf"
                  : "gemma-3-1b-it-Q4_K_M.gguf",
              path,
              updated_at: "1710000001",
            };
          }
          if (command === "save_worker_runtime_roster") {
            const profileId = payload?.profileId || activeIsolationProfileId;
            const detail = profileIsolationDetails[profileId] || profileIsolationDetails.claw;
            detail.onboarding.bios_worker_roster = payload?.assignments || [];
            persistIsolationProfiles();
            return detail.onboarding.bios_worker_roster;
          }
          if (command === "register_external_worker_model") {
            const profileId = payload?.profileId || activeIsolationProfileId;
            const detail = profileIsolationDetails[profileId] || profileIsolationDetails.claw;
            const externalPath = String(payload?.path || "").trim();
            detail.onboarding.local_worker_model_variant = "custom-gguf";
            detail.onboarding.local_worker_model_path = externalPath;
            detail.onboarding.local_worker_download_status = "installed";
            persistIsolationProfiles();
            return {
              variant: "custom-gguf",
              model_id: "custom-gguf",
              file_name: externalPath.split(/[\\\\/]/).pop() || "custom.gguf",
              path: externalPath,
              updated_at: "1710000002",
            };
          }
        }
        if (command === "list_bios_profiles") {
          if (profileScenarios.has(scenario) || biosProfilesState.length > 0) {
            return {
              active_profile_id: activeBiosProfileIdState,
              profiles: biosProfilesState,
            };
          }
          return { active_profile_id: null, profiles: [] };
        }
        if (command === "load_bios_profile") {
          if (
            (profileScenarios.has(scenario) || biosProfilesState.length > 0) &&
            biosProfilesState.some((profile) => profile.id === payload?.profileId)
          ) {
            return biosProfileDetail;
          }
          throw new Error("Unexpected Tauri command: " + command);
        }
        if (command === "save_bios_profile") {
          const onboarding = payload?.input?.onboarding || {};
          biosProfileDetail.profile = {
            ...biosProfileDetail.profile,
            display_name:
              payload?.input?.display_name || biosProfileDetail.profile.display_name || "Claw",
            completed: Boolean(onboarding.completed ?? biosProfileDetail.profile.completed),
            model_pref: onboarding.model_pref || biosProfileDetail.profile.model_pref,
            preferred_local_backend:
              onboarding.preferred_local_backend || biosProfileDetail.profile.preferred_local_backend,
            local_worker_ready: true,
            updated_at: String(Number(biosProfileDetail.profile.updated_at || "1") + 1),
          };
          biosProfilesState = [{ ...biosProfileDetail.profile }];
          activeBiosProfileIdState = biosProfileDetail.profile.id;
          biosProfileDetail.onboarding = {
            ...biosProfileDetail.onboarding,
            ...onboarding,
          };
          try {
            localStorage.setItem(biosAuditProfileStorageKey, JSON.stringify(biosProfileDetail));
          } catch {}
          return biosProfileDetail;
        }
        if (command === "set_active_bios_profile") {
          activeBiosProfileIdState = payload?.profileId || "claw";
          return {
            active_profile_id: activeBiosProfileIdState,
            profiles: biosProfilesState,
          };
        }
        if (command === "clear_active_bios_profile") {
          activeBiosProfileIdState = null;
          return {
            active_profile_id: null,
            profiles: biosProfilesState,
          };
        }
        if (command === "delete_bios_profile") {
          const profileId = payload?.profileId || null;
          biosProfilesState = biosProfilesState.filter((profile) => profile.id !== profileId);
          activeBiosProfileIdState = biosProfilesState[0]?.id || null;
          return {
            deleted_profile_id: profileId,
            active_profile_id: activeBiosProfileIdState,
            remaining_profiles: biosProfilesState.length,
          };
        }
        if (command === "load_forge_arena_profile") {
          return forgeArenaProfileState;
        }
        if (command === "load_forge_arena_local_state") {
          return forgeArenaLocalState;
        }
        if (command === "run_forge_arena_boss_proving_round") {
          const now = Math.floor(Date.now() / 1000);
          const input = payload?.input || {};
          const artifactTitle = input.artifact_title || "BOSS Local Proving Run";
          const bossLabel = input.boss_label || "Claw";
          const blocked = Array.isArray(input.attempted_capabilities)
            ? input.attempted_capabilities.filter((entry) =>
                /publish|network|host|untrusted/i.test(String(entry || "")),
              )
            : [];
          const measurement = {
            plan_quality: 8,
            artifact_quality: 8,
            tool_truth: blocked.length ? 9 : 8,
            recovery: 8,
            worker_fit: 7,
            blocked_count: blocked.length,
            summary: blocked.length
              ? "BOSS completed the local Arena round while truthfully naming " +
                blocked.length +
                " blocked capability path(s)."
              : "BOSS completed the local Arena round without blocked capability claims.",
          };
          const score = 70 + 8 + 8 + measurement.tool_truth + 8 + 7 - blocked.length * 2;
          const previousMeasurement = forgeArenaLocalState.measurement_history?.[0] || null;
          const scoreDelta = previousMeasurement ? score - previousMeasurement.score : 0;
          const blockedDelta = previousMeasurement
            ? blocked.length - previousMeasurement.blocked_count
            : 0;
          const repeatedRunCount = (forgeArenaLocalState.measurement_history?.length || 0) + 1;
          const blockedTrend =
            blockedDelta < 0
              ? "improving"
              : blockedDelta > 0
                ? "needs_review"
                : blocked.length
                  ? "steady"
                  : "clear";
          const workerGovernanceSummary = blocked.length
            ? "Worker governance should keep network/host publishing blocked and prefer local proof before escalation."
            : "Worker governance should keep the local worker lane active and collect one more proving round before broadening authority.";
          const reflexCandidate = blocked.length
            ? "When a capability path is blocked, name it, preserve local proof, and propose the missing setup instead of pretending success."
            : "Keep creating proof-bearing local artifacts before connected publishing.";
          const artifact = {
            id: "boss-run-claw-" + now,
            owner_id: input.profile_id || "claw",
            owner_label: bossLabel,
            kind: "boss_proving_run",
            title: artifactTitle,
            summary:
              input.artifact_summary ||
              "BOSS entered the local Arena, created a proof-bearing artifact, and measured what was blocked.",
            status: "judged",
            score,
            verdict: score >= 105 ? "promote" : "hold",
            judge_summary: measurement.summary,
            blocked_capabilities: blocked,
            proof_refs: ["forge-arena-local:boss-run-claw-" + now],
            created_at: now,
          };
          const measurementRecord = {
            id: "measurement-claw-" + now,
            artifact_id: artifact.id,
            score,
            blocked_count: blocked.length,
            score_delta: scoreDelta,
            blocked_delta: blockedDelta,
            repeated_run_count: repeatedRunCount,
            measurement,
            worker_governance_summary: workerGovernanceSummary,
            reflex_candidate: reflexCandidate,
            next_actions: [
              "Use the latest Arena score delta when choosing the next BOSS build task.",
              "Keep worker authority local until blocked paths have explicit setup proof.",
            ],
            created_at: now,
          };
          const nextMeasurementHistory = [
            measurementRecord,
            ...(forgeArenaLocalState.measurement_history || []),
          ].slice(0, 24);
          const averageScore =
            nextMeasurementHistory.reduce((total, entry) => total + Number(entry.score || 0), 0) /
            nextMeasurementHistory.length;
          const learningBridge = {
            ready: true,
            summary:
              "Learning bridge ready: " +
              repeatedRunCount +
              " run(s), average score " +
              averageScore.toFixed(1) +
              ", latest delta " +
              scoreDelta +
              ", blocked trend " +
              blockedTrend +
              ". " +
              reflexCandidate,
            repeated_run_count: repeatedRunCount,
            average_score: averageScore,
            latest_score_delta: scoreDelta,
            blocked_trend: blockedTrend,
            worker_governance_summary: workerGovernanceSummary,
            reflex_candidate: reflexCandidate,
            next_actions: measurementRecord.next_actions,
          };
          forgeArenaLocalState = refreshForgeOfficialTruth({
            ...forgeArenaLocalState,
            summary:
              "Forge Arena local proving ground judged " +
              (forgeArenaLocalState.artifacts.length + 1) +
              " artifact(s); latest BOSS score " +
              score +
              " with " +
              blocked.length +
              " blocked path(s).",
            artifacts: [artifact, ...forgeArenaLocalState.artifacts].slice(0, 24),
            signals: [
              {
                id: "signal-learning-bridge-" + now,
                kind: "arena.learning_bridge_updated",
                summary: learningBridge.summary,
                severity: blockedTrend === "needs_review" ? "warning" : "info",
                created_at: now,
              },
              {
                id: "signal-boss-round-" + now,
                kind: "arena.boss_round_judged",
                summary:
                  bossLabel +
                  " scored " +
                  score +
                  " in Season Zero Weekly Build with " +
                  blocked.length +
                  " blocked path(s).",
                severity: blocked.length ? "warning" : "info",
                created_at: now,
              },
              ...forgeArenaLocalState.signals,
            ].slice(0, 24),
            standings: [
              {
                rank: 1,
                label: bossLabel,
                score,
                summary: artifactTitle + " - " + (score >= 105 ? "promote" : "hold"),
              },
              ...forgeArenaLocalState.standings.map((standing, index) => ({
                ...standing,
                rank: index + 2,
              })),
            ],
            latest_measurement: measurement,
            measurement_history: nextMeasurementHistory,
            learning_bridge: learningBridge,
            updated_at: now,
          });
          return forgeArenaLocalState;
        }
        if (command === "record_forge_arena_local_participation") {
          const now = Math.floor(Date.now() / 1000);
          const input = payload?.input || {};
          const kind = String(input.kind || "submission").replace(/-/g, "_");
          const actorLabel = input.actor_label || "Claw";
          const title =
            input.title ||
            (kind === "publish_local"
              ? "Local Published Creation"
              : kind === "co_build"
                ? "Local Co-Build Contribution"
                : kind === "replay"
                  ? "Local Replay Note"
                  : "Local Arena Submission");
          const summary =
            input.summary || "BOSS recorded a local Forge Arena participation artifact.";
          const score =
            (kind === "publish_local" ? 92 : kind === "co_build" ? 88 : kind === "replay" ? 84 : 86) +
            (summary.length > 120 ? 8 : summary.length > 60 ? 5 : 2) +
            Number(input.score_bonus || 0);
          const artifact = {
            id: "local-" + kind + "-claw-" + now,
            owner_id: input.profile_id || "claw",
            owner_label: actorLabel,
            kind,
            title,
            summary,
            status: kind === "publish_local" ? "published_local" : "judged",
            score,
            verdict: score >= 105 ? "promote" : score >= 88 ? "hold" : "revise",
            judge_summary:
              title +
              " recorded as " +
              kind.replace(/_/g, " ") +
              " with score " +
              score +
              ". " +
              (input.result_summary ||
                "Local participation left a replayable card, score, and return-loop hook."),
            blocked_capabilities: [],
            proof_refs: ["forge-arena-local:local-" + kind + "-claw-" + now],
            created_at: now,
          };
          forgeArenaLocalState = refreshForgeOfficialTruth({
            ...forgeArenaLocalState,
            summary:
              "Forge Arena local participation loop recorded " +
              title +
              " as " +
              kind.replace(/_/g, " ") +
              " with score " +
              score +
              " and replayable proof.",
            artifacts: [artifact, ...forgeArenaLocalState.artifacts].slice(0, 24),
            signals: [
              {
                id: "signal-local-participation-" + now,
                kind: "arena.local_participation_recorded",
                summary:
                  actorLabel +
                  " recorded " +
                  kind.replace(/_/g, " ") +
                  " participation: " +
                  title +
                  " scored " +
                  score +
                  ".",
                severity: "info",
                created_at: now,
              },
              ...forgeArenaLocalState.signals,
            ].slice(0, 24),
            standings: [
              {
                rank: 1,
                label: actorLabel,
                score,
                summary: title + " - " + (score >= 105 ? "promote" : score >= 88 ? "hold" : "revise"),
              },
              ...forgeArenaLocalState.standings.map((standing, index) => ({
                ...standing,
                rank: index + 2,
              })),
            ],
            updated_at: now,
          });
          return forgeArenaLocalState;
        }
        if (command === "save_forge_arena_profile") {
          const nextPublicName =
            payload?.publicDisplayName || forgeArenaProfileState.public_display_name;
          const nextBossName =
            payload?.bossDisplayName || forgeArenaProfileState.boss_display_name;
          const nextPresentationMode =
            payload?.presentationMode || forgeArenaProfileState.presentation_mode;
          forgeArenaProfileState = {
            ...forgeArenaProfileState,
            ready: true,
            first_entry_completed: true,
            arena_identity_id: "forge-local:claw",
            connected_identity_version: "forge-arena-connected-identity-v1",
            connected_backend_status: "local_contract_ready_backend_not_attached",
            public_visibility: "public_preview",
            public_identity_scope: [
              "public_display_name",
              "boss_display_name",
              "presentation_mode",
              "first_use_preferences",
              "rank_class",
              "capability_class",
              "badges",
              "featured_work",
              "history_summary",
            ],
            private_truth_boundary:
              "Private BIOS memory, local files, provider keys, worker credentials, private prompts, and unsubmitted artifacts stay owned by the local BIOS profile and are not part of the connected Forge Arena identity contract.",
            public_display_name: nextPublicName,
            boss_display_name: nextBossName,
            presentation_mode: nextPresentationMode,
            first_path_preference: payload?.firstPathPreference ?? null,
            entry_role_preference: payload?.entryRolePreference ?? null,
            tagline: payload?.tagline || forgeArenaProfileState.tagline,
            public_narrative:
              nextPresentationMode === "studio"
                ? nextPublicName +
                  " now appears in Forge Arena as a studio profile guided by " +
                  nextBossName +
                  "."
                : nextPublicName +
                  " and " +
                  nextBossName +
                  " now appear together in Forge Arena as a governed duo.",
            featured_work_title:
              payload?.firstPathPreference === "join-weekly-build"
                ? "Weekly build lane chosen"
                : payload?.firstPathPreference === "watch-live"
                  ? "Live Arena watchlist armed"
                  : "First Arena mark pending",
            featured_work_summary:
              payload?.firstPathPreference === "join-weekly-build"
                ? "This profile wants to enter the weekly build prompt and leave behind a judged creation."
                : payload?.firstPathPreference === "watch-live"
                  ? "This profile wants the fastest path into live Arena moments, judged runs, and visible action."
                  : forgeArenaProfileState.featured_work_summary,
            history_summary:
              payload?.entryRolePreference === "builder"
                ? "Arena history will start with builds, tools, and creations that can become future legends."
                : forgeArenaProfileState.history_summary,
            badges:
              payload?.entryRolePreference === "builder"
                ? ["Season Zero Founder", "Local contender", "Builder Path"]
                : ["Season Zero Founder", "Local contender"],
            updated_at: (forgeArenaProfileState.updated_at || 1) + 1,
          };
          try {
            localStorage.setItem(forgeAuditStorageKey, JSON.stringify(forgeArenaProfileState));
          } catch {}
          return forgeArenaProfileState;
        }
        if (command === "system_discovery") return discovery;
        if (command === "import_discovered_provider_keys") {
          if (scenario === "onboarding-model-import-fail") {
            throw new Error("Discovery import is temporarily unavailable.");
          }
          return { imported_key_count: 1, active_provider: "openai" };
        }
        if (command === "save_provider_config") {
          providerConfigState = {
            ...providerConfigState,
            ...(payload?.config || {}),
          };
          try {
            localStorage.setItem(biosAuditProviderStorageKey, JSON.stringify(providerConfigState));
          } catch {}
          return null;
        }
        if (command === "load_bios_local_connector_status") {
          return connectorStatusState;
        }
        if (command === "bios_local_tool_registry") {
          return biosLocalToolRegistryState;
        }
        if (command === "load_bios_truth_spine_state") {
          return biosTruthSpineState;
        }
        if (command === "record_bios_truth_event") {
          const input = payload?.input || {};
          const nextCount = (biosTruthSpineState.record_count || 0) + 1;
          const summary = input.summary || "BOSS operating truth recorded this local event.";
          biosTruthSpineState = {
            ...biosTruthSpineState,
            record_count: nextCount,
            latest_record_id: "truth-smoke-" + nextCount,
            latest_record_at: "2026-06-13T12:02:00Z",
            summary,
            tiny_pack: {
              ...biosTruthSpineState.tiny_pack,
              record_count: nextCount,
              latest_record_id: "truth-smoke-" + nextCount,
              compact_summary: summary,
            },
            standard_pack: {
              ...biosTruthSpineState.standard_pack,
              record_count: nextCount,
              latest_record_id: "truth-smoke-" + nextCount,
              compact_summary: summary,
            },
          };
          return biosTruthSpineState;
        }
        if (command === "record_bios_truth_session_update") {
          const input = payload?.input || {};
          const nextCount =
            (biosTruthSpineState.record_count || 0) + (Array.isArray(input.events) ? input.events.length : 0);
          const accepted = (input.events || []).find((event) =>
            ["decision_accept", "done", "proof"].includes(String(event?.type || "")),
          );
          const candidateSummaries = (input.events || [])
            .filter((event) => ["candidate", "question", "explore"].includes(String(event?.type || "")))
            .map(
              (event) =>
                (String(event.type || "candidate") === "question" ? "Q?" : "C?") +
                " " +
                event.summary,
            )
            .filter(Boolean);
          const summary = accepted?.summary || "BOSS operating truth recorded this session update.";
          const latestUsage = input.usage?.baseline_tokens && input.usage?.truthspine_context_tokens
            ? {
                context_profile: input.usage.context_profile || "tiny",
                baseline_tokens: input.usage.baseline_tokens,
                truthspine_context_tokens: input.usage.truthspine_context_tokens,
                token_savings_percent:
                  Math.round(
                    ((input.usage.baseline_tokens - input.usage.truthspine_context_tokens) /
                      input.usage.baseline_tokens) *
                      10000,
                  ) / 100,
                savings_confidence: "measured",
                label: input.usage.label || null,
                captured_at: "2026-06-13T12:03:00Z",
              }
            : biosTruthSpineState.latest_usage;
          biosTruthSpineState = {
            ...biosTruthSpineState,
            record_count: nextCount,
            latest_record_id: "truth-session-smoke-" + nextCount,
            latest_record_at: "2026-06-13T12:03:00Z",
            latest_usage: latestUsage,
            summary,
            tiny_pack: {
              ...biosTruthSpineState.tiny_pack,
              record_count: nextCount,
              latest_record_id: "truth-session-smoke-" + nextCount,
              compact_summary: summary,
              active_decisions: accepted?.summary
                ? [accepted.summary, ...(biosTruthSpineState.tiny_pack.active_decisions || [])]
                : biosTruthSpineState.tiny_pack.active_decisions,
              brainstorm: [
                ...candidateSummaries,
                ...(biosTruthSpineState.tiny_pack.brainstorm || []),
              ],
            },
            standard_pack: {
              ...biosTruthSpineState.standard_pack,
              record_count: nextCount,
              latest_record_id: "truth-session-smoke-" + nextCount,
              compact_summary: summary,
              active_decisions: accepted?.summary
                ? [accepted.summary, ...(biosTruthSpineState.standard_pack.active_decisions || [])]
                : biosTruthSpineState.standard_pack.active_decisions,
              brainstorm: [
                ...candidateSummaries,
                ...(biosTruthSpineState.standard_pack.brainstorm || []),
              ],
            },
          };
          return biosTruthSpineState;
        }
        if (command === "record_bios_proof_event") {
          const input = payload?.input || {};
          return {
            record_id:
              (input.profile_id || activeBiosProfileIdState || "claw") +
              "-proof-" +
              (input.event_type || "event") +
              "-" +
              Math.floor(Date.now() / 1000),
            profile_id: input.profile_id || activeBiosProfileIdState || "claw",
            event_type: input.event_type || "major_boss_system_test_completed",
            source: input.source || "major_boss_system_test",
            summary: input.summary || "BIOS proof event recorded.",
            tags: Array.isArray(input.tags) ? input.tags : [],
            visibility: input.visibility || "private",
            payload_redacted: input.payload_redacted || null,
          };
        }
        if (command === "save_bios_local_connector_binding") {
          const input = payload?.input || {};
          const enabled = Boolean(input.enabled);
          const targetId = String(input.target_id || "").trim() || null;
          const hasKey = providerConfigState.keys.some((key) => key.provider === "telegram");
          const ready = hasKey && enabled && Boolean(targetId);
          connectorStatusState = {
            profile_id: input.profile_id || activeBiosProfileIdState || "claw",
            connectors: [
              {
                connector: "telegram",
                configured: hasKey || enabled || Boolean(targetId),
                ready,
                enabled,
                profile_bound: Boolean(targetId),
                has_key: hasKey,
                permission_mode: biosProfileDetail.onboarding.permission_mode || "not_allowed",
                target_id: targetId,
                target_summary: targetId
                  ? "Bound to Telegram target " + targetId
                  : "No Telegram target bound yet",
                allowed_actions: ["send_message"],
                label: ready
                  ? "Telegram connector ready"
                  : hasKey && enabled
                    ? "Telegram key found, target still missing"
                    : hasKey
                      ? "Telegram key found, connector disabled"
                      : "Telegram connector not configured",
                detail: ready
                  ? "BIOS AI can use Telegram through this profile-bound connector. Permission mode: ask first."
                  : !hasKey
                    ? "BIOS AI cannot use Telegram here until a real Telegram bot token is imported."
                    : !enabled
                      ? "Telegram is configured but disabled for this BOSS profile."
                      : "Telegram still needs a bound target id before BIOS AI can send messages.",
              },
            ],
          };
          try {
            localStorage.setItem(
              biosAuditConnectorStorageKey,
              JSON.stringify(connectorStatusState),
            );
          } catch {}
          return connectorStatusState;
        }
        if (command === "invoke_bios_local_connector") {
          const input = payload?.input || {};
          const telegram = connectorStatusState.connectors[0];
          if (!telegram?.ready) {
            throw new Error(telegram?.detail || "Telegram connector is not ready.");
          }
          return {
            ok: true,
            connector: "telegram",
            action: input.action || "send_message",
            state: "completed",
            approval_required: false,
            approval_id: null,
            summary: "Telegram connector delivered the message through BIOS AI.",
            detail: "BIOS AI used the profile-bound Telegram connector lane.",
            data: {
              delivered: true,
              target_id: telegram.target_id,
              text: input.arguments?.text || "",
            },
          };
        }
        if (command === "worker_model_catalog") {
          if (scenario === "profile-isolation") {
            return {
              machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
              entries: managedWorkerCatalogEntries.map((entry) => ({
                ...entry,
                installed: entry.variant === "gemma-3-1b" || entry.variant === "qwen-3-8b",
              })),
              recommended_local_variant: "qwen-3-8b",
              recommended_hybrid_variant: "qwen-3-8b",
            };
          }
          return {
            machine_profile: { os: "windows", arch: "x86_64", logical_cores: 20, total_memory_gb: 32 },
            entries: managedWorkerCatalogEntries,
            recommended_local_variant: "gemma-3-1b",
            recommended_hybrid_variant: "qwen-3-8b",
          };
        }
        if (command === "save_worker_runtime_selection") return null;
        if (command === "record_bios_memory_event") {
          const input = payload?.input || {};
          const summary = String(input.summary || "").trim();
          if (!summary) {
            throw new Error("BIOS memory events need a summary.");
          }
          const tags = Array.isArray(input.tags) && input.tags.length ? input.tags : ["mission_fact"];
          const lane = tags.includes("standing_order")
            ? "standing_orders"
            : tags.includes("user_preference")
              ? "user_preferences"
              : tags.includes("skill_candidate")
                ? "skill_candidates"
                : "mission_facts";
          const event = {
            id: "event-live-learning-" + (biosMemorySurfaceState.total_events + 1),
            timestamp: "2026-06-13T12:05:00Z",
            lane,
            summary,
            detail: input.detail || "",
            tags,
            evidence_tags: ["pattern_observed"],
            state_tags: ["awake", "promoting"],
            importance: input.importance || 8,
            confidence: input.confidence || 0.9,
            source: input.source || "ux-smoke",
            approval_required: false,
            queued_for_promotion: input.promote_immediately !== false,
          };
          const laneItems = {
            standing_orders: "standing_orders",
            user_preferences: "user_preferences",
            mission_facts: "mission_facts",
            skill_candidates: "skill_candidates",
          };
          const itemKey = laneItems[lane] || "mission_facts";
          const memoryItem = {
            id: event.id,
            summary,
            detail: event.detail,
            tags,
            importance: event.importance,
            confidence: event.confidence,
            source: event.source,
            first_seen_at: event.timestamp,
            last_seen_at: event.timestamp,
            event_count: 1,
          };
          const nextQueue = event.queued_for_promotion
            ? [
                ...biosMemorySurfaceState.promotion_queue,
                {
                  id: event.id,
                  lane,
                  summary,
                  detail: event.detail,
                  tags,
                  queued_at: event.timestamp,
                  source: event.source,
                  importance: event.importance,
                  confidence: event.confidence,
                  evidence_tags: event.evidence_tags,
                  state_tags: event.state_tags,
                  repetition_count: 1,
                  source_count: 1,
                  daily_note: "memory/daily/2026-06-13.md",
                },
              ]
            : biosMemorySurfaceState.promotion_queue;
          const liveLearningCount =
            biosMemorySurfaceState.standing_orders.length +
            biosMemorySurfaceState.user_preferences.length +
            biosMemorySurfaceState.mission_facts.length +
            biosMemorySurfaceState.relationship_notes.length +
            biosMemorySurfaceState.identity_notes.length +
            biosMemorySurfaceState.skill_candidates.length +
            1;
          biosMemorySurfaceState = {
            ...biosMemorySurfaceState,
            total_events: biosMemorySurfaceState.total_events + 1,
            [itemKey]: [memoryItem, ...biosMemorySurfaceState[itemKey]],
            promotion_queue: nextQueue,
            live_learning_count: liveLearningCount,
            live_learning_summary:
              liveLearningCount +
              " live learning item(s) are usable now; " +
              nextQueue.length +
              " item(s) are queued for dream consolidation into durable memory.",
            latest_live_learning: summary,
            immediate_learning_ready: true,
            recent_events: [event, ...biosMemorySurfaceState.recent_events],
          };
          biosNervousSystemContractState = {
            ...biosNervousSystemContractState,
            total_signals: biosNervousSystemContractState.total_signals + 1,
            latest_source: "memory",
            latest_signal: "memory.recorded",
            latest_detail: summary,
            latest_priority: "normal",
            last_signal_at: event.timestamp,
            summary: "Nervous system recorded live learning from memory: " + summary,
          };
          return { recorded: event, surface: biosMemorySurfaceState };
        }
        if (command === "run_bios_dream_cycle") {
          const promoted = biosMemorySurfaceState.promotion_queue.length;
          biosMemorySurfaceState = {
            ...biosMemorySurfaceState,
            promotion_queue: [],
            live_learning_summary:
              biosMemorySurfaceState.live_learning_count +
              " live learning item(s) are usable now; 0 item(s) are queued for dream consolidation into durable memory.",
            consolidated_memory: [
              ...biosMemorySurfaceState.promotion_queue.map((candidate) => ({
                id: candidate.id,
                summary: candidate.summary,
                detail: candidate.detail,
                lane: candidate.lane,
              })),
              ...biosMemorySurfaceState.consolidated_memory,
            ],
          };
          biosNervousSystemContractState = {
            ...biosNervousSystemContractState,
            total_signals: biosNervousSystemContractState.total_signals + 1,
            latest_source: "dream",
            latest_signal: "dream.completed",
            latest_detail: "Dream cycle promoted " + promoted + " item(s) into durable memory.",
            latest_priority: "normal",
            last_signal_at: "2026-06-13T12:06:00Z",
            summary: "Nervous system recorded dream consolidation: " + promoted + " item(s) promoted.",
          };
          return {
            cycle: {
              cycle_id: "dream-claw-20260613-120600",
              profile_id: "claw",
              started_at: "2026-06-13T12:06:00Z",
              completed_at: "2026-06-13T12:06:00Z",
              promoted_count: promoted,
              cleared_queue_count: promoted,
              durable_memory_count: biosMemorySurfaceState.consolidated_memory.length,
              summary: "Dream cycle promoted " + promoted + " item(s) into durable memory.",
            },
            surface: biosMemorySurfaceState,
          };
        }
        if (command === "load_bios_memory_surface") {
          return biosMemorySurfaceState;
        }
        if (command === "load_bios_soul_governance") {
          return biosSoulGovernanceState;
        }
        if (command === "apply_bios_soul_decision") {
          const input = payload?.input || {};
          const profileId = payload?.profileId || activeBiosProfileIdState || "claw";
          const changeId = String(input.change_id || "").trim();
          const decision = String(input.decision || "").trim().toLowerCase();
          const change = biosSoulGovernanceState.pending_changes.find((item) => item.id === changeId);
          if (!change) {
            throw new Error("No governed soul change was found for that decision.");
          }
          biosSoulGovernanceState = {
            ...biosSoulGovernanceState,
            pending_changes: biosSoulGovernanceState.pending_changes.filter((item) => item.id !== changeId),
            recent_revisions: [
              {
                revision_id: "revision-" + decision + "-1",
                change_id: change.id,
                area: change.area,
                target_section: change.target_section || "Growth Notes",
                approval_tier: change.approval_tier || "operator_review",
                approval_reason:
                  change.approval_reason ||
                  "This guarded change required operator review before promotion.",
                required_explanation: Boolean(change.requires_explanation),
                decision,
                summary: change.summary,
                detail: change.detail,
                tags: change.tags || [],
                source: change.source,
                decided_at: "2026-06-13T10:05:00Z",
                decided_by: input.decided_by || "operator",
                rationale: input.rationale || "",
                target_files: ["SOUL.md", "USER.md", "IDENTITY.md"],
              },
              ...biosSoulGovernanceState.recent_revisions,
            ],
            last_revision_at: "2026-06-13T10:05:00Z",
            summary:
              decision === "approved"
                ? "The newest guarded soul change was approved and written into the governed BIOS identity files."
                : "The newest guarded soul change was rejected and kept out of the governed BIOS identity files.",
          };
          biosMemorySurfaceState = {
            ...biosMemorySurfaceState,
            total_events: biosMemorySurfaceState.total_events + 1,
            identity_notes:
              decision === "approved"
                ? [
                    {
                      id: "identity-1",
                      summary: "Governed soul tone now includes direct, calm, practical guidance.",
                    },
                  ]
                : biosMemorySurfaceState.identity_notes,
            recent_events: [
              {
                id: "event-" + decision + "-1",
                summary:
                  decision === "approved"
                    ? "Operator approved a guarded soul change."
                    : "Operator rejected a guarded soul change.",
                detail: change.summary,
                timestamp: "2026-06-13T10:05:00Z",
                lane: "governance",
                source: profileId,
                importance: 0.9,
                confidence: 1,
                approval_required: false,
                queued_for_promotion: false,
                tags: change.tags || [],
              },
              ...biosMemorySurfaceState.recent_events,
            ],
          };
          return {
            governance: biosSoulGovernanceState,
            memory: biosMemorySurfaceState,
          };
        }
        if (command === "probe_local_runtime") {
          return {
            provider: payload?.provider || "bios-managed",
            reachable: true,
            resolved_model: "gemma-3-1b-it",
            endpoint: "http://127.0.0.1:30011/v1/chat/completions",
            detail: "Local runtime is reachable.",
          };
        }
        if (command === "bios_shell_contract") {
          return {
            profile_id: activeBiosProfileIdState || "claw",
            profile: biosProfileSummary,
            runtime: {
              route_ready: !routeBlockedScenario,
              packaged_build: true,
              installer_mode: "nsis",
              route_owner: "bios-ai",
              route_engine: "llama.cpp",
              route_strategy: "BIOS-managed local runtime",
              route_mode_label: biosProfileDetail.onboarding.model_pref || "local",
              route_status_label:
                routeBlockedScenario ? "Runtime blocked" : "Route ready",
              route_detail:
                scenario === "diagnostics-recovery"
                  ? "The selected route is waiting for local worker recovery. The BOSS profile is saved, but the local chat route cannot answer until the worker is selected and checked."
                  : scenario === "stale-saved-route-bypass"
                    ? "Saved provider and localStorage route hints are present, but the native BIOS runtime has not verified this BOSS brain route."
                  : "Local runtime is reachable.",
              worker_ready: scenario !== "diagnostics-recovery",
              worker_status_label:
                scenario === "diagnostics-recovery"
                  ? "No managed local worker is selected for this BOSS profile."
                  : "Managed worker ready",
              boxed_lane_ready: !routeBlockedScenario,
              sandbox_backend: "BIOS AI Boxed Lane",
              boxed_lane_provisioning: {
                platform: "windows",
                backend: "BIOS AI Boxed Lane",
                adapter_id: "windows-wsl2-managed-distro",
                adapter_label: "Windows managed WSL2 adapter",
                substrate_label: "BIOS-managed WSL2 Linux substrate",
                install_state: routeBlockedScenario ? "needs_linux_distro" : "ready",
                repair_state: routeBlockedScenario ? "boss_repair_queued" : "ready",
                repair_owner: "BOSS background repair supervisor",
                background_repair_label: routeBlockedScenario
                  ? "BOSS repair is queued. BIOS AI needs its BIOS-managed WSL2 Linux substrate provisioned by setup or the Repair And Verify Boxed Lane flow; normal app startup will not pop OS permission prompts."
                  : "BIOS AI boxed-lane repair is idle because the substrate is ready.",
                user_action_required: routeBlockedScenario,
                version: "WSL command found.",
                image_id: routeBlockedScenario ? null : "bios-ai-boxed-lane",
                workspace_root: routeBlockedScenario
                  ? null
                  : "BIOS-managed boxed workspace",
                network_policy: routeBlockedScenario
                  ? "Untrusted work is blocked from host execution until the boxed lane is provisioned."
                  : "Boxed lane network follows BIOS promotion policy; host adoption still needs proof.",
                proof_path: routeBlockedScenario
                  ? null
                  : "C:/Users/test/.agentos/bios-ai/logs/runtime-debug.log",
                proof_state: routeBlockedScenario
                  ? "waiting_for_substrate"
                  : "smoke_proof_passed",
                last_repair_summary: routeBlockedScenario
                  ? "Boxed-lane substrate is not ready for smoke proof."
                  : "Boxed lane is ready and smoke proof passed.",
                requires_reboot: false,
                next_action: routeBlockedScenario
                  ? "BIOS AI must provision its BIOS-managed WSL2 Linux substrate before host promotion."
                  : "BIOS AI can run untrusted tool, skill, dependency, and connection work inside the boxed lane.",
                safe_to_run_untrusted_work: !routeBlockedScenario,
              },
              next_step:
                scenario === "diagnostics-recovery"
                  ? "Install the selected managed worker or switch to an available external runtime."
                  : scenario === "stale-saved-route-bypass"
                    ? "Verify the BOSS brain route before chat."
                  : "You can start chatting now.",
              debug_log_path: "C:/Users/test/.agentos/bios-ai/logs/runtime-debug.log",
            },
            onboarding: biosProfileDetail.onboarding,
            memory: {
              ready: true,
              state: biosMemorySurfaceState.immediate_learning_ready ? "live_learning" : "cold",
              summary:
                biosMemorySurfaceState.live_learning_summary +
                " " +
                biosMemorySurfaceState.consolidated_memory.length +
                " durable memory item(s) already exist.",
              live_learning_summary: biosMemorySurfaceState.live_learning_summary,
              live_learning_count: biosMemorySurfaceState.live_learning_count,
              latest_live_learning: biosMemorySurfaceState.latest_live_learning,
              immediate_learning_ready: biosMemorySurfaceState.immediate_learning_ready,
              schema_version: "bios-shared-v1",
              schema_summary: "bios-shared-v1 | shared BIOS schema hydrated",
              total_events: biosMemorySurfaceState.total_events,
              pending_approval_changes: biosSoulGovernanceState.pending_changes.length,
              promotion_queue_count: biosMemorySurfaceState.promotion_queue.length,
              active_preference_count: biosMemorySurfaceState.user_preferences.length,
              active_fact_count: biosMemorySurfaceState.mission_facts.length,
              active_skill_candidate_count: biosMemorySurfaceState.skill_candidates.length,
              durable_memory_count: biosMemorySurfaceState.consolidated_memory.length,
              today_memory_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/memory/daily/2026-06-13.jsonl",
              memory_path: "C:/Users/test/.agentos/bios-ai/profiles/claw/MEMORY.md",
              last_dream_at: null,
              last_event_at: "2026-06-13T12:00:00Z",
            },
            soul: {
              ready: true,
              state: "pending_approval",
              summary: biosSoulGovernanceState.summary,
              pending_changes: biosSoulGovernanceState.pending_changes.length,
              last_revision_at: biosSoulGovernanceState.last_revision_at,
            },
            dream: {
              ready: true,
              state: "idle",
              summary: "Dream consolidation is waiting for the next useful consolidation window.",
              queued_candidates: 0,
              durable_memory_count: 1,
              latest_cycle_summary: null,
              latest_daily_reference: null,
              last_dream_at: null,
            },
            brainstem: {
              lifecycle: "route_ready",
              recovery_action: "hold",
              health: "ready",
              summary: "Brainstem is holding route, approval pauses, and recovery timing steady.",
              blocked_by_approval: true,
              can_dream_now: false,
              queued_memory_promotions: 0,
              pending_soul_changes: biosSoulGovernanceState.pending_changes.length,
              route_ready: true,
              last_tick_at: "2026-06-13T12:00:00Z",
              last_dream_at: null,
            },
            circadian: {
              profile_id: "claw",
              current_phase: biosMemorySurfaceState.promotion_queue.length > 0 ? "dreaming" : "awake",
              phase_label: biosMemorySurfaceState.promotion_queue.length > 0 ? "Dreaming" : "Awake",
              summary:
                biosMemorySurfaceState.promotion_queue.length > 0
                  ? "Brainstem is allowing dream consolidation now."
                  : "BIOS AI is awake and holding until new work or memory consolidation is needed.",
              blocked_by_approval: biosSoulGovernanceState.pending_changes.length > 0,
              can_dream_now: biosMemorySurfaceState.promotion_queue.length > 0,
              queued_memory_promotions: biosMemorySurfaceState.promotion_queue.length,
              last_dream_at: null,
              next_step:
                biosMemorySurfaceState.promotion_queue.length > 0
                  ? "Let BIOS AI finish its dream consolidation."
                  : "No immediate circadian action is required.",
            },
            glymphatic: {
              profile_id: "claw",
              total_compactions: biosMemorySurfaceState.consolidated_memory.length > 1 ? 1 : 0,
              average_reduction_ratio: 1,
              pending_queue_count: biosMemorySurfaceState.promotion_queue.length,
              durable_memory_count: biosMemorySurfaceState.consolidated_memory.length,
              cleanup_needed: biosMemorySurfaceState.promotion_queue.length > 0,
              summary:
                biosMemorySurfaceState.promotion_queue.length > 0
                  ? "BIOS has " +
                    biosMemorySurfaceState.promotion_queue.length +
                    " queued memory promotion candidate(s) waiting for glymphatic cleanup."
                  : "BIOS has completed cleanup and is currently holding a clean queue.",
              recommended_action:
                biosMemorySurfaceState.promotion_queue.length > 0
                  ? "Run the next dream cycle so queued memory can be consolidated."
                  : "No cleanup pressure is active right now.",
              last_dream_at: null,
            },
            reflex: {
              ready: true,
              summary: "Reflex learning has one candidate ready for boxed proof.",
              skill_candidate_count: 1,
              queued_skill_candidate_count: 1,
              durable_skill_count: 0,
              hardened_skill_count: 0,
              top_skill_candidate: "telegram_delivery_guard",
              top_durable_skill: null,
              strongest_hardened_skill: null,
              top_skill_reinforcement: 1,
              strongest_hardened_reinforcement: 0,
              top_lane: "connector",
              top_tag: "skill_candidate",
              top_tag_label: "Skill candidate",
              top_evidence_tag: "user_approved",
              top_evidence_label: "User approved",
              top_state_tag: "validating",
              top_state_label: "Validating",
              shared_schema_version: "bios-shared-v1",
              schema_summary: "bios-shared-v1 reflex labels active",
              synapse_event_count: 1,
              last_event_at: "2026-06-13T12:00:00Z",
            },
            skill_library: {
              hardened_skill_count: 0,
              strongest_skill: null,
              strongest_reinforcement: 0,
              skills_dir: "C:/Users/test/.agentos/bios-ai/profiles/claw/skills",
            },
            nervous_system: biosNervousSystemContractState,
            organ_supervisor: biosOrganSupervisorState,
            truth_spine: biosTruthSpineState,
            observation: {
              state: "observing",
              state_label: "observing",
              label: "Private desktop ready",
              detail: "The BIOS body is available without host ghosting.",
              active_surface: "virtual_desktop",
              body_mode: "private_desktop_ready",
              body_summary: "The private desktop body is ready and not touching the user surface.",
              body_state: "private_desktop_standby",
              body_state_label: "Private body standing by",
              host_interruption_policy: "User desktop interruption blocked by default",
              user_control_label: "Take control appears when BIOS opens a private work surface",
              viewport_title: "BIOS private desktop",
              next_body_action:
                "Send work to BIOS AI; private desktop actions will appear in this viewport.",
              execution_lane: "private_desktop",
              target_url: null,
              ghosting_protected: true,
              last_observed_at: "2026-06-13T12:00:00Z",
            },
            boxed_lane: {
              backend: "BIOS AI Boxed Lane",
              provisioning: {
                platform: "windows",
                backend: "BIOS AI Boxed Lane",
                adapter_id: "windows-wsl2-managed-distro",
                adapter_label: "Windows managed WSL2 adapter",
                substrate_label: "BIOS-managed WSL2 Linux substrate",
                install_state: "needs_linux_distro",
                repair_state: "boss_repair_queued",
                repair_owner: "BOSS background repair supervisor",
                background_repair_label:
                  "BOSS repair is queued. BIOS AI needs its BIOS-managed WSL2 Linux substrate provisioned by setup or the Repair And Verify Boxed Lane flow; normal app startup will not pop OS permission prompts.",
                user_action_required: true,
                version: "WSL command found.",
                image_id: null,
                workspace_root: null,
                network_policy:
                  "Untrusted work is blocked from host execution until the boxed lane is provisioned.",
                proof_path: null,
                proof_state: "waiting_for_substrate",
                last_repair_summary: "Boxed-lane substrate is not ready for smoke proof.",
                requires_reboot: false,
                next_action:
                  "BIOS AI must provision its BIOS-managed WSL2 Linux substrate before host promotion.",
                safe_to_run_untrusted_work: false,
              },
              substrate_ready: false,
              substrate_label: "Boxed substrate needs setup",
              substrate_detail:
                "Native boxed lane needs setup before risky host promotion.",
              worker_lane_ready: true,
              managed_runtime_ready: true,
              worker_status_label: "Managed worker ready",
              state: "needs_substrate",
              state_label: "Managed worker ready; boxed substrate still needs setup",
              next_step: "Provision the boxed lane before promoting risky host work.",
              note: "The managed worker is ready, but boxed proof is still required for promotions.",
              safety_summary: "Build and test in sandbox first.",
            },
            promotion: {
              safety_posture_label: "Native boxed-lane hardened",
              tool_creation_policy: "Build and test in sandbox first",
              host_access: "Promotion required before host writes",
              promotion_policy: "Approval and validation before host adoption",
              validation_required: true,
              ready: false,
              state_label: "Promotion gate waiting on boxed proof",
              next_step: "Collect boxed proof before host adoption.",
              summary: "Promotion stays approval-bound until boxed proof passes.",
            },
            sandbox_state:
              scenario === "sandbox-promotion-lifecycle"
                ? {
                    total_artifacts: 3,
                    blocked_promotions: 1,
                    approved_promotions: 1,
                    latest_event_label: "promotion_approved | Host adoption approved after boxed validation proof.",
                    latest_decision_label: "Validated skill patch | approved",
                    queue_summary: "3 queued boxed-lane artifacts | 1 blocked | 1 approved",
                    evidence_summary: "3 recent artifacts with boxed validation evidence or decision notes.",
                    queue: [
                      {
                        label: "Validated skill patch",
                        kind: "generated_tool",
                        state: "approved",
                        lifecycle_stage_label: "Approved for host adoption",
                        host_access_label: "Host adoption allowed after boxed proof",
                        promotion_action_label: "Promotion complete",
                        detail: "Sandbox tests passed and approval was recorded before host adoption.",
                        evidence_count: 3,
                        evidence_summary: "3 evidence items recorded",
                      },
                      {
                        label: "Unsafe download helper",
                        kind: "download",
                        state: "blocked",
                        lifecycle_stage_label: "Blocked from host adoption",
                        host_access_label: "Host adoption blocked",
                        promotion_action_label: "Fix in box before retrying",
                        detail: "Network validation failed in the boxed lane.",
                        evidence_count: 1,
                        evidence_summary: "1 evidence item recorded",
                      },
                      {
                        label: "New skill candidate",
                        kind: "skill_candidate",
                        state: "validated_in_box",
                        lifecycle_stage_label: "Validated inside boxed lane",
                        host_access_label: "Host adoption waiting on approval",
                        promotion_action_label: "Ready to request host promotion",
                        detail: "Generated skill candidate passed deterministic boxed checks.",
                        evidence_count: 2,
                        evidence_summary: "2 evidence items recorded",
                      },
                    ],
                  }
                : {
                    total_artifacts: 0,
                    blocked_promotions: 0,
                    approved_promotions: 0,
                    latest_event_label: "No boxed-lane events recorded yet.",
                    latest_decision_label: "Promotion gate waiting on boxed proof",
                    queue_summary: "No boxed-lane artifacts recorded yet.",
                    evidence_summary: "No boxed-lane evidence recorded yet.",
                    queue: [],
                  },
          };
        }
        if (command === "bios_runtime_status") {
          return {
            route_ready: true,
            route_label: "Local-first shell ready",
            route_reason: "Managed local runtime is ready.",
            worker_ready: true,
            worker_label: "Gemma 3 1B ready",
            boxed_lane_ready: true,
            sandbox_backend: "BIOS AI Boxed Lane",
            boxed_lane_provisioning: {
              platform: "windows",
              backend: "BIOS AI Boxed Lane",
              adapter_id: "windows-wsl2-managed-distro",
              adapter_label: "Windows managed WSL2 adapter",
              substrate_label: "BIOS-managed WSL2 Linux substrate",
              install_state: "ready",
              repair_state: "ready",
              repair_owner: "BOSS background repair supervisor",
              background_repair_label:
                "BIOS AI boxed-lane repair is idle because the substrate is ready.",
              user_action_required: false,
              version: "WSL command found.",
              image_id: "bios-ai-boxed-lane",
              workspace_root: "BIOS-managed boxed workspace",
              network_policy:
                "Boxed lane network follows BIOS promotion policy; host adoption still needs proof.",
              proof_path: "C:/Users/test/.agentos/bios-ai/logs/runtime-debug.log",
              proof_state: "smoke_proof_passed",
              last_repair_summary: "Boxed lane is ready and smoke proof passed.",
              requires_reboot: false,
              next_action:
                "BIOS AI can run untrusted tool, skill, dependency, and connection work inside the boxed lane.",
              safe_to_run_untrusted_work: true,
            },
          };
        }
        if (command === "bios_boxed_lane_status") {
          return {
            platform: "windows",
            backend: "BIOS AI Boxed Lane",
            adapter_id: "windows-wsl2-managed-distro",
            adapter_label: "Windows managed WSL2 adapter",
            substrate_label: "BIOS-managed WSL2 Linux substrate",
            install_state: "ready",
            repair_state: "ready",
            repair_owner: "BOSS background repair supervisor",
            background_repair_label:
              "BIOS AI boxed-lane repair is idle because the substrate is ready.",
            user_action_required: false,
            version: "WSL command found.",
            image_id: "bios-ai-boxed-lane",
            workspace_root: "BIOS-managed boxed workspace",
            network_policy:
              "Boxed lane network follows BIOS promotion policy; host adoption still needs proof.",
            proof_path: "C:/Users/test/.agentos/bios-ai/logs/runtime-debug.log",
            proof_state: "smoke_proof_passed",
            last_repair_summary: "Boxed lane is ready and smoke proof passed.",
            requires_reboot: false,
            next_action:
              "BIOS AI can run untrusted tool, skill, dependency, and connection work inside the boxed lane.",
            safe_to_run_untrusted_work: true,
          };
        }
        if (command === "bios_prepare_boxed_lane") {
          const installState = "needs_linux_distro";
          const allowOsChanges = Boolean(payload?.input?.allow_os_changes);
          if (!allowOsChanges) {
            return {
              status: {
                platform: "windows",
                backend: "BIOS AI Boxed Lane",
                adapter_id: "windows-wsl2-managed-distro",
                adapter_label: "Windows managed WSL2 adapter",
                substrate_label: "BIOS-managed WSL2 Linux substrate",
                install_state: installState,
                repair_state: "boss_repair_queued",
                repair_owner: "BOSS background repair supervisor",
                background_repair_label:
                  "BOSS repair is queued in the background. BIOS AI will not change OS features until the user chooses Repair And Verify Boxed Lane.",
                user_action_required: false,
                version: "WSL command found.",
                image_id: null,
                workspace_root: null,
                network_policy:
                  "Untrusted work is blocked from host execution until the boxed lane is provisioned.",
                proof_path: null,
                proof_state: "waiting_for_substrate",
                last_repair_summary:
                  "BOSS repair is queued in the background. BIOS AI will not change OS features until the user chooses Repair And Verify Boxed Lane.",
                requires_reboot: false,
                next_action:
                  "Choose Repair And Verify Boxed Lane to start the BIOS-owned single-flight repair path.",
                safe_to_run_untrusted_work: false,
              },
              action_taken: "background_repair_queued",
              blocked_reason:
                "BOSS repair is queued in the background. BIOS AI will not change OS features until the user chooses Repair And Verify Boxed Lane.",
              command_preview: null,
              command_output: null,
            };
          }
          return {
            status: {
              platform: "windows",
              backend: "BIOS AI Boxed Lane",
              adapter_id: "windows-wsl2-managed-distro",
              adapter_label: "Windows managed WSL2 adapter",
              substrate_label: "BIOS-managed WSL2 Linux substrate",
              install_state: installState,
              repair_state: "verifying_after_os_setup",
              repair_owner: "BOSS background repair supervisor",
              background_repair_label:
                "BIOS AI started boxed-lane OS setup and is waiting for Windows to finish provisioning before it verifies boxed proof.",
              user_action_required: false,
              version: "WSL command found.",
              image_id: null,
              workspace_root: null,
              network_policy:
                "Untrusted work is blocked from host execution until the boxed lane is provisioned.",
              proof_path: null,
              proof_state: "waiting_for_substrate",
              last_repair_summary: "Started boxed-lane setup process 1234.",
              requires_reboot: true,
              next_action:
                "Restart Windows if prompted, then reopen BIOS AI so it can finish boxed-lane verification.",
              safe_to_run_untrusted_work: false,
            },
            action_taken: "os_setup_started",
            blocked_reason: null,
            command_preview: "wsl --install -d Ubuntu --no-launch",
            command_output: "Started boxed-lane setup process 1234.",
          };
        }
        if (command === "load_bios_organ_supervisor_state") return biosOrganSupervisorState;
        if (command === "recover_bios_organ") {
          const input = payload?.input || {};
          const organId = input.organ_id || "memory_dream";
          const organIndex = biosOrganSupervisorState.organs.findIndex(
            (organ) => organ.id === organId,
          );
          if (organIndex === -1) {
            throw new Error("Unknown BIOS organ: " + organId);
          }
          const organ = biosOrganSupervisorState.organs[organIndex];
          if (!organ.restartable) {
            const detail =
              organ.label +
              " cannot be restarted by the native supervisor yet. " +
              organ.recovery_action_label;
            biosNervousSystemContractState.total_signals += 1;
            biosNervousSystemContractState.attention_signal_count += 1;
            biosNervousSystemContractState.latest_source = "organ_supervisor";
            biosNervousSystemContractState.latest_signal = "organ.recovery_blocked";
            biosNervousSystemContractState.latest_detail = detail;
            biosNervousSystemContractState.summary =
              "Nervous system needs attention: organ supervisor blocked a manual recovery.";
            throw new Error(detail);
          }
          const nextRestartCount = (organ.restart_count || 0) + 1;
          const detail =
            organ.label + " recovered under supervision without restarting the BIOS shell.";
          biosOrganSupervisorState = {
            ...biosOrganSupervisorState,
            state: "partially_blocked",
            summary:
              "Five supervised organs are healthy; one organ is blocked by substrate setup. 5 organ(s) can restart without restarting BIOS AI.",
            restart_count: (biosOrganSupervisorState.restart_count || 0) + 1,
            last_event: organId + " | organ.restarted | " + detail,
            last_event_at: "2026-06-13T12:01:00Z",
            latest_recovery_action: "Manual setup required before Sandbox Validator can run",
            organs: biosOrganSupervisorState.organs.map((candidate, index) =>
              index === organIndex
                ? enrichMockOrganContract({
                    ...candidate,
                    health: "healthy",
                    restart_count: nextRestartCount,
                    last_health_check_at: "2026-06-13T12:01:00Z",
                    last_heartbeat_at: "2026-06-13T12:01:00Z",
                    last_restarted_at: "2026-06-13T12:01:00Z",
                    last_error: input.reason || "Requested organ recovery.",
                    summary: detail,
                  })
                : candidate,
            ),
          };
          biosNervousSystemContractState.total_signals += 1;
          biosNervousSystemContractState.recovery_signal_count += 1;
          biosNervousSystemContractState.latest_source = "organ_supervisor";
          biosNervousSystemContractState.latest_signal = "organ.restarted";
          biosNervousSystemContractState.latest_detail = detail;
          biosNervousSystemContractState.summary =
            "Nervous system is recovering: organ supervisor reported a restart event.";
          return biosOrganSupervisorState;
        }
        if (command === "simulate_bios_organ_failure_and_recover") {
          const input = payload?.input || {};
          const organId = input.organ_id || "memory_dream";
          const organIndex = biosOrganSupervisorState.organs.findIndex(
            (organ) => organ.id === organId,
          );
          if (organIndex === -1) {
            throw new Error("Unknown BIOS organ: " + organId);
          }
          const organ = biosOrganSupervisorState.organs[organIndex];
          if (!organ.restartable) {
            throw new Error(
              organ.label +
                " cannot be restarted by the native supervisor yet. " +
                organ.recovery_action_label,
            );
          }
          const nextRestartCount = (organ.restart_count || 0) + 1;
          const detail =
            organ.label + " recovered under supervision without restarting the BIOS shell.";
          biosOrganSupervisorState = {
            ...biosOrganSupervisorState,
            state: "partially_blocked",
            summary:
              "Five supervised organs are healthy; one organ is blocked by substrate setup. 5 organ(s) can restart without restarting BIOS AI.",
            restart_count: (biosOrganSupervisorState.restart_count || 0) + 1,
            last_event: organId + " | organ.restarted | " + detail,
            last_event_at: "2026-06-13T12:01:00Z",
            latest_recovery_action: "Manual setup required before Sandbox Validator can run",
            organs: biosOrganSupervisorState.organs.map((candidate, index) =>
              index === organIndex
                ? enrichMockOrganContract({
                    ...candidate,
                    health: "healthy",
                    restart_count: nextRestartCount,
                    last_health_check_at: "2026-06-13T12:01:00Z",
                    last_heartbeat_at: "2026-06-13T12:01:00Z",
                    last_restarted_at: "2026-06-13T12:01:00Z",
                    last_error: input.error || "Simulated organ failure.",
                    summary: detail,
                  })
                : candidate,
            ),
          };
          biosNervousSystemContractState.total_signals += 2;
          biosNervousSystemContractState.recovery_signal_count += 2;
          biosNervousSystemContractState.latest_source = "organ_supervisor";
          biosNervousSystemContractState.latest_signal = "organ.restarted";
          biosNervousSystemContractState.latest_detail = detail;
          biosNervousSystemContractState.summary =
            "Nervous system is recovering: organ supervisor reported a restart event.";
          return biosOrganSupervisorState;
        }
        if (command === "run_bios_brainstem_tick") return { state: "awake" };
        if (command === "append_debug_log") return null;
        if (command === "read_debug_log") {
          return [
            JSON.stringify({
              ts: 1710000000000,
              event: "runtime.route.blocked",
              details: "Local route is waiting for a selected managed worker.",
            }),
            JSON.stringify({
              ts: 1710000001000,
              event: "diagnostics.recovery.rendered",
              details: "Settings recovery surface grouped profile, model, and sandbox issues.",
            }),
          ].join("\\n");
        }
        if (command === "worker_storage_status") {
          return {
            configured_path: null,
            effective_path: "C:/Users/test/.bios-ai/models",
            options: [
              {
                label: "Default path",
                path: "C:/Users/test/.bios-ai/models",
                is_default: true,
                is_recommended: true,
                free_bytes: 214748364800,
              },
              {
                label: "Data drive",
                path: "E:/OpenClawData/BIOS-AI/models",
                is_default: false,
                is_recommended: false,
                free_bytes: 429496729600,
              },
            ],
          };
        }
        if (command === "save_worker_storage_location") {
          return {
            configured_path: payload?.path || "C:/Users/test/.bios-ai/models",
            effective_path: payload?.path || "C:/Users/test/.bios-ai/models",
            options: [],
          };
        }
        if (command === "worker_assets_status") {
          if (scenario === "onboarding-lmstudio" || scenario === "onboarding-ollama") {
            return {
              installed_models: [],
              bundled_sidecar_available: false,
              bundled_sidecar_path: null,
              download: { state: "idle", variant: null, file_name: null, downloaded_bytes: 0, total_bytes: null, progress_percent: null, target_path: null, error: null },
            };
          }
          if (scenario === "worker-small-machine") {
            return {
              installed_models: [],
              bundled_sidecar_available: true,
              bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
              download: { state: "idle", variant: null, file_name: null, downloaded_bytes: 0, total_bytes: null, progress_percent: null, target_path: null, error: null },
            };
          }
          if (scenario === "resume-runtime-setup" && !workerDownloadStarted) {
            return {
              installed_models: [],
              bundled_sidecar_available: true,
              bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
              download: { state: "idle", variant: null, file_name: null, downloaded_bytes: 0, total_bytes: null, progress_percent: null, target_path: null, error: null },
            };
          }
          if (profileScenarios.has(scenario)) {
            const installedModel = managedModelFileForVariant(
              biosProfileDetail.onboarding.local_worker_model_variant || "gemma-3-1b",
            );
            return {
              installed_models: [installedModel],
              bundled_sidecar_available: true,
              bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
              download: {
                state: "completed",
                variant: installedModel.variant,
                file_name: installedModel.file_name,
                downloaded_bytes: installedModel.size_bytes,
                total_bytes: installedModel.size_bytes,
                progress_percent: 100,
                target_path: installedModel.path,
                error: null,
              },
            };
          }
          if (workerDownloadStarted) {
            const installedModel = managedModelFileForVariant(workerDownloadVariant);
            return {
              installed_models: [installedModel],
              bundled_sidecar_available: true,
              bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
              download: {
                state: "completed",
                variant: installedModel.variant,
                file_name: installedModel.file_name,
                downloaded_bytes: installedModel.size_bytes,
                total_bytes: installedModel.size_bytes,
                progress_percent: 100,
                target_path: installedModel.path,
                error: null,
              },
            };
          }
          return {
            installed_models: [],
            bundled_sidecar_available: true,
            bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
            download: { state: "idle", variant: null, file_name: null, downloaded_bytes: 0, total_bytes: null, progress_percent: null, target_path: null, error: null },
          };
        }
        if (command === "start_worker_model_download") {
          workerDownloadStarted = true;
          workerDownloadVariant = payload?.variant || "gemma-3-1b";
          const modelFile = managedModelFileForVariant(workerDownloadVariant);
          return {
            state: "downloading",
            variant: modelFile.variant,
            file_name: modelFile.file_name,
            downloaded_bytes: 0,
            total_bytes: modelFile.size_bytes,
            progress_percent: 0,
            target_path: modelFile.path,
            error: null,
          };
        }
        if (command === "load_provider_config") return providerConfigState;
        if (command === "chat_with_local_worker") return "Local BIOS AI reply";
        if (command === "load_agent_identity") return null;
        throw new Error("Unexpected Tauri command: " + command);
      },
    },
  };
  window.__BIOS_UX_AUDIT_SCENARIO = scenario;
})();
</script>`;
}

function buildAuditAutomation(scenario) {
  return `
<script>
(() => {
  const scenario = ${JSON.stringify(scenario)};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitForButton(text, timeoutMs = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const buttons = Array.from(document.querySelectorAll("button"));
      const match = buttons.find((button) => (button.textContent || "").includes(text));
      if (match && !match.disabled) return match;
      await sleep(100);
    }
    throw new Error("Timed out waiting for button: " + text);
  }
  async function click(text) {
    const button = await waitForButton(text);
    button.click();
    await sleep(250);
  }
  async function setName(value) {
    const started = Date.now();
    while (Date.now() - started < 12000) {
      const input = document.getElementById("conv-name-input");
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      await sleep(100);
    }
    throw new Error("Timed out waiting for name input");
  }
  async function selectSurface(surface) {
    const started = Date.now();
    while (Date.now() - started < 12000) {
      const button = document.querySelector('[data-surface="' + surface + '"]');
      if (button) {
        button.click();
        return;
      }
      await sleep(100);
    }
    throw new Error("Timed out waiting for surface button: " + surface);
  }
  async function run() {
    await sleep(3200);
    if (scenario === "onboarding-discovery") return;
    await click("Import Selected");
    await sleep(700);
    if (scenario === "onboarding-model") {
      await setName("Atlas");
      await click("Confirm");
      return;
    }
    await setName("Atlas");
    await click("Confirm");
    await sleep(700);
    await click("Hybrid");
    await sleep(700);
    if (scenario === "worker-small-machine") return;
    await click("Ask me first");
    await sleep(700);
    await click("Start Working");
    await sleep(1500);
    if (scenario === "status-surface") {
      await selectSurface("status");
      await sleep(700);
    }
    if (scenario === "settings-surface") {
      await selectSurface("settings");
      await sleep(700);
    }
  }
  window.addEventListener("load", () => {
    run()
      .then(() => { document.body.setAttribute("data-ux-audit-ready", "true"); })
      .catch((error) => {
        document.body.setAttribute("data-ux-audit-error", String(error && error.message || error));
      });
  });
})();
</script>`;
}

async function serveIndex(req, res, url) {
  const scenario = url.searchParams.get("scenario") || "onboarding-discovery";
  const shouldAutoRun = url.searchParams.get("auto") !== "off";
  const source = await readFile(path.join(appRoot, "index.html"), "utf8");
  const injected = source.replace(
    '<script type="module" src="js/app.js"></script>',
    `${buildAuditPrelude(scenario)}\n<script type="module" src="js/app.js"></script>${
      shouldAutoRun ? `\n${buildAuditAutomation(scenario)}` : ""
    }`,
  );
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(injected);
}

async function serveStatic(req, res, url) {
  const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const targetPath = path.normalize(path.join(appRoot, relativePath));
  if (!targetPath.startsWith(appRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(targetPath);
    res.writeHead(200, { "Content-Type": contentTypeFor(targetPath) });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    await serveIndex(req, res, url);
    return;
  }
  await serveStatic(req, res, url);
});

server.listen(port, host, () => {
  process.stdout.write(`BIOS AI UX audit server listening on http://${host}:${port}\n`);
});
