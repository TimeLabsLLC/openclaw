import {
  BIOS_ACTIVE_ONBOARDING_KEY,
  BIOS_ACTIVE_PROFILE_KEY,
  biosProfileSnapshotKey,
} from "../bios-runtime.js";

export function getActiveBiosProfileId(storage, activeBiosProfileId) {
  if (activeBiosProfileId) {
    return activeBiosProfileId;
  }
  try {
    return storage.getItem(BIOS_ACTIVE_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function getSavedOnboardingSnapshot(storage, profileId) {
  try {
    if (!profileId) {
      return null;
    }
    const scoped = storage.getItem(biosProfileSnapshotKey(profileId));
    return scoped ? JSON.parse(scoped) : null;
  } catch {
    return null;
  }
}

export function saveSavedOnboardingSnapshot(storage, snapshot, profileId) {
  try {
    if (!profileId) {
      storage.removeItem(BIOS_ACTIVE_ONBOARDING_KEY);
      return;
    }
    storage.setItem(BIOS_ACTIVE_PROFILE_KEY, profileId);
    storage.setItem(biosProfileSnapshotKey(profileId), JSON.stringify(snapshot));
    storage.removeItem(BIOS_ACTIVE_ONBOARDING_KEY);
  } catch {
    /* localStorage not available */
  }
}

export function clearSavedOnboardingSnapshot(storage, profileId) {
  try {
    if (profileId) {
      storage.removeItem(biosProfileSnapshotKey(profileId));
    }
    storage.removeItem(BIOS_ACTIVE_ONBOARDING_KEY);
    if (!profileId || storage.getItem(BIOS_ACTIVE_PROFILE_KEY) === profileId) {
      storage.removeItem(BIOS_ACTIVE_PROFILE_KEY);
    }
  } catch {
    /* localStorage not available */
  }
}
