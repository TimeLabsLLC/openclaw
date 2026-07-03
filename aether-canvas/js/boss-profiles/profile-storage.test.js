import { beforeEach, describe, expect, it } from "vitest";
import {
  BIOS_ACTIVE_ONBOARDING_KEY,
  BIOS_ACTIVE_PROFILE_KEY,
  biosProfileSnapshotKey,
} from "../bios-runtime.js";
import {
  clearSavedOnboardingSnapshot,
  getActiveBiosProfileId,
  getSavedOnboardingSnapshot,
  saveSavedOnboardingSnapshot,
} from "./profile-storage.js";

describe("profile-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers the active in-memory BIOS profile id over storage", () => {
    localStorage.setItem(BIOS_ACTIVE_PROFILE_KEY, "saved");
    expect(getActiveBiosProfileId(localStorage, "live")).toBe("live");
  });

  it("reads the scoped BIOS onboarding snapshot for an active BIOS profile", () => {
    localStorage.setItem(BIOS_ACTIVE_ONBOARDING_KEY, JSON.stringify({ agentName: "Global" }));
    localStorage.setItem(biosProfileSnapshotKey("claw"), JSON.stringify({ agentName: "Scoped" }));

    expect(getSavedOnboardingSnapshot(localStorage, "claw")).toEqual({ agentName: "Scoped" });
  });

  it("does not treat the global onboarding snapshot as live BOSS state when no profile is active", () => {
    localStorage.setItem(BIOS_ACTIVE_ONBOARDING_KEY, JSON.stringify({ agentName: "Global" }));

    expect(getSavedOnboardingSnapshot(localStorage, null)).toBeNull();
  });

  it("writes only the scoped BIOS onboarding snapshot for an active profile", () => {
    saveSavedOnboardingSnapshot(localStorage, { agentName: "Claw" }, "claw");

    expect(localStorage.getItem(BIOS_ACTIVE_PROFILE_KEY)).toBe("claw");
    expect(localStorage.getItem(BIOS_ACTIVE_ONBOARDING_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(biosProfileSnapshotKey("claw")))).toEqual({
      agentName: "Claw",
    });
  });

  it("does not write a global onboarding snapshot when no profile is active", () => {
    saveSavedOnboardingSnapshot(localStorage, { agentName: "Claw" }, null);

    expect(localStorage.getItem(BIOS_ACTIVE_PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(BIOS_ACTIVE_ONBOARDING_KEY)).toBeNull();
  });

  it("clears the scoped and global BIOS onboarding snapshots for the active profile", () => {
    localStorage.setItem(BIOS_ACTIVE_PROFILE_KEY, "claw");
    localStorage.setItem(BIOS_ACTIVE_ONBOARDING_KEY, JSON.stringify({ agentName: "Claw" }));
    localStorage.setItem(biosProfileSnapshotKey("claw"), JSON.stringify({ agentName: "Claw" }));

    clearSavedOnboardingSnapshot(localStorage, "claw");

    expect(localStorage.getItem(BIOS_ACTIVE_PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(BIOS_ACTIVE_ONBOARDING_KEY)).toBeNull();
    expect(localStorage.getItem(biosProfileSnapshotKey("claw"))).toBeNull();
  });
});
