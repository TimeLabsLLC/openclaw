import { describe, expect, it } from "vitest";
import { describeOnboardingKeyBadge, describeOnboardingTransition } from "./onboarding-flow.js";

describe("onboarding-flow", () => {
  it("describes discovery import progress", () => {
    expect(describeOnboardingTransition("discovery", "confirm")).toEqual({
      pendingLabel: "Importing...",
      progressNote: "Importing what you approved and folding it into BIOS AI setup...",
    });
  });

  it("describes restoring an existing agent", () => {
    expect(
      describeOnboardingTransition("agent-identity", "restore", { agentName: "Atlas" }),
    ).toEqual({
      pendingLabel: "Restoring...",
      progressNote: "Restoring Atlas and carrying that identity into model setup...",
    });
  });

  it("describes manual key save progress with provider context", () => {
    expect(describeOnboardingTransition("manual-key", "save-key", { provider: "openai" })).toEqual({
      pendingLabel: "Saving key...",
      progressNote: "Saving your openai key and moving into identity setup...",
    });
  });

  it("describes permission posture transition for broad authority", () => {
    expect(describeOnboardingTransition("permission-choice", "allowed")).toEqual({
      pendingLabel: "Applying authority...",
      progressNote:
        "Saving broad authority for routine actions while keeping kernel hard stops active, then preparing your final readback...",
    });
  });

  it("describes imported keys only after desktop import succeeds", () => {
    expect(describeOnboardingKeyBadge(2, "saved")).toBe("2 keys imported");
    expect(describeOnboardingKeyBadge(2, "failed")).toBe("2 keys selected");
  });
});
