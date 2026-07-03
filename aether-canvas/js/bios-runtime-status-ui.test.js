import { describe, expect, it } from "vitest";
import { buildBiosRuntimeStatusRenderSnapshot } from "./bios-runtime-status-ui.js";

describe("buildBiosRuntimeStatusRenderSnapshot", () => {
  it("builds the managed-runtime snapshot for a ready route", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot(
      {
        boxed_lane_ready: true,
        boxed_lane_provisioning: {
          backend: "BIOS AI Boxed Lane",
          adapter_label: "Linux native container adapter",
          install_state: "ready",
          next_action:
            "BIOS AI can run untrusted tool, skill, dependency, and connection work inside the boxed lane.",
          safe_to_run_untrusted_work: true,
        },
        lxc_available: true,
        lxc_detail: "LXC ready",
        wsl_detail: "",
        managed_runtime_detail: "Managed runtime healthy",
        preferred_local_backend: "bios-managed",
        worker_status_label: "Gemma worker ready",
        local_backend_detail: "Ollama detected",
        route_status_label: "Ready for local chat",
        route_ready: true,
        route_detail: "Managed route is ready.",
        next_step: "You can start chatting now.",
        debug_log_path: "C:/bios/debug.log",
        doctor_summary: "Doctor green.",
        packaged_build: true,
        installer_mode: "nsis",
        route_mode_label: "Local only",
      },
      {
        safetyLabel: "Native boxed-lane hardened",
        authorityMode: "ask first",
        agentName: "Claw",
      },
    );

    expect(snapshot.sandboxHealthLabel).toBe("Boxed lane ready");
    expect(snapshot.lxcStatusLabel).toContain("BIOS AI Boxed Lane");
    expect(snapshot.lxcStatusLabel).toContain("Linux native container adapter");
    expect(snapshot.lxcStatusLabel).toContain("untrusted tool, skill, dependency");
    expect(snapshot.boxedLaneSafetyLabel).toBe("Untrusted work can run in the boxed lane");
    expect(snapshot.settingsLocalWorkerLabel).toBe("Gemma worker ready");
    expect(snapshot.settingsRouteReadinessLabel).toBe("Ready for local chat");
    expect(snapshot.settingsRuntimeNote).toBe("Managed route is ready.");
    expect(snapshot.debugLogPathLabel).toBe("Available in the Log surface");
    expect(snapshot.doctorSummaryLabel).toContain("Doctor green.");
    expect(snapshot.doctorSummaryLabel).toContain("packaged app");
    expect(snapshot.shellModelStatus).toBe("Local only");
    expect(snapshot.workerShellLabel).toBe("Gemma worker ready");
    expect(snapshot.agentStateLabel).toBe("Idle");
    expect(snapshot.viewportSnapshot.profileLabel).toBe("BOSS: Claw");
    expect(snapshot.viewportSnapshot.routeLabel).toBe("Route: local only");
    expect(snapshot.viewportSnapshot.safetyLabel).toBe("Safety: Native boxed-lane hardened");
    expect(snapshot.viewportSnapshot.authorityLabel).toBe("Authority: ask first");
    expect(snapshot.viewportSnapshot.readinessLabel).toBe("Ready for local chat");
    expect(snapshot.viewportSnapshot.workerLabel).toBe("Gemma worker ready");
    expect(snapshot.viewportSnapshot.nextActionLabel).toBe("You can start chatting now.");
    expect(snapshot.viewportSnapshot.supportLabel).toBe(
      "Diagnostics are available in the Log surface.",
    );
  });

  it("falls back to external backend detail and setup note when route is not ready", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot(
      {
        boxed_lane_ready: false,
        boxed_lane_provisioning: {
          backend: "BIOS AI Boxed Lane",
          adapter_label: "Windows managed WSL2 adapter",
          install_state: "needs_linux_distro",
          next_action:
            "BIOS AI must provision its BIOS-managed WSL2 Linux substrate before host promotion.",
          safe_to_run_untrusted_work: false,
        },
        lxc_available: false,
        lxc_detail: "LXC missing",
        wsl_detail: "WSL available",
        managed_runtime_detail: "Managed runtime missing worker",
        preferred_local_backend: "ollama",
        worker_status_label: "Ignored managed worker label",
        local_backend_detail: "Ollama reachable",
        route_status_label: "Needs local worker",
        route_ready: false,
        route_detail: "Route is not ready.",
        next_step: "Install a worker.",
        debug_log_path: "",
        doctor_summary: "Doctor found issues.",
        packaged_build: false,
        installer_mode: "dev",
        route_mode_label: "Hybrid",
      },
      {
        safetyLabel: "Native boxed-lane hardened",
        authorityMode: "broad",
        agentName: "Claw",
      },
    );

    expect(snapshot.sandboxHealthLabel).toBe("Boxed lane needs substrate");
    expect(snapshot.lxcStatusLabel).toContain("BIOS AI Boxed Lane");
    expect(snapshot.lxcStatusLabel).toContain("Windows managed WSL2 adapter");
    expect(snapshot.lxcStatusLabel).toContain("BIOS-managed WSL2 Linux substrate");
    expect(snapshot.boxedLaneSafetyLabel).toContain("blocked from host execution");
    expect(snapshot.settingsLocalWorkerLabel).toBe("Ollama reachable");
    expect(snapshot.settingsRuntimeNote).toBe("Route is not ready. Install a worker.");
    expect(snapshot.debugLogPathLabel).toBe(
      "Log details will appear after BIOS AI writes support events",
    );
    expect(snapshot.doctorSummaryLabel).toContain("dev shell");
    expect(snapshot.shellModelStatus).toBe("Hybrid");
    expect(snapshot.workerShellLabel).toBe("Ollama reachable");
    expect(snapshot.agentStateLabel).toBe("Runtime blocked");
    expect(snapshot.viewportSnapshot.title).toBe("Runtime blocked");
    expect(snapshot.viewportSnapshot.authorityLabel).toBe("Authority: broad");
    expect(snapshot.viewportSnapshot.readinessLabel).toBe("Runtime blocked");
    expect(snapshot.viewportSnapshot.workerLabel).toBe("Ollama reachable");
    expect(snapshot.viewportSnapshot.nextActionLabel).toBe("Install a worker.");
    expect(snapshot.viewportSnapshot.supportLabel).toBe(
      "Diagnostics will appear in the Log surface once BIOS AI writes support events.",
    );
  });

  it("surfaces GPU acceleration blocks as runtime-blocking truth", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot({
      boxed_lane_ready: true,
      boxed_lane_provisioning: {
        backend: "Windows Boxed Lane",
        install_state: "ready",
        next_action: "Boxed lane ready.",
        safe_to_run_untrusted_work: true,
      },
      lxc_available: false,
      lxc_detail: "",
      wsl_detail: "WSL ready",
      managed_runtime_detail:
        "BIOS AI refused the managed local BOSS runtime because bundled llama.cpp listed no GPU/accelerator devices.",
      preferred_local_backend: "bios-managed",
      worker_status_label: "BOSS brain GPU acceleration blocked",
      local_backend_detail: "Managed runtime blocked",
      route_status_label: "Local route not ready",
      route_ready: false,
      route_detail:
        "BIOS AI blocks CPU-only managed local BOSS chat until a GPU-enabled llama.cpp sidecar is installed and packaged.",
      next_step: "Install or package a GPU-enabled llama.cpp sidecar before local BOSS chat.",
      debug_log_path: "C:/bios/debug.log",
      doctor_summary: "GPU acceleration proof missing.",
      packaged_build: true,
      installer_mode: "nsis",
      route_mode_label: "Local only",
    });

    expect(snapshot.agentStateLabel).toBe("Runtime blocked");
    expect(snapshot.settingsLocalWorkerLabel).toBe("BOSS brain GPU acceleration blocked");
    expect(snapshot.viewportSnapshot.readinessLabel).toBe("Runtime blocked");
    expect(snapshot.viewportSnapshot.nextActionLabel).toContain("GPU-enabled llama.cpp sidecar");
  });

  it("turns a managed-worker download into plain runtime progress copy", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot({
      boxed_lane_ready: true,
      lxc_available: true,
      lxc_detail: "LXC ready",
      wsl_detail: "",
      managed_runtime_detail: "Managed runtime downloading worker",
      preferred_local_backend: "bios-managed",
      worker_status_label: "Downloading Gemma worker",
      local_backend_detail: "",
      route_status_label: "Needs local worker",
      route_ready: false,
      route_detail: "Managed worker is not installed.",
      next_step: "Install a local worker.",
      debug_log_path: "C:/bios/debug.log",
      doctor_summary: "Doctor waiting on worker.",
      packaged_build: true,
      installer_mode: "nsis",
      route_mode_label: "Local only",
      download: {
        state: "downloading",
        progress_percent: 42,
      },
    });

    expect(snapshot.agentStateLabel).toBe("Downloading BOSS brain");
    expect(snapshot.settingsRouteReadinessLabel).toBe("BOSS brain download in progress");
    expect(snapshot.settingsRuntimeNote).toContain("42% downloaded");
    expect(snapshot.viewportSnapshot.title).toBe("BOSS brain downloading");
    expect(snapshot.viewportSnapshot.nextActionLabel).toBe(
      "Keep BIOS AI open while the BOSS brain download finishes.",
    );
  });

  it("turns a failed managed-worker download into a recovery action", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot({
      boxed_lane_ready: true,
      lxc_available: true,
      lxc_detail: "LXC ready",
      wsl_detail: "",
      managed_runtime_detail: "Managed runtime failed worker install",
      preferred_local_backend: "bios-managed",
      worker_status_label: "",
      local_backend_detail: "",
      route_status_label: "Needs local worker",
      route_ready: false,
      route_detail: "Managed worker is not installed.",
      next_step: "Install a local worker.",
      debug_log_path: "",
      doctor_summary: "Doctor found issues.",
      packaged_build: true,
      installer_mode: "nsis",
      route_mode_label: "Local only",
      download: {
        state: "failed",
        error: "Model download failed: 404",
      },
    });

    expect(snapshot.agentStateLabel).toBe("Needs attention");
    expect(snapshot.settingsRouteReadinessLabel).toBe("BOSS brain download failed");
    expect(snapshot.settingsRuntimeNote).toContain("Model download failed: 404");
    expect(snapshot.viewportSnapshot.title).toBe("BOSS brain setup needs attention");
    expect(snapshot.viewportSnapshot.nextActionLabel).toBe(
      "Retry the BOSS brain download or switch to an available runtime.",
    );
  });

  it("explains resumable managed-worker downloads without calling them dead failures", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot({
      boxed_lane_ready: true,
      lxc_available: true,
      lxc_detail: "LXC ready",
      wsl_detail: "",
      managed_runtime_detail: "Managed runtime resumable worker install",
      preferred_local_backend: "bios-managed",
      worker_status_label: "",
      local_backend_detail: "",
      route_status_label: "Needs local worker",
      route_ready: false,
      route_detail: "Managed worker is not installed.",
      next_step: "Install a local worker.",
      debug_log_path: "",
      doctor_summary: "Doctor found issues.",
      packaged_build: true,
      installer_mode: "nsis",
      route_mode_label: "Local only",
      download: {
        state: "failed",
        error: "Model download interrupted.",
        resumable: true,
        downloaded_bytes: 2 * 1024 * 1024 * 1024,
      },
    });

    expect(snapshot.agentStateLabel).toBe("Download resumable");
    expect(snapshot.settingsRouteReadinessLabel).toBe("BOSS brain download can resume");
    expect(snapshot.settingsRuntimeNote).toContain("2048 MB is preserved");
    expect(snapshot.viewportSnapshot.title).toBe("BOSS brain download can resume");
    expect(snapshot.viewportSnapshot.nextActionLabel).toContain("continue from the saved partial");
  });

  it("names degraded routes without hiding that BIOS AI can still work", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot({
      boxed_lane_ready: true,
      lxc_available: true,
      lxc_detail: "LXC ready",
      wsl_detail: "",
      managed_runtime_detail: "Managed runtime has partial worker coverage",
      preferred_local_backend: "bios-managed",
      worker_status_label: "Small worker ready; medium worker missing",
      local_backend_detail: "",
      route_status_label: "Route degraded",
      route_ready: true,
      worker_ready: false,
      route_detail: "Main chat can run, but the medium worker lane is not ready.",
      next_step: "Install the medium worker before long-running synthesis.",
      debug_log_path: "C:/bios/debug.log",
      doctor_summary: "Doctor found one worker lane issue.",
      packaged_build: true,
      installer_mode: "nsis",
      route_mode_label: "Hybrid",
    });

    expect(snapshot.agentStateLabel).toBe("Route degraded");
    expect(snapshot.settingsRouteReadinessLabel).toBe("Route degraded");
    expect(snapshot.settingsRuntimeNote).toContain("medium worker lane is not ready");
    expect(snapshot.viewportSnapshot.title).toBe("Runtime route degraded");
    expect(snapshot.viewportSnapshot.nextActionLabel).toBe(
      "Install the medium worker before long-running synthesis.",
    );
  });

  it("lets the brainstem lifecycle drive the agent state and next step copy", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot(
      {
        boxed_lane_ready: true,
        lxc_available: true,
        lxc_detail: "LXC ready",
        wsl_detail: "",
        managed_runtime_detail: "Managed runtime healthy",
        preferred_local_backend: "bios-managed",
        worker_status_label: "Qwen worker ready",
        local_backend_detail: "Managed backend reachable",
        route_status_label: "Route ready",
        route_ready: true,
        route_detail: "Managed route is ready.",
        next_step: "You can start chatting now.",
        debug_log_path: "C:/bios/debug.log",
        doctor_summary: "Doctor green.",
        packaged_build: true,
        installer_mode: "nsis",
        route_mode_label: "Local only",
      },
      {
        safetyLabel: "Native boxed-lane hardened",
        authorityMode: "ask first",
        agentName: "Claw",
        brainstem: {
          lifecycle: "waiting_for_approval",
          recovery_action: "await_approval",
          summary:
            "BIOS is holding guarded identity changes until the operator decides what should become canonical.",
        },
      },
    );

    expect(snapshot.agentStateLabel).toBe("Waiting for approval");
    expect(snapshot.settingsRuntimeNote).toContain("guarded identity changes");
    expect(snapshot.viewportSnapshot.title).toBe("Approval needed before BIOS AI continues");
    expect(snapshot.viewportSnapshot.nextActionLabel).toBe(
      "Review the pending guarded identity changes before chat continues.",
    );
  });

  it("projects reflex growth into the viewport support lane when available", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot(
      {
        boxed_lane_ready: true,
        lxc_available: true,
        lxc_detail: "LXC ready",
        wsl_detail: "",
        managed_runtime_detail: "Managed runtime healthy",
        preferred_local_backend: "bios-managed",
        worker_status_label: "Qwen worker ready",
        local_backend_detail: "Managed backend reachable",
        route_status_label: "Route ready",
        route_ready: true,
        route_detail: "Managed route is ready.",
        next_step: "You can start chatting now.",
        debug_log_path: "C:/bios/debug.log",
        doctor_summary: "Doctor green.",
        packaged_build: true,
        installer_mode: "nsis",
        route_mode_label: "Local only",
      },
      {
        safetyLabel: "Native boxed-lane hardened",
        authorityMode: "ask first",
        agentName: "Claw",
        reflex: {
          summary:
            "BIOS is tracking 2 skill candidate(s), 1 queued promotion candidate(s), and 4 synaptic event(s).",
        },
      },
    );

    expect(snapshot.viewportSnapshot.supportLabel).toContain("Reflex growth:");
    expect(snapshot.viewportSnapshot.supportLabel).toContain("2 skill candidate");
  });

  it("prioritizes the sovereign body observation detail when the virtual desktop is active", () => {
    const snapshot = buildBiosRuntimeStatusRenderSnapshot(
      {
        boxed_lane_ready: true,
        lxc_available: true,
        lxc_detail: "LXC ready",
        wsl_detail: "",
        managed_runtime_detail: "Managed runtime healthy",
        preferred_local_backend: "bios-managed",
        worker_status_label: "Qwen worker ready",
        local_backend_detail: "Managed backend reachable",
        route_status_label: "Route ready",
        route_ready: true,
        route_detail: "Managed route is ready.",
        next_step: "You can start chatting now.",
        debug_log_path: "C:/bios/debug.log",
        doctor_summary: "Doctor green.",
        packaged_build: true,
        installer_mode: "nsis",
        route_mode_label: "Local only",
      },
      {
        safetyLabel: "Native boxed-lane hardened",
        authorityMode: "ask first",
        agentName: "Claw",
        observation: {
          body_summary: "Private virtual desktop is active on https://example.com/workbench.",
          body_state_label: "Private body active",
          host_interruption_policy: "User desktop interruption blocked by default",
          user_control_label: "Take control available when a private desktop stream is active",
          viewport_title: "https://example.com/workbench",
          next_body_action: "Watch the private body work here; approve only if BIOS asks.",
          detail: "https://example.com/workbench",
        },
        reflex: {
          summary: "BIOS is tracking 2 skill candidate(s).",
        },
      },
    );

    expect(snapshot.viewportSnapshot.supportLabel).toBe(
      "Body: Private virtual desktop is active on https://example.com/workbench.",
    );
    expect(snapshot.viewportSnapshot.bodyStateLabel).toBe("Body: Private body active");
    expect(snapshot.viewportSnapshot.hostInterruptionPolicy).toBe(
      "User desktop interruption blocked by default",
    );
    expect(snapshot.viewportSnapshot.viewportTitle).toBe("https://example.com/workbench");
    expect(snapshot.viewportSnapshot.nextBodyAction).toBe(
      "Watch the private body work here; approve only if BIOS asks.",
    );
  });
});
