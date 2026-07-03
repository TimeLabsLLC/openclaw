import { formatWorkerLabel } from "./onboarding-worker-ui.js";

function buildKeysSummary(apiKeys) {
  return apiKeys.length > 0
    ? apiKeys
        .map((key) => {
          const source = String(key.source || "").trim();
          const sourceLabel =
            source === "env"
              ? "environment"
              : source === "manual"
                ? "manual entry"
                : source || "saved source";
          return `${key.provider} (${key.masked_value} from ${sourceLabel})`;
        })
        .join(", ")
    : "none configured - add one in Settings";
}

function buildLocalRuntimeLabel(result) {
  return result.modelPref === "commercial"
    ? ""
    : result.localRuntimeOwner === "BIOS AI"
      ? "BIOS AI managed local runtime"
      : result.localRuntimeEngine || "External local runtime";
}

function buildLocalWorkerSummary(result) {
  if (result.modelPref === "commercial") {
    return "";
  }
  return result.localWorkerModelVariant
    ? `${formatWorkerLabel(result.localWorkerModelVariant)} as the starting BOSS brain`
    : result.localWorkerDownloadStatus === "skipped"
      ? "BOSS brain download skipped for now"
      : result.localWorkerDownloadStatus === "failed"
        ? "BOSS brain setup needs attention"
        : result.localWorkerDownloadStatus === "installed-needs-verification"
          ? "BOSS brain is installed; local route verification is still pending"
          : result.localWorkerDownloadStatus === "installed"
            ? "Starting BOSS brain is already installed"
            : "BOSS brain is not configured yet";
}

function hasUsableCloudRoute(result) {
  return Array.isArray(result?.apiKeys)
    ? result.apiKeys.some((key) => {
        const provider = String(key?.provider || "")
          .trim()
          .toLowerCase();
        return provider && provider !== "lmstudio" && provider !== "ollama";
      })
    : false;
}

function buildLocalRouteDetail(result) {
  if (result.localRuntimeOwner === "BIOS AI") {
    const workerLabel = formatWorkerLabel(result.localWorkerModelVariant);
    if (result.localWorkerDownloadStatus === "installed-needs-verification" && workerLabel) {
      return `${workerLabel} is installed, but the BIOS AI managed llama.cpp runtime still needs to verify before chat unlocks.`;
    }
    if (workerLabel) {
      return `${workerLabel} on the BIOS AI managed llama.cpp runtime.`;
    }
    return "BIOS AI managed llama.cpp runtime is selected, but the starting BOSS brain still needs to be chosen.";
  }
  if (result.preferredLocalBackend || result.localRuntimeEngine) {
    return `${result.localRuntimeEngine || "External local runtime"} was verified during onboarding.`;
  }
  return "A local runtime still needs to be wired for this BOSS profile.";
}

export function buildOnboardingRouteReadinessSnapshot(result) {
  const cloudReady = hasUsableCloudRoute(result);
  const localReady =
    result.localRuntimeOwner === "BIOS AI"
      ? Boolean(result.localWorkerModelVariant) &&
        ["completed", "installed"].includes(result.localWorkerDownloadStatus)
      : Boolean(result.preferredLocalBackend || result.localRuntimeEngine);

  if (result.modelPref === "commercial") {
    return {
      headline: cloudReady ? "Cloud BOSS route is ready." : "Cloud BOSS route still needs a key.",
      detail: cloudReady
        ? "BIOS AI can start on the saved cloud route as soon as the shell wakes up."
        : "Add a usable cloud key before BIOS AI can start on a cloud route.",
    };
  }

  if (result.modelPref === "hybrid") {
    if (localReady && cloudReady) {
      return {
        headline: "Hybrid route is ready.",
        detail: `${buildLocalRouteDetail(result)} Cloud help is also available later when BIOS AI decides it is worth using.`,
      };
    }
    if (localReady) {
      return {
        headline: "Local route is ready now; cloud help can be added later.",
        detail: buildLocalRouteDetail(result),
      };
    }
    if (cloudReady) {
      return {
        headline: "Cloud route is ready now; local help still needs setup.",
        detail:
          "BIOS AI can start on the cloud route now and you can add the local lane later in Settings.",
      };
    }
    return {
      headline: "Hybrid route is not ready yet.",
      detail:
        "BIOS AI still needs either a verified local brain or a usable cloud key before this hybrid rule can wake up cleanly.",
    };
  }

  return {
    headline: localReady ? "Local-only route is ready." : "Local-only route still needs setup.",
    detail: buildLocalRouteDetail(result),
  };
}

export function buildOnboardingSummarySnapshot({ modelChoice, permissionChoice, apiKeys }) {
  const modelEcho =
    modelChoice === "commercial" ? "Cloud BOSS" : modelChoice === "local" ? "Local only" : "Hybrid";
  const modelSelectionNote =
    modelChoice === "hybrid"
      ? "BIOS AI can keep everyday work local while still reaching for cloud help when a harder task needs it."
      : modelChoice === "local"
        ? "Your starting BOSS brain stays on this machine."
        : "Your starting BOSS brain will use the cloud route behind your API key.";
  const modeLabel =
    permissionChoice === "allowed"
      ? "Broad authority, with kernel hard stops still active"
      : "Ask before actions that affect your system";
  const modelLabel =
    modelChoice === "commercial"
      ? "Cloud BOSS"
      : modelChoice === "local"
        ? "Local-only BOSS"
        : "Hybrid";

  return {
    modelEcho,
    modelSelectionNote,
    modeLabel,
    modelLabel,
    keysSummary: buildKeysSummary(apiKeys),
  };
}

export function buildOnboardingReadbackSnapshot(result, permissionChoice) {
  const summary = buildOnboardingSummarySnapshot({
    modelChoice: result.modelPref,
    permissionChoice,
    apiKeys: result.apiKeys,
  });
  const routeReadiness = buildOnboardingRouteReadinessSnapshot(result);

  return {
    ...summary,
    localRuntimeLabel: buildLocalRuntimeLabel(result),
    localWorkerLabel: buildLocalWorkerSummary(result),
    routeReadinessHeadline: routeReadiness.headline,
    routeReadinessDetail: routeReadiness.detail,
  };
}
