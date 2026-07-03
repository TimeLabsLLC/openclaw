import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadBiosRuntimeStatusSurface,
  loadOnboardingStateSurface,
  renderBiosRuntimeStatusSurface,
} from "./controller.js";

describe("runtime-status controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="settings-doctor-summary"></div>
      <div id="settings-boxed-lane-queue"></div>
      <div id="settings-promotion-record"></div>
      <div id="settings-boxed-lane-events"></div>
      <div id="settings-recovery-status"></div>
      <div id="settings-diagnostics-headline"></div>
      <div id="settings-diagnostics-summary"></div>
      <div id="settings-diagnostics-issues"></div>
      <div id="settings-diagnostics-groups"></div>
      <div id="settings-diagnostics-actions"></div>
      <div id="settings-diagnostics-still-works"></div>
      <div id="settings-diagnostics-support-summary"></div>
    `;
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command) => {
          if (command === "bios_shell_contract") {
            return {
              profile_id: "claw",
              profile: {
                id: "claw",
                display_name: "Claw",
              },
              onboarding: {
                completed: true,
                agent_name: "Claw",
                model_pref: "local",
                preferred_local_backend: "bios-managed",
              },
              runtime: {
                route_ready: true,
                route_status_label: "Local route ready",
                worker_ready: true,
                worker_status_label: "Managed worker ready",
                boxed_lane_ready: true,
                doctor_summary: "ready",
                debug_log_path: "C:/bios/debug.log",
              },
              diagnostics: {
                doctor_summary: "ready",
                debug_log_path: "C:/bios/debug.log",
              },
              sandbox_state: {
                queue_summary: "1 queued boxed-lane artifact | 0 blocked | 1 approved",
                latest_decision_label: "Build artifact | approved",
                latest_event_label: "promotion_approved | Validation passed",
                queue: [],
              },
            };
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };
  });

  it("hydrates onboarding state from the native BIOS shell contract", async () => {
    const app = {
      activeBiosProfileId: "claw",
      gateway: {
        request: vi.fn(async () => {
          throw new Error("gateway onboarding should not be used");
        }),
      },
      showOnboardingModal: vi.fn(),
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
    };

    const onboarding = await loadOnboardingStateSurface(app);

    expect(onboarding.agentName).toBe("Claw");
    expect(app.gateway.request).not.toHaveBeenCalled();
    expect(app.updateAgentNameDOM).toHaveBeenCalled();
    expect(app.syncSavedOnboardingSnapshot).toHaveBeenCalled();
  });

  it("hydrates runtime truth from the native BIOS shell contract", async () => {
    const order = [];
    const app = {
      activeBiosProfileId: "claw",
      biosProfiles: [{ id: "claw", display_name: "Claw" }],
      tickBiosBrainstem: vi.fn(async () => {
        order.push("brainstem");
      }),
      getSavedOnboardingSnapshot: vi.fn().mockReturnValue({
        completed: true,
        agentName: "Claw",
        modelPref: "local",
      }),
      setStatusValue: vi.fn(),
      renderViewportIdleCompanion: vi.fn(),
      renderBiosRuntimeStatus(status) {
        order.push("render");
        return this.__render(status);
      },
    };
    app.__render = renderBiosRuntimeStatusSurface.bind(null, app);

    const status = await loadBiosRuntimeStatusSurface(app);

    expect(app.tickBiosBrainstem).toHaveBeenCalledWith({ allowDream: true });
    expect(order).toEqual(["brainstem", "render"]);
    expect(status.route_ready).toBe(true);
    expect(status.worker_ready).toBe(true);
    expect(document.getElementById("settings-diagnostics-headline").innerText).toBe(
      "Claw is ready",
    );
    expect(document.getElementById("settings-diagnostics-still-works").innerHTML).toContain(
      "main chat route is available",
    );
    expect(document.getElementById("settings-diagnostics-support-summary").innerText).toContain(
      "0 active recovery item",
    );
  });

  it("can hydrate runtime truth without ticking brainstem when an owner flow already ticked it", async () => {
    const app = {
      activeBiosProfileId: "claw",
      biosProfiles: [{ id: "claw", display_name: "Claw" }],
      tickBiosBrainstem: vi.fn(async () => {
        throw new Error("brainstem should not tick twice");
      }),
      getSavedOnboardingSnapshot: vi.fn().mockReturnValue({
        completed: true,
        agentName: "Claw",
        modelPref: "local",
      }),
      setStatusValue: vi.fn(),
      renderViewportIdleCompanion: vi.fn(),
      renderBiosRuntimeStatus(status) {
        return this.__render(status);
      },
    };
    app.__render = renderBiosRuntimeStatusSurface.bind(null, app);

    const status = await loadBiosRuntimeStatusSurface(app, { tickBrainstem: false });

    expect(app.tickBiosBrainstem).not.toHaveBeenCalled();
    expect(status.route_ready).toBe(true);
  });

  it("records the boxed-lane startup safety gate without invoking native repair", async () => {
    const invoke = vi.fn(async (command) => {
      if (command === "bios_shell_contract") {
        return {
          profile_id: "claw",
          profile: { id: "claw", display_name: "Claw" },
          onboarding: { completed: true, agent_name: "Claw", model_pref: "local" },
          runtime: {
            route_ready: true,
            route_status_label: "Local route ready",
            worker_ready: true,
            worker_status_label: "Managed worker ready",
            boxed_lane_ready: false,
            boxed_lane_provisioning: {
              install_state: "needs_linux_distro",
              safe_to_run_untrusted_work: false,
            },
            doctor_summary: "boxed lane needs substrate",
            debug_log_path: "C:/bios/debug.log",
          },
          boxed_lane: {
            substrate_ready: false,
            worker_lane_ready: true,
            state_label: "Managed worker ready; boxed substrate still needs setup",
            substrate_label: "Windows boxed lane needs managed distro",
            worker_status_label: "Managed worker ready",
            note: "BOSS repair is queued.",
            safety_summary: "Native boxed-lane hardened.",
            provisioning: {
              install_state: "needs_linux_distro",
              safe_to_run_untrusted_work: false,
            },
          },
          promotion: {
            state_label: "Promotion gate waiting on boxed proof",
            summary: "Promotion required before host writes",
          },
          sandbox_state: { queue: [] },
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    window.__TAURI__.core.invoke = invoke;

    const app = {
      activeBiosProfileId: "claw",
      biosProfiles: [{ id: "claw", display_name: "Claw" }],
      tickBiosBrainstem: vi.fn(),
      getSavedOnboardingSnapshot: vi.fn(),
      setStatusValue: vi.fn(),
      renderViewportIdleCompanion: vi.fn(),
      renderBiosRuntimeStatus(status) {
        return this.__render(status);
      },
    };
    app.__render = renderBiosRuntimeStatusSurface.bind(null, app);

    await loadBiosRuntimeStatusSurface(app, { tickBrainstem: false });

    expect(invoke).not.toHaveBeenCalledWith("bios_prepare_boxed_lane", expect.anything());
    expect(app.biosBoxedLaneAutoPrepareResult.action_taken).toBe("background_repair_queued");
  });

  it("does not overwrite the returning-user profile chooser viewport during runtime refresh", () => {
    const app = {
      profilePickerActive: true,
      activeBiosProfileId: "claw",
      biosProfiles: [{ id: "claw", display_name: "Claw" }],
      renderProfilePickerViewport: vi.fn(),
      renderBiosSurfacePanel: vi.fn(),
      renderViewportIdleCompanion: vi.fn(),
      setStatusValue: vi.fn(),
      getSavedOnboardingSnapshot: vi.fn(),
    };

    renderBiosRuntimeStatusSurface(app, {
      route_ready: false,
      route_status_label: "Runtime check needed",
      worker_ready: true,
    });

    expect(app.renderProfilePickerViewport).toHaveBeenCalled();
    expect(app.renderViewportIdleCompanion).not.toHaveBeenCalled();
    expect(app.setStatusValue).not.toHaveBeenCalledWith("st-model", expect.any(String));
  });
});
