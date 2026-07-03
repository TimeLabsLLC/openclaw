import { describe, expect, it } from "vitest";
import {
  buildBiosProfileDangerCopy,
  buildBiosProfileDeleteConfirmation,
  buildBiosProfilePickerSummary,
  buildBiosProfileStatusLabel,
} from "./bios-profile-ui.js";

describe("bios-profile-ui", () => {
  it("summarizes profile route and readiness without mojibake separators", () => {
    const summary = buildBiosProfilePickerSummary({
      model_pref: "local",
      local_worker_ready: true,
    });

    expect(summary).toContain("Local only");
    expect(summary).toContain(" - ");
    expect(summary).not.toContain("Ã");
  });

  it("keeps multi-profile status readable with native boxed-lane defaults", () => {
    const label = buildBiosProfileStatusLabel([{ id: "claw" }, { id: "ember" }], {
      display_name: "Claw",
      model_pref: "hybrid",
    });

    expect(label).toBe("2 saved BOSS profiles - Native boxed-lane hardened - Hybrid");
  });

  it("explains last-profile deletion without threatening unrelated files", () => {
    const activeProfile = { display_name: "Claw" };

    expect(buildBiosProfileDangerCopy(activeProfile, 1)).toContain(
      "It does not delete unrelated soul, memory, or user files outside this BIOS profile.",
    );
    expect(buildBiosProfileDeleteConfirmation(activeProfile, 1)).toContain(
      "BIOS AI will reopen fresh onboarding.",
    );
  });

  it("explains multi-profile deletion keeps other profiles untouched", () => {
    const activeProfile = { display_name: "Ember" };

    expect(buildBiosProfileDangerCopy(activeProfile, 2)).toContain(
      "Other BOSS profiles and unrelated user files stay untouched.",
    );
    expect(buildBiosProfileDeleteConfirmation(activeProfile, 2)).toContain(
      "Other BOSS profiles and unrelated user files stay untouched.",
    );
  });
});
