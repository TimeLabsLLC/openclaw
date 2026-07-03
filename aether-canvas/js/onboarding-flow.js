function normalizeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function describeOnboardingTransition(step, choice, context = {}) {
  const agentName = normalizeText(context.agentName, "your agent");
  const provider = normalizeText(context.provider, "this key");
  const backend =
    choice === "bios-managed" || choice === "bios-worker"
      ? "BIOS AI Managed Runtime (llama.cpp)"
      : choice === "lmstudio"
      ? "LM Studio"
      : choice === "ollama"
        ? "Ollama"
        : normalizeText(context.backend, "this local backend");

  switch (step) {
    case "discovery":
      return choice === "confirm"
        ? {
            pendingLabel: "Importing...",
            progressNote: "Importing what you approved and folding it into BIOS AI setup...",
          }
        : {
            pendingLabel: "Skipping...",
            progressNote: "Skipping discovery imports and continuing with a clean manual setup...",
          };
    case "primary-key":
      if (choice === "bios-managed" || choice === "bios-worker" || choice === "lmstudio" || choice === "ollama") {
        return {
          pendingLabel:
            choice === "bios-managed" || choice === "bios-worker"
              ? "Using managed runtime..."
              : "Using local backend...",
          progressNote: `Making ${backend} the local starting path for ${agentName}, then moving into identity setup...`,
        };
      }
      return {
        pendingLabel: "Using key...",
        progressNote: `Setting ${provider} as the main hosted route and moving into identity setup...`,
      };
    case "manual-key":
      return choice === "save-key"
        ? {
            pendingLabel: "Saving key...",
            progressNote: `Saving your ${provider} key and moving into identity setup...`,
          }
        : {
            pendingLabel: "Skipping for now...",
            progressNote:
              "Continuing without a provider key for now. You can add one later in Settings.",
          };
    case "agent-identity":
      return choice === "restore"
        ? {
            pendingLabel: "Restoring...",
            progressNote: `Restoring ${agentName} and carrying that identity into model setup...`,
          }
        : {
            pendingLabel: "Starting fresh...",
            progressNote: "Clearing the recovered identity and moving into fresh naming...",
          };
    case "agent-name":
      return {
        pendingLabel: "Locking name...",
        progressNote: `Saving ${agentName} as your BOSS name and moving into runtime setup...`,
      };
    case "model-choice":
      if (choice === "local") {
        return {
          pendingLabel: "Saving route...",
          progressNote: "Keeping BIOS AI local-first on this machine and moving into runtime checks...",
        };
      }
      if (choice === "hybrid") {
        return {
          pendingLabel: "Saving route...",
          progressNote: "Setting BIOS AI to use both local and cloud routes and moving into runtime checks...",
        };
      }
      return {
        pendingLabel: "Saving route...",
        progressNote: "Setting BIOS AI to use a hosted model for main reasoning and moving into authority setup...",
      };
    case "permission-choice":
      return choice === "allowed"
        ? {
            pendingLabel: "Applying authority...",
            progressNote:
              "Saving broad authority for routine actions while keeping kernel hard stops active, then preparing your final readback...",
          }
        : {
            pendingLabel: "Applying authority...",
            progressNote:
              "Keeping ask-first approval for actions that affect your system, then preparing your final readback...",
          };
    default:
      return {
        pendingLabel: "Working...",
        progressNote: "Applying your selection...",
      };
  }
}

export function describeOnboardingKeyBadge(keyCount, providerImportStatus) {
  const count = Number.isFinite(keyCount) ? Math.max(0, Math.trunc(keyCount)) : 0;
  if (count === 0) {
    return "No keys configured";
  }
  const noun = `${count} key${count === 1 ? "" : "s"}`;
  return providerImportStatus === "saved" ? `${noun} imported` : `${noun} selected`;
}
