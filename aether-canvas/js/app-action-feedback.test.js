import { describe, expect, it } from "vitest";
import {
  describeApprovalAction,
  describeBootstrapAction,
  describeChatAction,
  describeForgeArenaAction,
  describeSessionAction,
  describeSettingsProviderAction,
  describeSkillAction,
  describeTelemetryLoad,
  describeWorkflowAction,
} from "./app-action-feedback.js";

describe("app-action-feedback", () => {
  it("describes provider switch and model save transitions", () => {
    expect(describeSettingsProviderAction("switch-pending", { provider: "openai" })).toBe(
      "Switching BIOS AI to openai...",
    );
    expect(describeSettingsProviderAction("model-success", { model: "gpt-5.4" })).toBe(
      "Model preference saved: gpt-5.4.",
    );
  });

  it("describes provider key failures with detail", () => {
    expect(
      describeSettingsProviderAction("key-error", {
        provider: "anthropic",
        detail: "disk full",
      }),
    ).toBe("Provider key save failed: disk full");
  });

  it("describes approval resolution states", () => {
    expect(describeApprovalAction("approve-pending", { title: "browser sandbox patch" })).toBe(
      "Approving browser sandbox patch...",
    );
    expect(describeApprovalAction("reject-success", { title: "browser sandbox patch" })).toBe(
      "browser sandbox patch rejected. BIOS AI will wait for the next direction.",
    );
  });

  it("describes Forge Arena action states", () => {
    expect(describeForgeArenaAction("feature-pending", { sessionKey: "agent:main:main" })).toBe(
      "Featuring run for agent:main:main...",
    );
    expect(
      describeForgeArenaAction("pair-success", { title: "Challenge One", runId: "run-1" }),
    ).toBe("Paired Challenge One to run-1.");
    expect(
      describeForgeArenaAction("challenge-create-success", {
        title: "Launch check",
        scoringRule: "balanced",
        scoreBonus: 4,
        resultSummary: "Visible result",
      }),
    ).toBe('Challenge "Launch check" created with balanced scoring (+4) and a result summary.');
  });

  it("describes workflow action states", () => {
    expect(describeWorkflowAction("deploy-pending", { title: "Deploy Pipeline" })).toBe(
      "Queuing Deploy Pipeline through BIOS AI...",
    );
    expect(
      describeWorkflowAction("discovery-success", {
        keyCount: 2,
        modelCount: 1,
        toolCount: 3,
        agentFound: true,
      }),
    ).toBe("Discovery found 2 keys, 1 local model, 3 tools, and an existing agent profile.");
  });

  it("describes session and checkpoint action states", () => {
    expect(describeSessionAction("switch-pending", { name: "Conversation 2" })).toBe(
      "Switching to conversation: Conversation 2...",
    );
    expect(
      describeSessionAction("resume-success", {
        stepIndex: 3,
        lifecycle: "waiting for approval",
      }),
    ).toBe("Workflow resumed at step 3. waiting for approval continuity recovered.");
  });

  it("describes skill card and chat send states", () => {
    expect(
      describeSkillAction("validate-pending", {
        skillId: "skill-browser-open",
      }),
    ).toBe("Validating observed skill: skill-browser-open...");
    expect(
      describeChatAction("local-no-key", {
        provider: "OpenAI",
      }),
    ).toBe("No OpenAI key is configured. Add one in Settings to continue.");
  });

  it("describes bootstrap and telemetry load states", () => {
    expect(describeBootstrapAction("start", { agentName: "BIOS AI" })).toBe("Starting BIOS AI...");
    expect(describeBootstrapAction("hydrate-step", { step: "Memory" })).toBe("Loading Memory...");
    expect(describeBootstrapAction("offline-local", { agentName: "BIOS AI" })).toBe(
      "BIOS AI is ready for local work while online services reconnect.",
    );
    expect(describeTelemetryLoad("pending", { surface: "Prompt Economy" })).toBe(
      "Loading Prompt Economy...",
    );
    expect(
      describeTelemetryLoad("error", { surface: "Memory", detail: "gateway unavailable" }),
    ).toBe("Memory unavailable: gateway unavailable");
  });
});
