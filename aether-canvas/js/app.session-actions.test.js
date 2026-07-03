import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createSessionDom() {
  document.body.innerHTML = `<div id="session-tabs-container"></div>`;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AetherApp session actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });

  it("shows pending and success states while switching sessions from the tabs", async () => {
    createSessionDom();
    let releaseHistory;
    const app = {
      sessionActionPending: false,
      sessions: [
        { key: "agent:main:main", name: "Main Canvas" },
        { key: "agent:main:two", name: "Conversation 2" },
      ],
      activeSessionKey: "agent:main:main",
      saveSessionsToStore: vi.fn(),
      chat: { clear: vi.fn() },
      subtitles: { update: vi.fn() },
      gateway: { isConnected: true },
      loadSessionHistory: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseHistory = resolve;
          }),
      ),
      loadSessionMission: vi.fn().mockResolvedValue(undefined),
      refreshForgeArenaFeed: vi.fn().mockResolvedValue(undefined),
    };
    app.renderSessionTabs = AetherApp.prototype.renderSessionTabs.bind(app);
    app.switchSession = AetherApp.prototype.switchSession.bind(app);

    app.renderSessionTabs();

    const tabs = Array.from(document.querySelectorAll(".session-tab"));
    const secondTab = tabs.find((tab) => tab.getAttribute("data-session-key") === "agent:main:two");
    secondTab.click();
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenCalledWith(
      "Switching to conversation: Conversation 2...",
    );
    expect(app.sessionActionPending).toBe(true);
    expect(document.querySelector(".session-tab-close").disabled).toBe(true);

    releaseHistory();
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "Switched to conversation: Conversation 2.",
    );
    expect(app.sessionActionPending).toBe(false);
  });

  it("shows pending and success states while creating a session", async () => {
    createSessionDom();
    let releaseHistory;
    const app = {
      sessionActionPending: false,
      sessions: [{ key: "agent:main:main", name: "Main Canvas" }],
      activeSessionKey: "agent:main:main",
      saveSessionsToStore: vi.fn(),
      renderSessionTabs: vi.fn(),
      chat: { clear: vi.fn() },
      subtitles: { update: vi.fn() },
      gateway: { isConnected: true },
      loadSessionHistory: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseHistory = resolve;
          }),
      ),
      refreshForgeArenaFeed: vi.fn().mockResolvedValue(undefined),
    };

    const createPromise = AetherApp.prototype.createSession.call(app);
    await flushMicrotasks();

    const newName = app.sessions[1]?.name;
    expect(app.subtitles.update).toHaveBeenCalledWith(`Creating new conversation: ${newName}...`);
    expect(app.sessionActionPending).toBe(true);
    expect(app.chat.clear).toHaveBeenCalled();

    releaseHistory();
    await createPromise;

    expect(app.subtitles.update).toHaveBeenLastCalledWith(`Created new conversation: ${newName}.`);
    expect(app.sessionActionPending).toBe(false);
  });

  it("shows pending and success states while resuming a workflow checkpoint", async () => {
    const app = {
      subtitles: { update: vi.fn() },
      hudActionState: {
        skills: new Map(),
        checkpoints: new Map(),
      },
      refreshHudData: vi.fn(),
      gateway: {
        request: vi.fn().mockResolvedValue({
          checkpoint: {
            stepIndex: 4,
            continuity: { lifecycle: "waiting_for_approval" },
          },
          continuity: { lifecycle: "waiting_for_approval" },
        }),
      },
      switchSession: vi.fn().mockResolvedValue(true),
      formatContinuityLabel: (value) => String(value).replaceAll("_", " "),
    };

    await AetherApp.prototype.resumeWorkflowCheckpoint.call(app, "agent:checkpoint:1");

    expect(app.subtitles.update).toHaveBeenNthCalledWith(
      1,
      "Resuming workflow checkpoint for: agent:checkpoint:1...",
    );
    expect(app.switchSession).toHaveBeenCalledWith("agent:checkpoint:1");
    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "Workflow resumed at step 4. waiting for approval continuity recovered.",
    );
  });

  it("shows pending and success states while deleting a session", async () => {
    createSessionDom();
    let releaseHistory;
    const app = {
      sessionActionPending: false,
      sessions: [
        { key: "agent:main:main", name: "Main Canvas" },
        { key: "agent:main:two", name: "Conversation 2" },
      ],
      activeSessionKey: "agent:main:two",
      saveSessionsToStore: vi.fn(),
      renderSessionTabs: vi.fn(),
      chat: { clear: vi.fn() },
      subtitles: { update: vi.fn() },
      gateway: { isConnected: true },
      loadSessionHistory: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseHistory = resolve;
          }),
      ),
      refreshForgeArenaFeed: vi.fn().mockResolvedValue(undefined),
    };

    const deletePromise = AetherApp.prototype.deleteSession.call(app, "agent:main:two");
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenCalledWith("Deleting conversation: Conversation 2...");
    expect(app.sessionActionPending).toBe(true);

    releaseHistory();
    await deletePromise;

    expect(app.subtitles.update).toHaveBeenLastCalledWith("Deleted conversation: Conversation 2.");
    expect(app.sessionActionPending).toBe(false);
  });
});
