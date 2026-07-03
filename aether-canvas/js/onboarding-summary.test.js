import { describe, expect, it } from "vitest";
import {
  buildOnboardingReadbackSnapshot,
  buildOnboardingSummarySnapshot,
} from "./onboarding-summary.js";

describe("onboarding-summary", () => {
  it("builds a local-only onboarding summary", () => {
    expect(
      buildOnboardingSummarySnapshot({
        modelChoice: "local",
        permissionChoice: "not_allowed",
        apiKeys: [],
      }),
    ).toEqual({
      modelEcho: "Local only",
      modelSelectionNote: "Your starting BOSS brain stays on this machine.",
      modeLabel: "Ask before actions that affect your system",
      modelLabel: "Local-only BOSS",
      keysSummary: "none configured - add one in Settings",
    });
  });

  it("builds a cloud summary with imported keys and provenance", () => {
    const snapshot = buildOnboardingSummarySnapshot({
      modelChoice: "commercial",
      permissionChoice: "allowed",
      apiKeys: [
        { provider: "openai", masked_value: "sk-...123", source: "env" },
        { provider: "anthropic", masked_value: "sk-...456", source: "manual" },
      ],
    });

    expect(snapshot.modelEcho).toBe("Cloud BOSS");
    expect(snapshot.modelSelectionNote).toContain("cloud route");
    expect(snapshot.modeLabel).toContain("Broad authority");
    expect(snapshot.modelLabel).toBe("Cloud BOSS");
    expect(snapshot.keysSummary).toBe(
      "openai (sk-...123 from environment), anthropic (sk-...456 from manual entry)",
    );
  });

  it("builds local runtime and worker readback labels", () => {
    const snapshot = buildOnboardingReadbackSnapshot(
      {
        modelPref: "local",
        localRuntimeOwner: "BIOS AI",
        localRuntimeEngine: "llama.cpp",
        localWorkerModelVariant: "gemma-3-4b",
        localWorkerDownloadStatus: "completed",
        apiKeys: [],
      },
      "allowed",
    );

    expect(snapshot.localRuntimeLabel).toBe("BIOS AI managed local runtime");
    expect(snapshot.localWorkerLabel).toBe("Gemma 3 4B as the starting BOSS brain");
    expect(snapshot.modeLabel).toContain("Broad authority");
    expect(snapshot.routeReadinessHeadline).toBe("Local-only route is ready.");
    expect(snapshot.routeReadinessDetail).toContain("BIOS AI managed llama.cpp runtime");
  });
});
