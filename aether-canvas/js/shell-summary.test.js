import { describe, expect, it } from "vitest";
import {
  buildLaunchSupportTelemetry,
  buildModelChoiceGuidance,
  buildModelTelemetry,
  buildPromptEconomyTelemetry,
  describeApprovalLaneSnapshot,
  describeActivitySnapshot,
  describeModelChoiceGuidance,
  describeContinuitySnapshot,
  describeLaunchSupportTelemetry,
  describeLatestRouteDecision,
  describeLogLaneSnapshot,
  describeModelTelemetry,
  describePromptEconomyTelemetry,
  describeRecentRouteAdoption,
  describeShellLaneSnapshot,
  describeSkillTelemetry,
  describeTaskLaneSnapshot,
} from "./shell-summary.js";

describe("shell-summary", () => {
  it("summarizes route telemetry with recent adoption and savings", () => {
    expect(
      describeSkillTelemetry(
        {
          totalSkillCount: 3,
          readySkillCount: 2,
          validationBacklogCount: 1,
          promotedToolCount: 1,
          totalRouteHits: 4,
          tokenEconomySummary: "4 slow-path reasoning turns avoided",
          topRoutedSkillId: "skill-browser-open",
        },
        [
          {
            summary: "SYSTEM 1 -> tool skill_browser-open",
            taskLabel: "Open browser",
            system: 1,
            usedPromotedTool: true,
          },
          {
            summary: "SYSTEM 2 -> local evidence docs.md",
            taskLabel: "Read docs",
            system: 2,
            usedPromotedTool: false,
          },
        ],
      ),
    ).toContain("Recent adoption: 1/2 cheap-path, 1/2 tool-path");
  });

  it("summarizes tasks from the current mission checklist", () => {
    const summary = describeTaskLaneSnapshot({
      title: "Recover BIOS continuity",
      checklist: [
        { text: "Resume gateway", status: "completed" },
        { text: "Review approval queue", status: "progress" },
        { text: "Check shell telemetry", status: "pending" },
      ],
    });

    expect(summary.state).toBe("Tasks in progress");
    expect(summary.chatState).toContain("Review approval queue");
    expect(summary.copy).toContain("1 completed, 1 active, 1 pending");
  });

  it("summarizes visible activity for idle, active, background, and mission work", () => {
    expect(describeActivitySnapshot().activityLabel).toBe("READY");

    expect(
      describeActivitySnapshot({
        runInProgress: true,
        currentRunStatus: "Working on: draft the BIOS release notes",
      }),
    ).toEqual(
      expect.objectContaining({
        activityLabel: "WORKING",
        taskActivityLabel: "Working on: draft the BIOS release notes",
        state: "active",
      }),
    );

    expect(
      describeActivitySnapshot({
        pendingBackgroundStatus: "Waiting on background command: pnpm build",
      }),
    ).toEqual(
      expect.objectContaining({
        activityLabel: "BACKGROUND",
        taskActivityLabel: "Waiting on background command: pnpm build",
        state: "background",
      }),
    );

    expect(
      describeActivitySnapshot({
        activeMission: {
          title: "Recover BIOS continuity",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        activityLabel: "RECOVER BIOS CONTINUITY",
        taskActivityLabel: "RECOVER BIOS CONTINUITY",
        state: "mission",
      }),
    );
  });

  it("summarizes blocked approvals from operator records", () => {
    const summary = describeApprovalLaneSnapshot({
      activeMission: {
        reviewQueue: ["Need operator review"],
        operatorRecord: {
          approval: {
            title: "Approve browser sandbox patch",
            summary: "Executes browser sandbox recovery patch.",
            approvalScope: "tightly-scoped",
            kind: "exec",
            boundaryClass: "external_mutation",
          },
        },
      },
      activeContinuity: {
        blockedByApproval: true,
      },
    });

    expect(summary.state).toBe("Approval blocked");
    expect(summary.chatState).toContain("Approve browser sandbox patch");
    expect(summary.copy).toContain("Operator approval is required");
  });

  it("summarizes log output from evidence and recent routes", () => {
    const summary = describeLogLaneSnapshot({
      activeMission: {
        evidence: ["First evidence", "Second evidence"],
        operatorRecord: {
          evidence: ["Second evidence", "Third evidence"],
          summary: "Operator record summary",
        },
      },
      routeDecisionHistory: [
        { summary: "SYSTEM 1 -> tool skill_browser-open", taskLabel: "Open browser" },
      ],
    });

    expect(summary.state).toBe("Log active");
    expect(summary.chatState).toContain("3 evidence lines");
    expect(summary.copy).toContain("Latest route:");
    expect(summary.copy).toContain("Third evidence");
  });

  it("summarizes continuity with gateway and tool telemetry", () => {
    const summary = describeContinuitySnapshot({
      activeMission: { title: "Recover BIOS continuity" },
      activeContinuity: {
        lifecycle: "waiting_for_approval",
        recoveryAction: "await_approval",
        health: "needs_review",
        blockedByApproval: true,
        stale: false,
      },
      gatewayConnected: true,
      skillTelemetry: {
        totalSkillCount: 1,
        readySkillCount: 1,
        validationBacklogCount: 0,
        promotedToolCount: 1,
        totalRouteHits: 2,
        tokenEconomySummary: "2 slow-path reasoning turns avoided",
        topRoutedSkillId: "browser-open",
        topPromotedToolName: "skill_browser-open",
      },
      modelTelemetry: {
        summary: "Hybrid model posture: 1 local model, 1 hosted provider ready.",
      },
      routeDecisionHistory: [
        {
          summary: "SYSTEM 1 -> tool skill_browser-open",
          taskLabel: "Open browser",
          system: 1,
          usedPromotedTool: true,
        },
      ],
    });

    expect(summary.memoryTag).toBe("Approval blocked");
    expect(summary.statusTag).toBe("Approval blocked");
    expect(summary.statusCopy).toContain("Online services connected.");
    expect(summary.statusCopy).toContain("Lead tool: skill_browser-open.");
    expect(summary.statusCopy).toContain("Hybrid model posture:");
  });

  it("summarizes shell onboarding posture from connection and persona state", () => {
    const summary = describeShellLaneSnapshot({
      gatewayConnected: true,
      agentName: "Hermes",
      hasCalibratedAgentName: true,
      autonomousMode: true,
      modelTelemetry: {
        summary:
          "Hosted model posture: 2 providers ready, 1 BYOK/token provider, 1 OAuth provider.",
      },
      launchSupportTelemetry: {
        summary: "Last packaged launch succeeded in 42s.",
      },
    });

    expect(summary.state).toBe("Shell synced");
    expect(summary.chatState).toBe("Persona: Hermes");
    expect(summary.copy).toContain("Persona calibrated as Hermes.");
    expect(summary.copy).toContain("Autonomous mode enabled.");
    expect(summary.copy).toContain("Hosted model posture:");
    expect(summary.copy).toContain("Last packaged launch succeeded in 42s.");
  });

  it("builds a hybrid model posture summary from local and hosted sources", () => {
    const telemetry = buildModelTelemetry({
      models: [
        { id: "llama3", name: "Llama 3", provider: "ollama" },
        { id: "gpt-5.4", name: "GPT-5.4", provider: "openai-codex" },
      ],
      authStatus: {
        providers: [
          {
            provider: "openai-codex",
            displayName: "OpenAI Codex",
            status: "ok",
            profiles: [{ profileId: "openai:default", type: "oauth", status: "ok" }],
          },
          {
            provider: "anthropic",
            displayName: "Anthropic",
            status: "missing",
            profiles: [],
          },
        ],
      },
    });

    expect(telemetry).toEqual(
      expect.objectContaining({
        localModelCount: 1,
        hostedModelCount: 1,
        readyProviderCount: 1,
        blockedProviderCount: 1,
      }),
    );
    expect(describeModelTelemetry(telemetry)).toContain("Hybrid model posture");
  });

  it("derives actionable model-choice guidance from packaged and runtime posture", () => {
    const guidance = buildModelChoiceGuidance({
      modelTelemetry: {
        localModelCount: 1,
        hostedModelCount: 1,
        readyProviderCount: 1,
        byokProviderCount: 1,
        oauthProviderCount: 0,
      },
      launchSupportTelemetry: {
        modelPosture: "hybrid",
      },
    });

    expect(guidance).toEqual(
      expect.objectContaining({
        mode: "hybrid",
        configuredPosture: "hybrid",
      }),
    );
    expect(describeModelChoiceGuidance(guidance)).toContain("Hybrid model choice validated");
  });

  it("summarizes packaged launcher support posture from the persisted launch artifact", () => {
    const telemetry = buildLaunchSupportTelemetry({
      available: true,
      launch: {
        status: "ok",
        durationMs: 42000,
        openedBrowser: false,
        hasGatewayToken: true,
        logPath: "E:/launcher/gateway.log",
        support: {
          settings: { configExists: true },
          updates: { strategy: "manual-electron-builder" },
          models: { posture: "hybrid" },
        },
      },
    });

    expect(telemetry).toEqual(
      expect.objectContaining({
        available: true,
        status: "ok",
        settingsConfigured: true,
        updateStrategy: "manual-electron-builder",
        modelPosture: "hybrid",
        durationSeconds: 42,
      }),
    );
    expect(describeLaunchSupportTelemetry(telemetry)).toContain(
      "Last packaged launch succeeded in 42s.",
    );
  });

  it("summarizes prompt economy from the active session token snapshot", () => {
    const telemetry = buildPromptEconomyTelemetry({
      inputTokens: 1200,
      outputTokens: 300,
      totalTokens: 1800,
      totalTokensFresh: true,
      contextTokens: 4000,
      cacheRead: 600,
      cacheWrite: 0,
      model: "gpt-5.4",
      modelProvider: "openai-codex",
    });

    expect(telemetry).toEqual(
      expect.objectContaining({
        totalTokens: 1800,
        contextTokens: 4000,
        percentUsed: 45,
        cacheHitRate: 33,
        totalTokensFresh: true,
      }),
    );
    expect(describePromptEconomyTelemetry(telemetry)).toContain("Prompt economy:");
    expect(describePromptEconomyTelemetry(telemetry)).toContain("Cache hit 33%.");
  });

  it("describes the latest route decision directly from history", () => {
    expect(
      describeLatestRouteDecision([
        { summary: "SYSTEM 2 -> local evidence README.md", taskLabel: "Read docs" },
      ]),
    ).toBe("Latest route: SYSTEM 2 -> local evidence README.md for Read docs.");
    expect(describeRecentRouteAdoption([])).toBe("");
  });
});
