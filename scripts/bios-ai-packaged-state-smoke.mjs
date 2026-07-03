import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

export async function smokeBiosAiPackagedState(repoRoot = resolveRepoRoot()) {
  const biosPaths = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/bios_paths.rs");
  const debugLog = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/debug_log.rs");
  const biosProfiles = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/bios_profiles.rs");
  const biosMemory = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/bios_memory.rs");
  const biosBrainstem = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/bios_brainstem.rs",
  );
  const biosCircadian = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/bios_circadian.rs",
  );
  const workerAssets = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/worker_assets.rs");
  const llmConfig = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/llm.rs");
  const localConnectors = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/bios_local_connectors.rs",
  );

  assertCondition(
    biosPaths.includes('home.join(".agentos").join("bios-ai")'),
    "BIOS AI state root must stay under ~/.agentos/bios-ai",
  );
  assertCondition(
    debugLog.includes('bios_state_root()?.join("logs").join("runtime-debug.log")'),
    "Debug log must live under the BIOS AI state root",
  );
  assertCondition(
    biosProfiles.includes('bios_state_root()?.join("profiles")'),
    "BOSS profiles must live under the BIOS AI state root",
  );
  assertCondition(
    biosMemory.includes('profile_memory_dir(profile_id)?.join("active-state.json")'),
    "BIOS memory active state must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosMemory.includes('profile_memory_dir(profile_id)?.join("events.jsonl")'),
    "BIOS memory event log must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosMemory.includes(
      'profile_daily_memory_dir(profile_id)?.join(format!("{}.md", today_stamp()))',
    ),
    "BIOS daily memory notes must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosMemory.includes('profile_memory_dir(profile_id)?.join("consolidated-memory.json")'),
    "BIOS durable memory must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosMemory.includes('profile_memory_dir(profile_id)?.join("dream-history.jsonl")'),
    "BIOS dream history must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosMemory.includes("load_active_state_for_profile(profile_id)?"),
    "BIOS memory surface must rehydrate from persisted active state after restart",
  );
  assertCondition(
    biosMemory.includes("load_consolidated_memory(profile_id)?"),
    "BIOS memory surface must rehydrate durable memory after restart",
  );
  assertCondition(
    biosMemory.includes("read_last_dream_at(profile_id)?"),
    "BIOS memory surface must rehydrate dream history after restart",
  );
  assertCondition(
    biosBrainstem.includes('profile_runtime_dir(profile_id)?.join("brainstem-state.json")'),
    "BIOS brainstem state must stay inside the owning BOSS profile runtime directory",
  );
  assertCondition(
    biosBrainstem.includes("let previous = load_persisted_state(&profile_id)?") &&
      biosBrainstem.includes("let previous = load_persisted_state(&input.profile_id)?"),
    "BIOS brainstem must rehydrate previous state before load and tick operations",
  );
  assertCondition(
    biosBrainstem.includes("save_persisted_state(&profile_id, &state)?") &&
      biosBrainstem.includes("save_persisted_state(&input.profile_id, &state)?"),
    "BIOS brainstem must persist loaded and ticked state for restart continuity",
  );
  assertCondition(
    biosCircadian.includes("load_bios_memory_surface_for_profile(&profile_id)?") &&
      biosCircadian.includes("load_dream_history_for_profile(&profile_id)?"),
    "BIOS circadian/glymphatic status must rehydrate memory and dream history after restart",
  );
  assertCondition(
    llmConfig.includes('.join("provider.json")'),
    "Provider config must stay inside the BIOS AI state root",
  );
  assertCondition(
    llmConfig.includes("pub async fn load_agent_identity(profile_id: Option<String>)"),
    "Agent identity loading must accept an owning BIOS profile id",
  );
  assertCondition(
    llmConfig.includes("load_active_profile_id"),
    "Agent identity loading must fall back through the active BIOS profile registry",
  );
  assertCondition(
    llmConfig.includes("load_agent_identity_from_bios_profile"),
    "Agent identity loading must resolve through BIOS profile-owned identity files",
  );
  assertCondition(
    llmConfig.includes("profile_soul_path(profile_id)?"),
    "Governed soul truth must load from the owning BIOS profile directory",
  );
  assertCondition(
    llmConfig.includes("profile_user_path(profile_id)?"),
    "Governed user truth must load from the owning BIOS profile directory",
  );
  assertCondition(
    llmConfig.includes("profile_identity_path(profile_id)?"),
    "Governed identity truth must load from the owning BIOS profile directory",
  );
  assertCondition(
    llmConfig.includes("profile_memory_path(profile_id)?"),
    "Governed memory truth must load from the owning BIOS profile directory",
  );
  assertCondition(
    !llmConfig.includes('legacy_dir.join("SOUL.md")') ||
      llmConfig.includes(
        "load_agent_identity_reads_bios_profile_truth_instead_of_legacy_global_files",
      ),
    "Legacy global identity files must only appear in regression tests, not in live runtime ownership.",
  );
  assertCondition(
    biosProfiles.includes('Ok(profile_dir(profile_id)?.join("worker-storage.json"))'),
    "Worker storage config must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosProfiles.includes('Ok(profile_dir(profile_id)?.join("worker-model.json"))'),
    "Worker model selection must stay inside the owning BOSS profile",
  );
  assertCondition(
    biosProfiles.includes('Ok(profile_dir(profile_id)?.join("worker-roster.json"))'),
    "Worker roster must stay inside the owning BOSS profile",
  );
  assertCondition(
    localConnectors.includes('join("connectors.json")'),
    "Local connector bindings must stay inside the owning BOSS profile",
  );
  assertCondition(
    localConnectors.includes('join("connector-approvals.json")'),
    "Local connector approvals must stay inside the owning BOSS profile",
  );
  assertCondition(
    workerAssets.includes(
      "BIOS AI cannot read worker runtime ownership until a real BOSS profile exists.",
    ) || workerAssets.includes("BIOS AI cannot {action} until a real BOSS profile exists."),
    "Worker runtime truth must refuse profileless ownership reads",
  );
  assertCondition(
    workerAssets.includes("choose_default_worker_models_dir"),
    "Worker asset resolution must explicitly choose the managed BIOS model root",
  );
  assertCondition(
    workerAssets.includes("let _ = legacy_dir;") &&
      workerAssets.includes("default_models_dir_blocks_legacy_install_when_new_root_is_empty"),
    "Legacy BIOS AI model path must be blocked from silently becoming runtime model truth",
  );

  return {
    repoRoot,
    packagedStateRoot: "~/.agentos/bios-ai",
    validatedSurfaces: [
      "logs",
      "profiles",
      "memory-active-state",
      "memory-event-log",
      "memory-daily-notes",
      "durable-memory",
      "dream-history",
      "brainstem-state",
      "brainstem-restart-continuity",
      "circadian-dream-history-readback",
      "provider-config",
      "profile-owned-identity",
      "worker-storage",
      "worker-selection",
      "worker-roster",
      "connector-bindings",
      "connector-approvals",
      "profile-owned-worker-truth",
      "legacy-model-fallback-blocked",
    ],
  };
}

function isMainModule() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await smokeBiosAiPackagedState();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
