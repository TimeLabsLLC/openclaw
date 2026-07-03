import { describe, expect, it } from "vitest";
import { buildSavedShellState } from "./bios-shell-state.js";

describe("buildSavedShellState", () => {
  it("builds a local-only managed-runtime shell snapshot", () => {
    const state = buildSavedShellState({
      rawSaved: {
        completed: true,
        agentName: "Claw",
        permissionMode: "ask",
        modelPref: "local",
        safetyPostureLabel: "LXC-first hardened",
        sandboxBackend: "LXC",
        localRuntimeStrategy: "BIOS-managed local runtime",
        preferredLocalBackend: "bios-managed",
        localWorkerModelVariant: "gemma-3-4b",
        localWorkerDownloadStatus: "completed",
        apiKeys: [],
      },
      activeProfileName: "Claw",
      runtimeStatus: null,
      gatewayConnected: false,
    });

    expect(state.routeModeLabel).toBe("Local only");
    expect(state.settingsLocalWorker).toContain("BIOS AI Managed Runtime");
    expect(state.routeReadinessLabel).toBe("Runtime check needed");
    expect(state.shellModelStatus).toBe("Gemma 3 4B");
    expect(state.workerShellLabel).toContain("BIOS AI Managed Runtime");
    expect(state.gatewayStatusLabel).toBe("Offline shell");
    expect(state.forgeStatusLabel).toBe("Local Arena available");
    expect(state.agentState).toBe("Checking runtime");
    expect(state.viewportSnapshot.kicker).toBe("Offline shell");
    expect(state.viewportSnapshot.routeLabel).toBe("Route: local only");
    expect(state.viewportSnapshot.authorityLabel).toBe("Authority: ask first");
    expect(state.viewportSnapshot.readinessLabel).toBe("Runtime check needed");
    expect(state.viewportSnapshot.nextActionLabel).toBe(
      "Wait for BIOS AI to verify the saved runtime route before chat.",
    );
    expect(state.viewportSnapshot.workerLabel).toContain("BIOS AI Managed Runtime");
    expect(state.viewportSnapshot.title).toBe("Verifying BIOS AI runtime");
    expect(state.shellNote).toContain("has not verified the active route yet");
  });

  it("prefers runtime truth when the runtime is available", () => {
    const state = buildSavedShellState({
      rawSaved: {
        completed: true,
        agentName: "Claw",
        permissionMode: "allowed",
        modelPref: "hybrid",
        safetyPostureLabel: "LXC-first hardened",
        sandboxBackend: "LXC",
        localRuntimeStrategy: "Connected existing local backend",
        preferredLocalBackend: "ollama",
        apiKeys: [{ provider: "openai" }],
      },
      activeProfileName: "Claw",
      runtimeStatus: {
        route_ready: false,
        route_status_label: "Needs local worker",
        route_mode_label: "Hybrid",
        route_detail: "Managed worker is not installed.",
        next_step: "Install a local worker.",
        preferred_local_backend: "bios-managed",
        worker_status_label: "Local worker pending",
        local_backend_detail: "Ollama detected",
      },
      gatewayConnected: true,
    });

    expect(state.routeModeLabel).toBe("Hybrid");
    expect(state.settingsLocalWorker).toBe("Local worker pending");
    expect(state.routeReadinessLabel).toBe("Needs local worker");
    expect(state.shellModelStatus).toBe("Hybrid");
    expect(state.workerShellLabel).toBe("Local worker pending");
    expect(state.shellNote).toContain("Managed worker is not installed. Install a local worker.");
    expect(state.shellNote).toContain("memory");
    expect(state.gatewayStatusLabel).toBe("Connected");
    expect(state.forgeStatusLabel).toBe("Gateway feed pending; local Arena available");
    expect(state.agentState).toBe("Needs setup");
    expect(state.viewportSnapshot.title).toBe("Finish setup to activate BIOS AI");
    expect(state.viewportSnapshot.routeLabel).toBe("Route: hybrid");
    expect(state.viewportSnapshot.authorityLabel).toBe("Authority: broad");
    expect(state.viewportSnapshot.nextActionLabel).toBe("Install a local worker.");
    expect(state.viewportSnapshot.workerLabel).toBe("Local worker pending");
  });

  it("does not treat an installed-but-unverified managed worker as chat ready", () => {
    const state = buildSavedShellState({
      rawSaved: {
        completed: false,
        agentName: "Claw",
        permissionMode: "ask",
        modelPref: "local",
        preferredLocalBackend: "bios-managed",
        localRuntimeOwner: "BIOS AI",
        localWorkerModelVariant: "qwen-3-14b",
        localWorkerDownloadStatus: "installed-needs-verification",
        apiKeys: [],
      },
      activeProfileName: "Claw",
      runtimeStatus: null,
      gatewayConnected: false,
    });

    expect(state.settingsLocalWorker).toContain("BIOS AI Managed Runtime");
    expect(state.shellModelStatus).toBe("Qwen3 14B");
    expect(state.routeReadinessLabel).toBe("Needs local worker");
    expect(state.viewportSnapshot.nextActionLabel).toBe(
      "Install a BIOS AI managed local worker before the first chat.",
    );
    expect(state.agentState).toBe("Onboarding");
  });

  it("uses the preferred cloud provider when the saved snapshot has not refreshed its key list yet", () => {
    const state = buildSavedShellState({
      rawSaved: {
        completed: true,
        agentName: "Claw",
        permissionMode: "allowed",
        modelPref: "commercial",
        preferredCloudProvider: "openai",
        apiKeys: [],
      },
      activeProfileName: "Claw",
      runtimeStatus: null,
      gatewayConnected: false,
    });

    expect(state.shellModelStatus).toBe("Cloud · openai");
    expect(state.routeReadinessLabel).toBe("Runtime check needed");
  });

  it("does not label a missing profile route as Cloud BOSS", () => {
    const state = buildSavedShellState({
      rawSaved: {
        completed: false,
        agentName: "Claw",
        permissionMode: "ask",
        apiKeys: [],
      },
      activeProfileName: "Claw",
      runtimeStatus: null,
      gatewayConnected: false,
    });

    expect(state.routeModeLabel).toBe("Choose route");
    expect(state.shellModelStatus).toBe("Choose route");
    expect(state.routeReadinessLabel).toBe("Choose BOSS route");
    expect(state.viewportSnapshot.routeLabel).toBe("Route: choose route");
    expect(state.shellNote).toContain("Choose a BOSS route");
  });
});
