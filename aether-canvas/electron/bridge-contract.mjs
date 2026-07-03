export const ELECTRON_SHELL_SPIKE_COMMANDS = [
  "system_discovery",
  "list_bios_profiles",
  "load_bios_profile",
  "set_active_bios_profile",
  "bios_shell_contract",
  "bios_runtime_status",
  "bios_boxed_lane_status",
  "bios_prepare_boxed_lane",
  "load_forge_arena_local_state",
  "run_forge_arena_boss_proving_round",
  "worker_assets_status",
  "worker_model_catalog",
  "start_worker_model_download",
  "start_all_worker_model_downloads",
  "load_provider_config",
  "save_provider_config",
  "append_debug_log",
  "read_debug_log",
  "probe_local_runtime",
  "bios_local_worker_runtime_status",
  "load_bios_local_connector_status",
  "bios_local_tool_registry",
  "chat_with_local_worker",
  "shutdown_local_worker_runtime",
];

export const ELECTRON_SHELL_DECISION_CRITERIA = [
  {
    id: "reuse_existing_frontend",
    tauri: 3,
    electron: 5,
    reason:
      "The BIOS AI frontend already uses window.__TAURI__.core.invoke, so Electron can expose a compatibility bridge without rewriting the UI.",
  },
  {
    id: "build_loop_speed",
    tauri: 2,
    electron: 4,
    reason:
      "The Tauri/NSIS wrapper exceeded the local proof window while Electron shell iteration can be JavaScript-first until native sidecars are invoked.",
  },
  {
    id: "installer_predictability",
    tauri: 2,
    electron: 4,
    reason:
      "The current Tauri NSIS installMode=both path produced HKLM/HKCU split-brain on this machine; the Electron spike is scoped to one current-user registration.",
  },
  {
    id: "native_os_control",
    tauri: 5,
    electron: 3,
    reason:
      "Tauri/Rust is stronger for native command ownership, but BIOS AI should move those responsibilities behind native sidecar contracts rather than keeping them in the app shell.",
  },
  {
    id: "security_defaults",
    tauri: 5,
    electron: 3,
    reason:
      "Tauri has stronger security-oriented defaults. Electron can be acceptable only with contextIsolation, sandboxing, no nodeIntegration, and a narrow preload bridge.",
  },
  {
    id: "product_surface_velocity",
    tauri: 2,
    electron: 5,
    reason:
      "BIOS AI and Forge Arena are still changing quickly; Electron is a better fit for large web-product iteration while native work is isolated.",
  },
];

export function scoreDesktopShellDecision(criteria = ELECTRON_SHELL_DECISION_CRITERIA) {
  return criteria.reduce(
    (totals, criterion) => ({
      tauri: totals.tauri + criterion.tauri,
      electron: totals.electron + criterion.electron,
    }),
    { tauri: 0, electron: 0 },
  );
}

export function recommendedDesktopShell(criteria = ELECTRON_SHELL_DECISION_CRITERIA) {
  const score = scoreDesktopShellDecision(criteria);
  return {
    score,
    recommendation:
      score.electron > score.tauri
        ? "move_to_electron_shell_with_native_sidecars"
        : "stay_on_tauri_until_electron_proof_wins",
  };
}
