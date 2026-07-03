import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createWorkflowDom() {
  document.body.innerHTML = `
    <div class="workflow-card glass" id="wf-deploy-pipeline">
      <div class="workflow-card-header"><div class="workflow-card-info"><span class="badge badge-success">Ready</span></div></div>
      <button class="btn btn-primary workflow-run-btn" type="button">Run</button>
    </div>
    <div class="workflow-card glass" id="wf-nightly-cleanup">
      <div class="workflow-card-header"><div class="workflow-card-info"><span class="badge badge-accent">Scheduled</span></div></div>
      <button class="btn btn-ghost workflow-run-btn" type="button">Run Now</button>
    </div>
    <div class="workflow-card glass" id="wf-first-run-discovery">
      <div class="workflow-card-header"><div class="workflow-card-info"><span class="badge badge-warning">On Boot</span></div></div>
      <button class="btn btn-ghost workflow-run-btn" type="button">Re-scan</button>
    </div>
  `;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AetherApp workflow actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.__TAURI__ = { core: { invoke: vi.fn() } };
  });

  it("queues the deploy workflow through BIOS AI with visible pending and success states", async () => {
    createWorkflowDom();
    let releaseSend;
    const app = {
      applyShellSurface: vi.fn(),
      sendChatMessage: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseSend = resolve;
          }),
      ),
    };

    AetherApp.prototype.setupWorkflowActions.call(app);

    const card = document.getElementById("wf-deploy-pipeline");
    const button = card.querySelector(".workflow-run-btn");
    const badge = card.querySelector(".badge");
    const status = card.querySelector(".workflow-card-status");

    button.click();
    await flushMicrotasks();

    expect(button.innerText).toBe("Queuing...");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(badge.innerText).toBe("Queued");
    expect(status.innerText).toBe("Queuing Deploy Pipeline through BIOS AI...");
    expect(app.applyShellSurface).toHaveBeenCalledWith("tasks");

    releaseSend(true);
    await flushMicrotasks();

    expect(button.innerText).toBe("Run");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(status.innerText).toBe(
      "Deploy Pipeline handed to BIOS AI. Watch Tasks and Approvals for the live run.",
    );
  });

  it("shows cleanup workflow failure feedback when BIOS AI cannot queue it", async () => {
    createWorkflowDom();
    const app = {
      applyShellSurface: vi.fn(),
      sendChatMessage: vi.fn().mockResolvedValue(false),
    };

    AetherApp.prototype.setupWorkflowActions.call(app);

    const card = document.getElementById("wf-nightly-cleanup");
    const button = card.querySelector(".workflow-run-btn");
    const status = card.querySelector(".workflow-card-status");

    button.click();
    await flushMicrotasks();

    expect(button.innerText).toBe("Run Now");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(status.innerText).toBe(
      "Nightly Cleanup failed to queue: Nightly Cleanup could not be queued right now.",
    );
  });

  it("rescans first-run discovery and surfaces the found counts", async () => {
    createWorkflowDom();
    window.__TAURI__.core.invoke.mockResolvedValue({
      api_keys: [{ provider: "openai" }, { provider: "anthropic" }],
      local_models: [{ model_id: "gemma" }],
      ai_tools: [{ tool: "Cursor" }, { tool: "VS Code" }],
      agent_identity: { name: "Atlas" },
    });
    const app = {
      applyShellSurface: vi.fn(),
      sendChatMessage: vi.fn(),
    };

    AetherApp.prototype.setupWorkflowActions.call(app);

    const card = document.getElementById("wf-first-run-discovery");
    const button = card.querySelector(".workflow-run-btn");
    const badge = card.querySelector(".badge");
    const status = card.querySelector(".workflow-card-status");

    button.click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(badge.innerText).toBe("Scanned");
    expect(button.innerText).toBe("Re-scan");
    expect(status.innerText).toBe(
      "Discovery found 2 keys, 1 local model, 2 tools, and an existing agent profile.",
    );
  });
});
