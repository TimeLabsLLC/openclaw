import { describe, expect, it } from "vitest";
import { buildBiosSettingsSnapshot } from "./bios-settings-ui.js";

describe("buildBiosSettingsSnapshot", () => {
  it("builds saved-setting labels with active profile overrides", () => {
    const snapshot = buildBiosSettingsSnapshot({
      saved: {
        permissionMode: "allowed",
        safetyPostureLabel: "LXC-first hardened",
        executionMode: "Sandbox-first",
        sandboxBackend: "LXC",
        toolCreationPolicy: "Build and test in sandbox first",
        networkPosture: "Prefer sandbox-only network for untrusted work",
        hostAccess: "Promotion required before host writes",
        promotionPolicy: "Approval and validation before host adoption",
        localRuntimeOwner: "BIOS AI",
        localRuntimeEngine: "llama.cpp",
        localRuntimeStrategy: "BIOS-managed local runtime",
      },
      activeProfile: {
        safety_posture_label: "LXC-first hardened",
        local_runtime_owner: "bios-ai",
        local_runtime_engine: "llama.cpp",
        local_runtime_strategy: "BIOS-managed local runtime",
      },
    });

    expect(snapshot.postureLabel).toBe("Broad authority");
    expect(snapshot.safetyPostureLabel).toBe("LXC-first hardened");
    expect(snapshot.executionModeLabel).toBe("Sandbox-first");
    expect(snapshot.sandboxBackendLabel).toBe("LXC");
    expect(snapshot.toolCreationLabel).toBe("Build and test in sandbox first");
    expect(snapshot.networkPostureLabel).toBe("Prefer sandbox-only network for untrusted work");
    expect(snapshot.hostAccessLabel).toBe("Promotion required before host writes");
    expect(snapshot.promotionPolicyLabel).toBe("Approval and validation before host adoption");
    expect(snapshot.activeProfileSafetyLabel).toBe("LXC-first hardened");
    expect(snapshot.runtimeOwnerLabel).toBe("BIOS AI");
    expect(snapshot.runtimeEngineLabel).toBe("llama.cpp");
    expect(snapshot.runtimeStrategyLabel).toBe("BIOS-managed local runtime");
  });
});
