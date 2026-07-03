import {
  BIOS_DEFAULT_SAFETY_POSTURE,
  BIOS_DEFAULT_SANDBOX_BACKEND,
  formatBiosProfileReadiness,
  formatBiosProfileRouteLabel,
  formatBiosRuntimeEngineLabel,
  formatBiosRuntimeOwnerLabel,
  formatBiosRuntimeStrategyLabel,
} from "./bios-runtime.js";

export function buildBiosProfilePickerSummary(profile) {
  return `${formatBiosProfileRouteLabel(profile.model_pref)} - ${formatBiosProfileReadiness(profile)}`;
}

export function buildBiosProfilePickerMetaLines(profile) {
  return [
    {
      text: `${profile.safety_posture_label || BIOS_DEFAULT_SAFETY_POSTURE} - ${profile.sandbox_backend || BIOS_DEFAULT_SANDBOX_BACKEND}`,
      color: "#94a3b8",
    },
    {
      text: `${formatBiosRuntimeOwnerLabel(profile.local_runtime_owner)} - ${formatBiosRuntimeEngineLabel(profile.local_runtime_engine)}`,
      color: "#94a3b8",
    },
    {
      text: formatBiosRuntimeStrategyLabel(profile.local_runtime_strategy),
      color: "#64748b",
    },
  ];
}

export function buildBiosProfileStatusLabel(profiles, activeProfile) {
  if (!profiles.length) {
    return "Create a BOSS profile through onboarding to save it here.";
  }
  const countLabel = `${profiles.length} saved BOSS profile${profiles.length === 1 ? "" : "s"}`;
  if (!activeProfile) {
    return countLabel;
  }
  return `${countLabel} - ${activeProfile.safety_posture_label || BIOS_DEFAULT_SAFETY_POSTURE} - ${formatBiosProfileRouteLabel(activeProfile.model_pref)}`;
}

export function buildBiosProfileOverviewTitle(activeProfile) {
  return activeProfile
    ? `${activeProfile.display_name} settings`
    : "BIOS AI profile and model settings";
}

export function buildBiosProfileOverviewCopy(activeProfile) {
  return activeProfile
    ? `Manage ${activeProfile.display_name}'s safety, model route, keys, and connections from here.`
    : "Manage BOSS profiles, models, safety, keys, and connections from here.";
}

export function buildBiosProfileDangerCopy(activeProfile, profileCount = 0) {
  const profileName = activeProfile?.display_name || "this BOSS profile";
  const deletingLastProfile = Number(profileCount || 0) <= 1;
  return deletingLastProfile
    ? `Danger Area: deleting ${profileName} permanently removes its BIOS-owned profile workspace, saved setup, routing choices, provider wiring, local worker selection, and runtime state. It does not delete unrelated soul, memory, or user files outside this BIOS profile. BIOS AI will reopen onboarding after deletion.`
    : `Danger Area: deleting ${profileName} permanently removes only this BIOS-owned profile workspace, saved setup, routing choices, provider wiring, local worker selection, and runtime state. Other BOSS profiles and unrelated user files stay untouched.`;
}

export function buildBiosProfileDeleteConfirmation(activeProfile, profileCount = 0) {
  const profileName = activeProfile?.display_name || "this BOSS profile";
  const deletingLastProfile = Number(profileCount || 0) <= 1;
  return deletingLastProfile
    ? `Delete ${profileName}? This permanently removes only its BIOS-owned profile workspace, saved setup, routing choices, provider wiring, local worker selection, and runtime state. It does not delete unrelated soul, memory, or user files outside this BIOS profile. BIOS AI will reopen fresh onboarding.`
    : `Delete ${profileName}? This permanently removes only its BIOS-owned profile workspace, saved setup, routing choices, provider wiring, local worker selection, and runtime state. Other BOSS profiles and unrelated user files stay untouched.`;
}
