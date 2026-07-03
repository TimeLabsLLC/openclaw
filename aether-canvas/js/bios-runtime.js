import {
  loadBiosShellContract,
  readBiosRuntimeStatusFromContract,
} from "./native-contracts/bios-shell-contract.js";

export const DIRECT_LOCAL_LLM_PROVIDERS = new Set(["lmstudio", "ollama"]);
export const MANAGED_LOCAL_RUNTIME_PROVIDER = "bios-managed";
export const MANAGED_LOCAL_RUNTIME_ENGINE = "llama.cpp";
export const LOCAL_RUNTIME_PROVIDERS = new Set([
  ...DIRECT_LOCAL_LLM_PROVIDERS,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
]);
export const NON_LLM_PROVIDERS = new Set(["github-copilot", "github", "telegram", "unknown"]);
export const BIOS_ACTIVE_PROFILE_KEY = "bios-ai-active-profile";
export const BIOS_ACTIVE_ONBOARDING_KEY = "bios-ai-onboarding";
export const BIOS_DEFAULT_SAFETY_POSTURE = "Protected by default";
export const BIOS_DEFAULT_SANDBOX_BACKEND = "Protected workspace";

function getTauriInvoke() {
  return window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null;
}

export function biosProfileSnapshotKey(profileId) {
  return profileId ? `bios-ai-onboarding:${profileId}` : BIOS_ACTIVE_ONBOARDING_KEY;
}

export function isUsableDirectLlmProvider(provider) {
  return Boolean(provider) && !NON_LLM_PROVIDERS.has(provider);
}

export function buildSavedLocalBackendRoute(savedOnboarding) {
  const provider = savedOnboarding?.preferredLocalBackend;
  if (!DIRECT_LOCAL_LLM_PROVIDERS.has(provider)) {
    return null;
  }
  return {
    provider,
    model: "",
  };
}

export function formatSavedLocalBackend(backend) {
  if (backend === MANAGED_LOCAL_RUNTIME_PROVIDER) {
    return "BIOS AI local models";
  }
  return backend === "lmstudio" ? "LM Studio" : backend === "ollama" ? "Ollama" : "";
}

export function formatBiosRuntimeOwnerLabel(owner) {
  if (!owner) {
    return "Not assigned";
  }
  return owner === "bios-ai" ? "BIOS AI" : owner;
}

export function formatBiosRuntimeEngineLabel(engine) {
  if (!engine) {
    return "Not assigned";
  }
  return engine === "llama.cpp" ? "llama.cpp" : engine;
}

export function formatBiosRuntimeStrategyLabel(strategy) {
  if (!strategy) {
    return "Not assigned";
  }
  return String(strategy)
    .replace(/GPU-first local BOSS runtime/gi, "GPU-first local model")
    .replace(/BIOS-managed local runtime/gi, "BIOS AI local models")
    .replace(/owned managed runtime/gi, "BIOS AI local models")
    .replace(/runtime/gi, "model system");
}

export function formatBiosProfileRouteLabel(modelPref) {
  if (modelPref === "hybrid") {
    return "Hybrid";
  }
  if (modelPref === "local") {
    return "Local only";
  }
  if (modelPref === "commercial") {
    return "Cloud route";
  }
  return "Choose route";
}

export function formatBiosProfileReadiness(profile) {
  if (!profile?.completed) {
    return "Setup in progress";
  }
  if (profile.model_pref === "local") {
    return profile.local_worker_ready ? "Local route ready" : "Local route needs worker";
  }
  if (profile.model_pref === "hybrid") {
    return profile.local_worker_ready ? "Hybrid route ready" : "Hybrid route needs local worker";
  }
  return "Cloud route ready";
}

export function defaultSafetyPostureSnapshot(overrides = {}) {
  return {
    safetyPostureLabel: BIOS_DEFAULT_SAFETY_POSTURE,
    executionMode: "Protected first",
    sandboxBackend: BIOS_DEFAULT_SANDBOX_BACKEND,
    toolCreationPolicy: "Check new tools before using them",
    networkPosture: "Limit internet for unknown work",
    hostAccess: "Ask before changing this computer",
    promotionPolicy: "Review and confirm before applying changes",
    ...overrides,
  };
}

export function hasSavedCloudRoute(savedOnboarding) {
  return Boolean(
    savedOnboarding?.apiKeys?.some(
      (key) =>
        isUsableDirectLlmProvider(key?.provider) &&
        !DIRECT_LOCAL_LLM_PROVIDERS.has(key?.provider) &&
        key?.key,
    ),
  );
}

export async function loadWorkerAssetsStatusSafe(profileId = null) {
  try {
    const tauriInvoke = getTauriInvoke();
    if (typeof tauriInvoke !== "function") {
      return null;
    }
    return await tauriInvoke("worker_assets_status", { profileId });
  } catch (err) {
    console.warn("[BIOS AI] Worker asset status unavailable during bootstrap:", err);
    return null;
  }
}

export async function loadWorkerModelCatalogSafe(profileId = null) {
  try {
    const tauriInvoke = getTauriInvoke();
    if (typeof tauriInvoke !== "function") {
      return null;
    }
    return await tauriInvoke("worker_model_catalog", { profileId });
  } catch (err) {
    console.warn("[BIOS AI] Worker model catalog unavailable during bootstrap:", err);
    return null;
  }
}

export async function installManagedWorkerModelSafe({
  variant,
  profileId = null,
  onProgress = null,
  pollDelayMs = 1000,
  maxAttempts = 720,
} = {}) {
  const tauriInvoke = getTauriInvoke();
  if (typeof tauriInvoke !== "function" || !variant) {
    return null;
  }
  if (!String(profileId || "").trim()) {
    throw new Error("Create or resume a BIOS profile before installing a BIOS AI managed worker.");
  }

  const emitProgress = (download, assetsStatus = null) => {
    if (typeof onProgress === "function") {
      onProgress(download, assetsStatus);
    }
  };

  const initialDownload = await tauriInvoke("start_worker_model_download", {
    variant,
    profileId,
  });
  emitProgress(initialDownload, null);

  if (!initialDownload || initialDownload.state !== "downloading") {
    return {
      download: initialDownload,
      assetsStatus: await loadWorkerAssetsStatusSafe(profileId),
    };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    const assetsStatus = await loadWorkerAssetsStatusSafe(profileId);
    const download = assetsStatus?.download || null;
    emitProgress(download, assetsStatus);
    if (!download || download.state !== "downloading") {
      return {
        download,
        assetsStatus,
      };
    }
  }

  return {
    download: {
      state: "failed",
      error: "Worker model download timed out.",
    },
    assetsStatus: await loadWorkerAssetsStatusSafe(profileId),
  };
}

export async function installAllManagedWorkerModelsSafe({
  profileId = null,
  onProgress = null,
  pollDelayMs = 1000,
  maxAttempts = 86400,
} = {}) {
  const tauriInvoke = getTauriInvoke();
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  if (!String(profileId || "").trim()) {
    throw new Error("Create or resume a BIOS profile before downloading BIOS AI managed workers.");
  }

  const emitProgress = (downloadQueue, assetsStatus = null) => {
    if (typeof onProgress === "function") {
      onProgress(downloadQueue, assetsStatus);
    }
  };

  const initialQueue = await tauriInvoke("start_all_worker_model_downloads", { profileId });
  emitProgress(initialQueue, null);
  if (!initialQueue || initialQueue.state !== "running") {
    return {
      downloadQueue: initialQueue,
      assetsStatus: await loadWorkerAssetsStatusSafe(profileId),
    };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    const assetsStatus = await loadWorkerAssetsStatusSafe(profileId);
    const downloadQueue = assetsStatus?.download_queue || null;
    emitProgress(downloadQueue, assetsStatus);
    if (!downloadQueue || downloadQueue.state !== "running") {
      return {
        downloadQueue,
        assetsStatus,
      };
    }
  }

  return {
    downloadQueue: {
      state: "failed",
      error: "Managed worker catalog download timed out.",
    },
    assetsStatus: await loadWorkerAssetsStatusSafe(profileId),
  };
}

export async function savedWorkerRouteIsInstalled(savedOnboarding, profileId = null) {
  const variant = savedOnboarding?.localWorkerModelVariant;
  const downloadStatus = savedOnboarding?.localWorkerDownloadStatus;
  if (!variant || (downloadStatus !== "completed" && downloadStatus !== "installed")) {
    return false;
  }
  const assetsStatus = await loadWorkerAssetsStatusSafe(profileId);
  return Boolean(assetsStatus?.installed_models?.some((model) => model?.variant === variant));
}

export async function savedDirectLocalBackendIsReachable(savedOnboarding, profileId = null) {
  const provider = savedOnboarding?.preferredLocalBackend;
  if (!DIRECT_LOCAL_LLM_PROVIDERS.has(provider)) {
    return false;
  }
  const tauriInvoke = getTauriInvoke();
  if (typeof tauriInvoke !== "function") {
    return false;
  }
  try {
    const probe = await tauriInvoke("probe_local_runtime", {
      provider,
      model: null,
      profileId,
    });
    return Boolean(probe?.reachable);
  } catch {
    return false;
  }
}

export async function savedOnboardingRouteIsRunnable(savedOnboarding, profileId = null) {
  if (!savedOnboarding?.completed || !savedOnboarding?.agentName) {
    return false;
  }

  try {
    const tauriInvoke = getTauriInvoke();
    if (typeof tauriInvoke === "function") {
      const contract = await loadBiosShellContract(tauriInvoke, profileId);
      const runtimeStatus = readBiosRuntimeStatusFromContract(contract);
      if (typeof runtimeStatus?.route_ready === "boolean") {
        return Boolean(runtimeStatus.route_ready);
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function appendBiosDebugLog(event, details = null) {
  try {
    const tauriInvoke = getTauriInvoke();
    if (typeof tauriInvoke === "function") {
      await tauriInvoke("append_debug_log", {
        event,
        details:
          details === null || details === undefined
            ? ""
            : typeof details === "string"
              ? details
              : JSON.stringify(details),
      });
    }
  } catch (err) {
    console.warn("[BIOS AI Debug Log] append failed:", err);
  }
}

export async function recordBiosProofEventSafe({
  profileId = null,
  eventType,
  source,
  summary,
  tags = [],
  visibility = "private",
  payloadRedacted = null,
} = {}) {
  try {
    const tauriInvoke = getTauriInvoke();
    const resolvedProfileId = String(profileId || "").trim();
    if (typeof tauriInvoke !== "function" || !resolvedProfileId) {
      return null;
    }
    return await tauriInvoke("record_bios_proof_event", {
      input: {
        profile_id: resolvedProfileId,
        event_type: eventType,
        source,
        summary,
        tags: Array.isArray(tags) ? tags : [],
        visibility,
        payload_redacted: payloadRedacted,
      },
    });
  } catch (err) {
    console.warn("[BIOS AI Proof Spine] record failed:", err);
    return null;
  }
}
