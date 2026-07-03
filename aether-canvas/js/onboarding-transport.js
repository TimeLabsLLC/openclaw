export async function loadOnboardingWorkerAssetsStatus(tauriInvoke, profileId = null) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  try {
    return await tauriInvoke("worker_assets_status", { profileId });
  } catch (err) {
    console.warn("[Onboarding] Worker asset status unavailable:", err);
    return null;
  }
}

export async function loadOnboardingWorkerModelCatalog(tauriInvoke, profileId = null) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  try {
    return await tauriInvoke("worker_model_catalog", { profileId });
  } catch (err) {
    console.warn("[Onboarding] Worker model catalog unavailable:", err);
    return null;
  }
}

export async function saveOnboardingWorkerRuntimeSelection(
  tauriInvoke,
  variant,
  profileId = null,
) {
  if (typeof tauriInvoke !== "function" || !variant) {
    return null;
  }
  try {
    return await tauriInvoke("save_worker_runtime_selection", {
      variant,
      profileId,
    });
  } catch (err) {
    console.warn("[Onboarding] Failed to save worker runtime selection:", err);
    return null;
  }
}

export async function registerOnboardingExternalWorkerModel(
  tauriInvoke,
  path,
  profileId = null,
) {
  if (typeof tauriInvoke !== "function" || !path) {
    return null;
  }
  try {
    return await tauriInvoke("register_external_worker_model", {
      path,
      profileId,
    });
  } catch (err) {
    console.warn("[Onboarding] Failed to register external GGUF model:", err);
    throw err;
  }
}

export async function loadOnboardingWorkerStorageStatus(tauriInvoke, profileId = null) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  try {
    return await tauriInvoke("worker_storage_status", { profileId });
  } catch (err) {
    console.warn("[Onboarding] Worker storage status unavailable:", err);
    return null;
  }
}

export async function saveOnboardingWorkerStorageLocation(tauriInvoke, path, profileId = null) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  try {
    return await tauriInvoke("save_worker_storage_location", {
      path: path || null,
      profileId,
    });
  } catch (err) {
    console.warn("[Onboarding] Failed to save worker storage location:", err);
    return null;
  }
}

export async function probeOnboardingLocalRuntime(
  tauriInvoke,
  provider,
  model = "",
  profileId = null,
) {
  if (typeof tauriInvoke !== "function" || !provider) {
    return null;
  }
  return tauriInvoke("probe_local_runtime", {
    provider,
    model: model || null,
    profileId,
  });
}

export async function pollOnboardingWorkerDownload({
  delay,
  loadWorkerAssetsStatus,
  maxAttempts = 720,
  timeoutState = "failed",
  timeoutError = "Worker model download timed out.",
} = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await delay(1000);
    const status = await loadWorkerAssetsStatus();
    const download = status?.download;
    if (!download) {
      return { state: "failed", error: "Worker download status is unavailable." };
    }
    if (download.state !== "downloading") {
      return download;
    }
  }
  return { state: timeoutState, error: timeoutError };
}
