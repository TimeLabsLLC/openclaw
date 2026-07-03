import { invokeBiosSidecarCommand, isBiosSidecarCommand } from "./bios-sidecar.mjs";

const proofProfileId = process.env.BIOS_AI_ELECTRON_PROOF_PROFILE_ID || "proof-boss";
const proofBossName = process.env.BIOS_AI_ELECTRON_PROOF_PROFILE_NAME || "Proof BOSS";
const profileMode = process.env.BIOS_AI_ELECTRON_PROOF_PROFILE_MODE || "returning";

const profile = {
  id: proofProfileId,
  boss_name: proofBossName,
  display_name: proofBossName,
  route_mode: "local_only",
  model_pref: "local",
  safety_posture_label: "Protected by default",
  sandbox_backend: "Protected workspace",
  local_runtime_owner: "BIOS AI",
  local_runtime_engine: "llama.cpp",
  local_runtime_strategy: "GPU-first local BOSS runtime",
  local_worker_model_variant: "gemma-3-1b",
  local_worker_download_status: "installed",
  worker_model: "gemma-3-1b",
  local_worker_ready: true,
  safety_posture: "protected_by_default",
};

let activeProfileId = null;

function profilesEnabled() {
  return profileMode !== "none";
}

function profileDetail(profileId = profile.id) {
  const id = profileId || profile.id;
  return {
    profile: {
      ...profile,
      id,
      completed: true,
    },
    onboarding: {
      completed: true,
      agentName: profile.display_name,
      agent_name: profile.display_name,
      modelPref: "local",
      model_pref: "local",
      permissionMode: "ask_first",
      permission_mode: "ask_first",
      preferredLocalBackend: "bios-ai-managed-runtime",
      preferred_local_backend: "bios-ai-managed-runtime",
      localRuntimeOwner: "BIOS AI",
      local_runtime_owner: "BIOS AI",
      localRuntimeEngine: "llama.cpp",
      local_runtime_engine: "llama.cpp",
      localRuntimeStrategy: "GPU-first local BOSS runtime",
      local_runtime_strategy: "GPU-first local BOSS runtime",
      localWorkerModelVariant: profile.worker_model,
      local_worker_model_variant: profile.worker_model,
      localWorkerDownloadStatus: "installed",
      local_worker_download_status: "installed",
      biosWorkerRoster: [
        {
          role: "boss_brain",
          variant: profile.worker_model,
        },
      ],
      bios_worker_roster: [
        {
          role: "boss_brain",
          variant: profile.worker_model,
        },
      ],
      safetyPostureLabel: "Protected by default",
      safety_posture_label: "Protected by default",
      executionMode: "Protected first",
      execution_mode: "Protected first",
      sandboxBackend: "Protected workspace",
      sandbox_backend: "Protected workspace",
    },
  };
}

export async function invokeElectronShellSpikeCommand(command, payload = {}) {
  if (isBiosSidecarCommand(command)) {
    return invokeBiosSidecarCommand(command, payload);
  }

  switch (command) {
    case "list_bios_profiles":
      return {
        profiles: profilesEnabled() ? [profile] : [],
        active_profile_id: activeProfileId,
      };
    case "load_bios_profile":
      if (!profilesEnabled()) {
        return null;
      }
      return profileDetail(payload?.profileId || payload?.profile_id || payload?.id || profile.id);
    case "set_active_bios_profile":
      if (!profilesEnabled()) {
        activeProfileId = null;
        return null;
      }
      activeProfileId = payload?.profileId || payload?.profile_id || payload?.id || profile.id;
      return profileDetail(activeProfileId);
    case "load_forge_arena_local_state":
      return {
        active_profile: { arena_name: "B.A.Bs", identity_state: "electron_shell_spike" },
        current_run: {
          status: "fixture",
          completed: 0,
          total: 0,
          summary: "Forge data bridge loads; real arena state remains native-service backed.",
        },
      };
    case "run_forge_arena_boss_proving_round":
      return {
        status: "blocked_in_spike",
        reason: "Native BOSS runtime sidecar is required before Electron shell can run arena proof.",
      };
    case "worker_assets_status":
      return { status: "native_sidecar_required", shell: "electron-spike" };
    case "worker_model_catalog":
      return { models: [], status: "native_sidecar_required" };
    case "load_bios_local_connector_status":
      return {
        profile_id: payload?.profileId || payload?.profile_id || activeProfileId || null,
        connectors: [],
        status: "native_sidecar_required",
      };
    case "bios_local_tool_registry":
      return {
        tools: [],
        status: "native_sidecar_required",
      };
    case "load_provider_config":
      return { route: "local_only", shell: "electron-spike" };
    case "save_provider_config":
      return { saved: false, status: "blocked_in_spike" };
    case "append_debug_log":
      return {
        accepted: true,
        persisted: false,
        status: "non_mutating_spike_ack",
        note: "Electron shell spike accepts renderer diagnostics without host mutation until the sidecar log service owns persistence.",
      };
    default:
      throw new Error(`Unsupported Electron shell spike command: ${command}`);
  }
}
