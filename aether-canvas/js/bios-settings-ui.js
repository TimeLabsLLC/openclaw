import {
  BIOS_DEFAULT_SAFETY_POSTURE,
  BIOS_DEFAULT_SANDBOX_BACKEND,
  formatBiosRuntimeEngineLabel,
  formatBiosRuntimeOwnerLabel,
  formatBiosRuntimeStrategyLabel,
} from "./bios-runtime.js";

export function buildBiosSettingsSnapshot({ saved, activeProfile }) {
  return {
    postureLabel: saved.permissionMode === "allowed" ? "Broad authority" : "Ask me first",
    safetyPostureLabel: customerSettingsCopy(saved.safetyPostureLabel || BIOS_DEFAULT_SAFETY_POSTURE),
    executionModeLabel: customerSettingsCopy(saved.executionMode || "Protected first"),
    sandboxBackendLabel: customerSettingsCopy(saved.sandboxBackend || BIOS_DEFAULT_SANDBOX_BACKEND),
    toolCreationLabel: customerSettingsCopy(
      saved.toolCreationPolicy || "Check new tools before using them",
    ),
    networkPostureLabel: customerSettingsCopy(saved.networkPosture || "Limit internet for unknown work"),
    hostAccessLabel: customerSettingsCopy(saved.hostAccess || "Ask before changing this computer"),
    promotionPolicyLabel: customerSettingsCopy(
      saved.promotionPolicy || "Review and confirm before applying changes",
    ),
    activeProfileSafetyLabel:
      customerSettingsCopy(
        activeProfile?.safety_posture_label ||
          saved.safetyPostureLabel ||
          BIOS_DEFAULT_SAFETY_POSTURE,
      ),
    runtimeOwnerLabel: customerSettingsCopy(
      formatBiosRuntimeOwnerLabel(activeProfile?.local_runtime_owner || saved.localRuntimeOwner),
    ),
    runtimeEngineLabel: customerSettingsCopy(
      formatBiosRuntimeEngineLabel(activeProfile?.local_runtime_engine || saved.localRuntimeEngine),
    ),
    runtimeStrategyLabel: customerSettingsCopy(
      formatBiosRuntimeStrategyLabel(
        activeProfile?.local_runtime_strategy || saved.localRuntimeStrategy,
      ),
    ),
  };
}

function customerSettingsCopy(value) {
  return String(value ?? "")
    .replace(/Native boxed-lane hardened/gi, "Protected by default")
    .replace(/GPU-first local BOSS runtime/gi, "GPU-first local model")
    .replace(/BIOS-managed local runtime/gi, "BIOS AI local models")
    .replace(/native boxed lane/gi, "Protected workspace")
    .replace(/boxed-lane/gi, "protected workspace")
    .replace(/boxed lane/gi, "protected workspace")
    .replace(/Sandbox-first/gi, "Protected first")
    .replace(/Build and test in sandbox first/gi, "Check new tools before using them")
    .replace(/Prefer sandbox-only network for untrusted work/gi, "Limit internet for unknown work")
    .replace(/Promotion required before host writes/gi, "Ask before changing this computer")
    .replace(/Approval and validation before host adoption/gi, "Review and confirm before applying changes")
    .replace(/host adoption/gi, "computer changes")
    .replace(/host writes/gi, "computer changes")
    .replace(/promotion/gi, "approval");
}
