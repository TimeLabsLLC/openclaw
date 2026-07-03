import { describe, expect, it } from "vitest";
import { buildOnboardingRouteChoiceSnapshot } from "./onboarding-route-copy.js";

describe("onboarding-route-copy", () => {
  it("describes route choices with exact local model guidance", () => {
    const snapshot = buildOnboardingRouteChoiceSnapshot({
      machineProfile: {
        logical_cores: 20,
        total_memory_gb: 32,
      },
      hasCloudKey: true,
      cloudProvider: "openai",
      hasSelectedLocalModels: true,
      hasInstalledWorkerModels: false,
      preferredLocalBackend: null,
      defaultModel: "hybrid",
    });

    expect(snapshot.intro).toContain("allowed to think");
    expect(snapshot.helper).toContain("does not lock one model forever");
    expect(snapshot.notices.join(" ")).toContain("local model inventory");
    expect(snapshot.options.find((option) => option.value === "commercial")?.description).toContain(
      "Openai",
    );
    expect(snapshot.options.find((option) => option.value === "local")?.description).toContain(
      "Qwen3 8B",
    );
    expect(snapshot.options.find((option) => option.value === "hybrid")?.description).toContain(
      "Gemma 3 4B",
    );
  });
});
