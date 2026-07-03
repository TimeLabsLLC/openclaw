import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, appendFile, mkdir, open, readFile, readdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  chatWithLocalWorker,
  probeLocalRuntime,
  shutdownLocalWorkerRuntime,
  workerRuntimeStatus,
} from "./worker-runtime.mjs";

const SIDECAR_COMMANDS = new Set([
  "system_discovery",
  "bios_shell_contract",
  "bios_runtime_status",
  "bios_boxed_lane_status",
  "bios_prepare_boxed_lane",
  "worker_assets_status",
  "worker_model_catalog",
  "start_worker_model_download",
  "start_all_worker_model_downloads",
  "append_debug_log",
  "read_debug_log",
  "probe_local_runtime",
  "bios_local_worker_runtime_status",
  "chat_with_local_worker",
  "shutdown_local_worker_runtime",
]);

const MANAGED_MODELS = [
  {
    variant: "gemma-3-1b",
    model_id: "gemma-3-1b-it-Q4_K_M",
    file_name: "gemma-3-1b-it-Q4_K_M.gguf",
    label: "Gemma 3 1B",
    family: "Gemma",
    size_label: "1B Q4_K_M",
    recommended_gpu_vram_gb: 2,
    download_url:
      "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF",
  },
  {
    variant: "gemma-3-4b",
    model_id: "gemma-3-4b-it-Q4_K_M",
    file_name: "gemma-3-4b-it-Q4_K_M.gguf",
    label: "Gemma 3 4B",
    family: "Gemma",
    size_label: "4B Q4_K_M",
    recommended_gpu_vram_gb: 5,
    download_url:
      "https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF",
  },
  {
    variant: "gemma-3-12b",
    model_id: "gemma-3-12b-it-Q4_K_M",
    file_name: "gemma-3-12b-it-Q4_K_M.gguf",
    label: "Gemma 3 12B",
    family: "Gemma",
    size_label: "12B Q4_K_M",
    recommended_gpu_vram_gb: 12,
    download_url:
      "https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF/resolve/main/gemma-3-12b-it-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF",
  },
  {
    variant: "qwen-3-8b",
    model_id: "Qwen3-8B-Q4_K_M",
    file_name: "Qwen3-8B-Q4_K_M.gguf",
    label: "Qwen3 8B",
    family: "Qwen",
    size_label: "8B Q4_K_M",
    recommended_gpu_vram_gb: 8,
    download_url:
      "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF",
  },
  {
    variant: "qwen-3-14b",
    model_id: "Qwen3-14B-Q4_K_M",
    file_name: "Qwen3-14B-Q4_K_M.gguf",
    label: "Qwen3 14B",
    family: "Qwen",
    size_label: "14B Q4_K_M",
    recommended_gpu_vram_gb: 12,
    download_url:
      "https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF",
  },
  {
    variant: "llama-3-1-8b",
    model_id: "Meta-Llama-3.1-8B-Instruct-Q4_K_M",
    file_name: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    label: "Llama 3.1 8B",
    family: "Llama",
    size_label: "8B Q4_K_M",
    recommended_gpu_vram_gb: 8,
    download_url:
      "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
  },
  {
    variant: "mistral-7b-v0-3",
    model_id: "Mistral-7B-Instruct-v0.3-Q4_K_M",
    file_name: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    label: "Mistral 7B",
    family: "Mistral",
    size_label: "7B Q4_K_M",
    recommended_gpu_vram_gb: 8,
    download_url:
      "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF",
  },
  {
    variant: "phi-3-5-mini",
    model_id: "Phi-3.5-mini-instruct-Q4_K_M",
    file_name: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    label: "Phi 3.5 Mini",
    family: "Phi",
    size_label: "Mini Q4_K_M",
    recommended_gpu_vram_gb: 4,
    download_url:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf?download=true",
    source_url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF",
  },
];

let boxedLaneRepairPromise = null;
const downloadStates = new Map();
const downloadQueues = new Map();

export function isBiosSidecarCommand(command) {
  return SIDECAR_COMMANDS.has(command);
}

function runHiddenProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ status: "fail", exitCode: null, timedOut, stdout, stderr, error: error.message });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        status: !timedOut && exitCode === 0 ? "pass" : "fail",
        exitCode,
        timedOut,
        stdout,
        stderr,
      });
    });
  });
}

function defaultModelsDir() {
  if (process.env.BIOS_AI_MODELS_DIR) {
    return process.env.BIOS_AI_MODELS_DIR;
  }
  return path.join(os.homedir(), ".bios-ai", "models");
}

function defaultDebugLogPath() {
  return debugLogPath();
}

function biosStateRoot() {
  const override = process.env.BIOS_AI_HOME_OVERRIDE?.trim();
  if (override) {
    return override;
  }
  return path.join(os.homedir(), ".agentos", "bios-ai");
}

function debugLogPath() {
  return path.join(biosStateRoot(), "logs", "runtime-debug.log");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

async function latestDebugParentHash(deps = {}) {
  const logPath = debugLogPath();
  try {
    const raw = await (deps.readFile ?? readFile)(logPath, "utf8");
    for (const line of raw.split(/\r?\n/).reverse()) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed.record_hash === "string" && parsed.record_hash) {
          return parsed.record_hash;
        }
      } catch {
        // Fall through to legacy-line hashing.
      }
      return sha256Hex(trimmed);
    }
  } catch {
    return null;
  }
  return null;
}

async function appendSidecarDebugLog(source, event, details, deps = {}) {
  const normalizedDetails = typeof details === "string" ? details : JSON.stringify(details ?? {});
  const record = {
    version: "bios-debug-log-v1",
    ts: Date.now(),
    event,
    source,
    origin_hash: sha256Hex(`${source}\0${event}`),
    parent_hash: await latestDebugParentHash(deps),
    payload_hash: sha256Hex(normalizedDetails),
    details: normalizedDetails,
    record_hash: "",
  };
  const { record_hash: _recordHash, ...hashableRecord } = record;
  record.record_hash = sha256Hex(canonicalJson(hashableRecord));
  const logPath = debugLogPath();
  await (deps.mkdir ?? mkdir)(path.dirname(logPath), { recursive: true });
  await (deps.appendFile ?? appendFile)(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

async function pathExists(filePath, deps) {
  try {
    await (deps.access ?? access)(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeCommandText(value) {
  return String(value || "")
    .replace(/\0/g, "")
    .trim();
}

function parseWslVerboseList(raw) {
  return normalizeCommandText(raw)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\*\s*/, "").trim())
    .filter((line) => line && !/^name\s+state\s+version$/i.test(line))
    .map((line) => {
      const match = line.match(
        /^(.+?)\s+(Running|Stopped|Installing|Uninstalling|Converting)\s+(\d+)$/i,
      );
      if (!match) {
        return null;
      }
      return {
        name: match[1].trim(),
        state: match[2],
        version: Number(match[3]),
      };
    })
    .filter(Boolean);
}

async function detectBoxedLaneStatus(deps = {}) {
  const platform = deps.platform || process.platform;
  if (platform !== "win32") {
    return {
      owner: "electron-main-sidecar",
      backend: platform === "darwin" ? "apple-virtualization-linux-vm" : "native-linux",
      platform,
      install_state: "platform_adapter_pending",
      proof_state: "not_verified",
      ready: false,
      safe_to_run_untrusted_work: false,
      next_action:
        platform === "darwin"
          ? "Wire the Apple Virtualization boxed-lane adapter for macOS package proof."
          : "Wire the native Linux boxed-lane adapter for Linux package proof.",
    };
  }

  const runner = deps.runProcess ?? runHiddenProcess;
  const status = await runner("wsl.exe", ["--status"], { timeoutMs: 30_000 });
  const version = await runner("wsl.exe", ["--version"], { timeoutMs: 30_000 });
  if (status.status !== "pass" && version.status !== "pass") {
    return {
      owner: "electron-main-sidecar",
      backend: "wsl2",
      platform,
      install_state: "wsl_unavailable",
      proof_state: "not_verified",
      ready: false,
      safe_to_run_untrusted_work: false,
      next_action: "Install WSL2 through the BIOS AI boxed-lane repair path.",
      detail: normalizeCommandText(
        status.stderr || status.stdout || version.stderr || version.stdout,
      ),
    };
  }

  const list = await runner("wsl.exe", ["--list", "--verbose"], { timeoutMs: 30_000 });
  const distros = list.status === "pass" ? parseWslVerboseList(list.stdout || list.stderr) : [];
  const distro = distros.find((entry) => entry.version === 2) || distros[0] || null;
  if (!distro) {
    return {
      owner: "electron-main-sidecar",
      backend: "wsl2",
      platform,
      install_state: "needs_linux_distro",
      proof_state: "waiting_for_substrate",
      ready: false,
      safe_to_run_untrusted_work: false,
      next_action: "Provision the BIOS-managed Linux boxed-lane distro.",
      wsl_version: normalizeCommandText(version.stdout || version.stderr),
      distros,
    };
  }

  const proof = await runner("wsl.exe", ["-d", distro.name, "--", "uname", "-s"], {
    timeoutMs: 30_000,
  });
  const proofText = normalizeCommandText(proof.stdout || proof.stderr);
  const proofReady = proof.status === "pass" && /linux/i.test(proofText);
  return {
    owner: "electron-main-sidecar",
    backend: "wsl2",
    platform,
    install_state: proofReady ? "ready" : "distro_not_runnable",
    proof_state: proofReady ? "verified" : "failed",
    ready: proofReady,
    safe_to_run_untrusted_work: proofReady,
    next_action: proofReady
      ? "Boxed lane is ready for supervised BIOS AI work."
      : "Repair the WSL distro before BIOS AI promotes boxed work.",
    wsl_version: normalizeCommandText(version.stdout || version.stderr),
    distro: {
      name: distro.name,
      state: distro.state,
      version: distro.version,
    },
    proof: {
      command: `wsl.exe -d ${distro.name} -- uname -s`,
      stdout: proofText,
    },
  };
}

async function prepareBoxedLane(payload = {}, deps = {}) {
  const input = payload.input || payload;
  const allowOsChanges = Boolean(input.allow_os_changes || input.allowOsChanges);
  const current = await detectBoxedLaneStatus(deps);
  if (current.ready) {
    return {
      owner: "electron-main-sidecar",
      action_taken: "verified_existing_boxed_lane",
      repair_state: "ready",
      ready: true,
      status: current,
      summary: "Electron verified the existing native boxed lane in the background.",
    };
  }
  if (!allowOsChanges) {
    return {
      owner: "electron-main-sidecar",
      action_taken: "background_repair_queued",
      repair_state: "waiting_for_user_approved_os_setup",
      ready: false,
      status: current,
      blocked_reason:
        "BOSS repair is queued in the background. BIOS AI will not change OS features until the user chooses Repair And Verify Boxed Lane.",
      summary: current.next_action,
    };
  }
  if (boxedLaneRepairPromise) {
    return boxedLaneRepairPromise;
  }
  boxedLaneRepairPromise = (async () => {
    const runner = deps.runProcess ?? runHiddenProcess;
    const setup = await runner("wsl.exe", ["--install", "-d", "Ubuntu", "--no-launch"], {
      timeoutMs: 180_000,
    });
    const after = await detectBoxedLaneStatus(deps);
    return {
      owner: "electron-main-sidecar",
      action_taken:
        setup.status === "pass" || setup.timedOut ? "os_setup_started" : "os_setup_blocked",
      repair_state: after.ready
        ? "ready"
        : setup.status === "pass" || setup.timedOut
          ? "verifying_after_os_setup"
          : "needs_admin_or_os_support",
      ready: after.ready,
      command_preview: "wsl.exe --install -d Ubuntu --no-launch",
      command_output: normalizeCommandText(setup.stdout || setup.stderr || setup.error),
      status: after,
      summary: after.ready
        ? "Boxed-lane setup verified successfully."
        : "BIOS AI started or attempted boxed-lane setup without opening a terminal window.",
    };
  })();
  try {
    return await boxedLaneRepairPromise;
  } finally {
    boxedLaneRepairPromise = null;
  }
}

async function detectGpu(deps = {}) {
  const runner = deps.runProcess ?? runHiddenProcess;
  const nvidia = await runner(
    "nvidia-smi",
    ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
    { timeoutMs: 5000 },
  );
  if (nvidia.status === "pass" && nvidia.stdout.trim()) {
    const [name, memoryMb] = nvidia.stdout
      .trim()
      .split(/\r?\n/)[0]
      .split(",")
      .map((part) => part.trim());
    const parsedMemoryMb = Number.parseInt(memoryMb, 10);
    return {
      detected: true,
      source: "nvidia-smi",
      gpu_vendor: "NVIDIA",
      gpu_name: name || "NVIDIA GPU",
      gpu_vram_mb: Number.isFinite(parsedMemoryMb) ? parsedMemoryMb : null,
      gpu_vram_gb: Number.isFinite(parsedMemoryMb)
        ? Math.round((parsedMemoryMb / 1024) * 10) / 10
        : null,
    };
  }

  if (process.platform === "win32") {
    const powershell = await runner(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name,AdapterRAM | ConvertTo-Json -Compress",
      ],
      { timeoutMs: 5000 },
    );
    if (powershell.status === "pass" && powershell.stdout.trim()) {
      try {
        const parsed = JSON.parse(powershell.stdout);
        const adapterRam = Number(parsed.AdapterRAM || 0);
        return {
          detected: Boolean(parsed.Name),
          source: "win32_video_controller",
          gpu_vendor: String(parsed.Name || "")
            .toLowerCase()
            .includes("nvidia")
            ? "NVIDIA"
            : "unknown",
          gpu_name: parsed.Name || "unknown",
          gpu_vram_mb: adapterRam > 0 ? Math.round(adapterRam / 1024 / 1024) : null,
          gpu_vram_gb:
            adapterRam > 0 ? Math.round((adapterRam / 1024 / 1024 / 1024) * 10) / 10 : null,
        };
      } catch {
        // Fall through to the truthful unavailable state.
      }
    }
  }

  return {
    detected: false,
    source: "unavailable",
    status: "gpu_probe_unavailable",
    note: "GPU probe ran hidden from the Electron main-process sidecar but no supported GPU telemetry source answered.",
  };
}

function runtimeStatusFromWorkerAndBoxedStatus(workerStatus, boxedStatus, payload = {}) {
  const routeReady = workerStatus.status === "ready_to_launch";
  const boxedReady = Boolean(boxedStatus.ready);
  const routeStatusLabel = routeReady ? "Local BOSS runtime ready" : "Runtime setup needed";
  return {
    owner: "electron-main-sidecar",
    route_ready: routeReady,
    worker_ready: routeReady,
    route_label: "Electron native sidecar bridge",
    route_mode_label: payload?.route_mode_label || "Local only",
    route_status_label: routeStatusLabel,
    route_detail: workerStatus.detail || "",
    profile_id: payload?.profile_id || payload?.profileId || "unknown",
    boss_name: payload?.boss_name || payload?.bossName || "unknown",
    model_pref: workerStatus.model_id || "native sidecar waiting for selected model",
    preferred_local_backend: "bios-ai-managed-runtime",
    local_backend_detail: workerStatus.detail || "",
    worker_status_label: routeReady ? "BOSS runtime ready" : "No verified BOSS runtime yet",
    managed_runtime_detail: routeReady
      ? `BIOS AI Managed Runtime ready for ${workerStatus.model_id}.`
      : workerStatus.detail || "BIOS AI Managed Runtime is waiting for a selected model.",
    boxed_lane_ready: boxedReady,
    lxc_available: boxedReady,
    lxc_detail: boxedStatus.next_action || "",
    wsl_detail: boxedStatus.next_action || "",
    sandbox_backend: boxedStatus.backend || "native boxed lane",
    doctor_summary: routeReady
      ? "BIOS AI local BOSS runtime is ready."
      : "BIOS AI local BOSS runtime still needs setup.",
    packaged_build: true,
    installer_mode: "Electron current-user",
    debug_log_path: defaultDebugLogPath(),
    next_step: routeReady
      ? "Managed BOSS worker is ready to launch through the Electron sidecar."
      : workerStatus.detail || "Select and verify a local BOSS model before chat.",
    boxed_lane_summary: boxedReady
      ? "Boxed lane is verified through the Electron native sidecar."
      : boxedStatus.next_action,
    boxed_lane_provisioning: boxedLaneProvisioning(boxedStatus),
    local_worker: workerStatus,
    boxed_lane: boxedStatus,
  };
}

function boxedLaneProvisioning(boxedStatus = {}) {
  const installState =
    boxedStatus.install_state || (boxedStatus.ready ? "ready" : "needs_linux_distro");
  return {
    owner: "electron-main-sidecar",
    backend: boxedStatus.backend || "native boxed lane",
    platform: boxedStatus.platform || process.platform,
    install_state: installState,
    proof_state: boxedStatus.proof_state || (boxedStatus.ready ? "verified" : "not_verified"),
    repair_state: boxedStatus.ready ? "ready" : "idle",
    safe_to_run_untrusted_work: Boolean(boxedStatus.safe_to_run_untrusted_work),
    adapter_label: boxedStatus.backend || "native boxed lane",
    substrate_label: boxedStatus.distro?.name || boxedStatus.backend || "native boxed lane",
    next_action: boxedStatus.next_action || "",
    requires_reboot: Boolean(boxedStatus.requires_reboot),
    background_repair_label: boxedStatus.ready
      ? "Boxed lane is verified."
      : "Boxed-lane setup can be repaired from Settings without terminal popups.",
    last_repair_summary: boxedStatus.detail || "",
  };
}

function boxedLaneContract(boxedStatus = {}, workerStatus = {}) {
  const ready = Boolean(boxedStatus.ready);
  const workerReady = workerStatus.status === "ready_to_launch";
  return {
    owner: "electron-main-sidecar",
    backend: boxedStatus.backend || "native boxed lane",
    substrate_ready: ready,
    worker_lane_ready: workerReady,
    state_label: ready ? "Native boxed lane ready" : "Boxed lane needs substrate",
    substrate_label: ready
      ? boxedStatus.distro?.name || boxedStatus.backend || "Verified native boxed lane"
      : "Managed Linux substrate still needs provisioning",
    worker_status_label: workerReady ? "Managed BOSS worker ready" : "Managed BOSS worker waiting",
    safety_summary: ready
      ? "Untrusted work can run inside the boxed lane after policy approval."
      : "Host writes stay blocked until boxed-lane proof passes.",
    note: boxedStatus.next_action || "",
    provisioning: boxedLaneProvisioning(boxedStatus),
  };
}

function promotionContract(boxedStatus = {}) {
  const ready = Boolean(boxedStatus.ready);
  return {
    owner: "electron-main-sidecar",
    state: ready ? "ready" : "blocked",
    state_label: ready
      ? "Promotion gate ready after boxed proof"
      : "Promotion gate waiting on boxed proof",
    summary: ready
      ? "Boxed proof is available before host adoption."
      : "Host adoption is blocked until boxed-lane proof passes.",
    host_access: "promotion_required",
  };
}

function sandboxStateContract(boxedStatus = {}) {
  const ready = Boolean(boxedStatus.ready);
  return {
    owner: "electron-main-sidecar",
    queue_summary: ready ? "No boxed-lane queue is currently blocked" : "No boxed-lane proof yet",
    latest_decision_label: ready ? "Current boxed proof verified" : "Host adoption blocked",
    latest_event_label: ready ? "boxed_lane_verified" : "boxed_lane_waiting_for_proof",
    queue: [],
  };
}

function diagnosticsContract(runtime, boxedStatus = {}) {
  const ready = Boolean(runtime.route_ready);
  const boxedReady = Boolean(boxedStatus.ready);
  const issues = [];
  if (!ready) {
    issues.push("The selected local BOSS runtime is not verified yet.");
  }
  if (!boxedReady) {
    issues.push("The boxed execution lane still needs provisioning.");
  }
  return {
    owner: "electron-main-sidecar",
    recovery_status: ready ? "ready" : "needs_attention",
    headline: ready
      ? "BIOS AI is usable through the local BOSS runtime"
      : "BIOS AI needs runtime setup before full use",
    summary: issues.length
      ? issues.join(" ")
      : "Local BOSS route and boxed-lane telemetry are available.",
    issues,
    what_still_works: ready ? ["Local BOSS chat can run through the Electron sidecar."] : [],
    recommended_next_steps: issues,
  };
}

function observationContract(profileId) {
  return {
    owner: "electron-main-sidecar",
    profile_id: profileId || null,
    state: "idle",
    state_label: "Idle",
    label: "BIOS Home",
    detail: "BIOS AI is waiting for the next user request.",
    active_surface: "local_shell",
    body_state: "shell_standby",
    body_state_label: "Workspace ready",
    body_mode: "shell_standby",
    body_summary: "Workspace ready",
    execution_lane: "local_shell",
    host_interruption_policy:
      "Host desktop action is blocked until a private BIOS body lane is ready.",
    user_control_label: "No private desktop control is active.",
    viewport_title: "BIOS Home",
    next_body_action: "Send work to wake the BIOS body.",
    target_url: null,
    ghosting_protected: true,
    last_observed_at: new Date().toISOString(),
  };
}

function buildBiosShellContract(payload, workerStatus, boxedStatus) {
  const profileId = payload?.profile_id || payload?.profileId || null;
  const bossName = payload?.boss_name || payload?.bossName || (profileId ? "BOSS" : null);
  const runtime = runtimeStatusFromWorkerAndBoxedStatus(workerStatus, boxedStatus, payload);
  return {
    owner: "electron-main-sidecar",
    shell: "electron",
    profile: {
      id: profileId,
      display_name: bossName,
    },
    onboarding: {
      completed: Boolean(profileId),
      agent_name: bossName,
      permission_mode: "ask_first",
      model_pref: runtime.model_pref,
      safety_posture_label: "Native boxed-lane hardened",
      execution_mode: "sandbox-first",
      sandbox_backend: boxedStatus.backend || "native boxed lane",
      tool_creation_policy: "Build and test in sandbox first",
      network_posture: "Prefer sandbox-only network for untrusted work",
      host_access: "Promotion required before host writes",
      promotion_policy: "Approval and validation before host adoption",
      local_runtime_owner: "electron-main-sidecar",
      local_runtime_engine: "llama.cpp",
      local_runtime_strategy: "GPU-first local BOSS runtime",
      preferred_local_backend: "bios-ai-managed-runtime",
      local_worker_model_variant: workerStatus.variant || null,
      local_worker_model_path: workerStatus.model_path || null,
      local_worker_download_status: null,
      timestamp: new Date().toISOString(),
    },
    runtime,
    boxed_lane: boxedLaneContract(boxedStatus, workerStatus),
    promotion: promotionContract(boxedStatus),
    sandbox_state: sandboxStateContract(boxedStatus),
    diagnostics: diagnosticsContract(runtime, boxedStatus),
    memory: {
      owner: "electron-main-sidecar",
      schema: "bios-memory-surface-v1",
      total_events: 0,
      live_learning_count: 0,
      live_learning_summary: "Electron sidecar memory surface is waiting for active BOSS work.",
      standing_orders: [],
      user_preferences: [],
      mission_facts: [],
      relationship_notes: [],
      identity_notes: [],
      skill_candidates: [],
      pending_approval_changes: [],
      promotion_queue: [],
      recent_events: [],
      metrics: {},
      consolidated_memory: [],
    },
    soul: {
      owner: "electron-main-sidecar",
      pending_changes: [],
      recent_revisions: [],
      summary: "No pending soul governance changes.",
    },
    dream: {
      owner: "electron-main-sidecar",
      ready: false,
      state: "waiting",
      summary: "Dream cycle waits for active BOSS work.",
      queued_candidates: 0,
      durable_memory_count: 0,
    },
    brainstem: {
      owner: "electron-main-sidecar",
      lifecycle: runtime.route_ready ? "idle" : "recovering",
      health: runtime.route_ready ? "ready" : "needs_setup",
      summary: runtime.route_ready
        ? "BOSS route is ready through the Electron sidecar."
        : "BOSS route needs local setup.",
      recovery_action: runtime.route_ready ? "observe" : "restore_local_route",
      route_ready: runtime.route_ready,
    },
    circadian: {
      owner: "electron-main-sidecar",
      state: "awake",
      summary: "Circadian surface is available after BOSS work begins.",
    },
    glymphatic: {
      owner: "electron-main-sidecar",
      state: "idle",
      summary: "Compaction waits for BOSS work.",
    },
    reflex: {
      owner: "electron-main-sidecar",
      state: "idle",
      summary: "Reflex growth waits for field evidence.",
    },
    observation: observationContract(profileId),
    truth_spine: {
      owner: "electron-main-sidecar",
      visibility: "internal",
      summary: "TruthSpine remains an internal BOSS truth and compaction mechanism.",
    },
    skill_library: {
      owner: "electron-main-sidecar",
      profile_id: profileId,
      hardened_skill_count: 0,
      artifacts: [],
    },
  };
}

async function installedModels(modelsDir, deps = {}) {
  if (!(await pathExists(modelsDir, deps))) {
    return [];
  }
  const entries = await (deps.readdir ?? readdir)(modelsDir, { withFileTypes: true });
  const installed = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".gguf")) {
      continue;
    }
    const modelPath = path.join(modelsDir, entry.name);
    const metadata = await (deps.stat ?? stat)(modelPath);
    const managed = MANAGED_MODELS.find((candidate) => candidate.file_name === entry.name);
    installed.push({
      variant: managed?.variant || "external",
      model_id: managed?.model_id || entry.name.replace(/\.gguf$/i, ""),
      file_name: entry.name,
      path: modelPath,
      size_bytes: metadata.size,
      managed: Boolean(managed),
    });
  }
  installed.sort((left, right) => left.file_name.localeCompare(right.file_name));
  return installed;
}

async function workerModelCatalog(modelsDir, deps = {}) {
  const installed = await installedModels(modelsDir, deps);
  const installedByFile = new Map(installed.map((model) => [model.file_name, model]));
  return MANAGED_MODELS.map((model) => {
    const installedModel = installedByFile.get(model.file_name);
    return {
      ...model,
      managed: true,
      download_supported: true,
      installed: Boolean(installedModel),
      install_path: installedModel?.path || null,
      source: "bios-managed",
    };
  });
}

function profileDownloadKey(profileId) {
  return String(profileId || "default").trim() || "default";
}

function emptyDownloadStatus() {
  return {
    state: "idle",
    variant: null,
    file_name: null,
    downloaded_bytes: 0,
    total_bytes: null,
    progress_percent: null,
    target_path: null,
    error: null,
    resumable: false,
    retry_count: 0,
  };
}

function emptyDownloadQueueStatus() {
  return {
    state: "idle",
    requested_variants: [],
    completed_variants: [],
    active_variant: null,
    failed_variant: null,
    total_count: 0,
    completed_count: 0,
    error: null,
    updated_at: new Date().toISOString(),
  };
}

function downloadState(profileId) {
  const key = profileDownloadKey(profileId);
  if (!downloadStates.has(key)) {
    downloadStates.set(key, emptyDownloadStatus());
  }
  return downloadStates.get(key);
}

function updateDownloadState(profileId, update) {
  const key = profileDownloadKey(profileId);
  const next = { ...downloadState(profileId) };
  update(next);
  downloadStates.set(key, next);
  return next;
}

function downloadQueueState(profileId) {
  const key = profileDownloadKey(profileId);
  if (!downloadQueues.has(key)) {
    downloadQueues.set(key, emptyDownloadQueueStatus());
  }
  return downloadQueues.get(key);
}

function updateDownloadQueue(profileId, update) {
  const key = profileDownloadKey(profileId);
  const next = { ...downloadQueueState(profileId) };
  update(next);
  next.updated_at = new Date().toISOString();
  downloadQueues.set(key, next);
  return next;
}

function managedModelByVariant(variant) {
  return MANAGED_MODELS.find((model) => model.variant === variant);
}

async function modelInstalled(modelsDir, model, deps = {}) {
  const targetPath = path.join(modelsDir, model.file_name);
  if (await pathExists(targetPath, deps)) {
    const metadata = await (deps.stat ?? stat)(targetPath);
    return { targetPath, size: metadata.size };
  }
  return { targetPath, size: 0 };
}

async function downloadManagedModel(profileId, model, modelsDir, deps = {}) {
  const fetcher = deps.fetch ?? globalThis.fetch;
  const { targetPath } = await modelInstalled(modelsDir, model, deps);
  const partialPath = `${targetPath}.partial`;
  await (deps.mkdir ?? mkdir)(modelsDir, { recursive: true });
  const existingPartial = await (deps.stat ?? stat)(partialPath).catch(() => null);
  const resumeFrom = existingPartial?.size || 0;
  const headers = resumeFrom > 0 ? { range: `bytes=${resumeFrom}-` } : {};
  updateDownloadState(profileId, (state) => {
    Object.assign(state, {
      state: "downloading",
      variant: model.variant,
      file_name: model.file_name,
      downloaded_bytes: resumeFrom,
      target_path: targetPath,
      error: null,
      resumable: resumeFrom > 0,
    });
  });
  try {
    const response = await fetcher(model.download_url, {
      headers,
      redirect: "follow",
    });
    if (!response?.ok && response?.status !== 206) {
      throw new Error(`Model download failed with HTTP status ${response?.status || "unknown"}`);
    }
    const contentLength = Number(response.headers?.get?.("content-length") || 0);
    const totalBytes = contentLength > 0 ? contentLength + resumeFrom : null;
    const file = await open(partialPath, resumeFrom > 0 ? "a" : "w");
    let downloadedBytes = resumeFrom;
    try {
      const reader = response.body?.getReader?.();
      if (!reader) {
        const body = Buffer.from(await response.arrayBuffer());
        await file.write(body);
        downloadedBytes += body.length;
        updateDownloadState(profileId, (state) => {
          state.downloaded_bytes = downloadedBytes;
          state.total_bytes = totalBytes || downloadedBytes;
          state.progress_percent = state.total_bytes
            ? Math.round((downloadedBytes / state.total_bytes) * 1000) / 10
            : null;
        });
      } else {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          const chunk = Buffer.from(value);
          await file.write(chunk);
          downloadedBytes += chunk.length;
          updateDownloadState(profileId, (state) => {
            state.downloaded_bytes = downloadedBytes;
            state.total_bytes = totalBytes;
            state.progress_percent = totalBytes
              ? Math.round((downloadedBytes / totalBytes) * 1000) / 10
              : null;
          });
        }
      }
    } finally {
      await file.close();
    }
    await (deps.rename ?? rename)(partialPath, targetPath);
    return updateDownloadState(profileId, (state) => {
      state.state = "completed";
      state.downloaded_bytes = downloadedBytes;
      state.total_bytes = downloadedBytes;
      state.progress_percent = 100;
      state.error = null;
      state.resumable = false;
    });
  } catch (error) {
    const partial = await (deps.stat ?? stat)(partialPath).catch(() => null);
    return updateDownloadState(profileId, (state) => {
      state.state = "failed";
      state.error = error?.message || String(error);
      state.downloaded_bytes = partial?.size || state.downloaded_bytes || 0;
      state.resumable = Boolean(partial?.size);
      state.retry_count = (state.retry_count || 0) + 1;
    });
  }
}

async function startWorkerModelDownload(payload = {}, deps = {}) {
  const profileId =
    payload.profileId ||
    payload.profile_id ||
    payload.input?.profile_id ||
    payload.input?.profileId;
  const variant = payload.variant || payload.input?.variant;
  const modelsDir =
    payload.path ||
    payload.models_dir ||
    payload.input?.path ||
    payload.input?.models_dir ||
    defaultModelsDir();
  const model = managedModelByVariant(variant);
  if (!model) {
    throw new Error(`Unknown BIOS AI managed model variant: ${variant}`);
  }
  const installed = await modelInstalled(modelsDir, model, deps);
  if (installed.size > 0) {
    return updateDownloadState(profileId, (state) => {
      Object.assign(state, {
        state: "installed",
        variant: model.variant,
        file_name: model.file_name,
        downloaded_bytes: installed.size,
        total_bytes: installed.size,
        progress_percent: 100,
        target_path: installed.targetPath,
        error: null,
        resumable: false,
      });
    });
  }
  const current = downloadState(profileId);
  if (current.state === "downloading") {
    return current;
  }
  const targetPath = path.join(modelsDir, model.file_name);
  const started = updateDownloadState(profileId, (state) => {
    Object.assign(state, {
      state: "downloading",
      variant: model.variant,
      file_name: model.file_name,
      downloaded_bytes: 0,
      total_bytes: null,
      progress_percent: null,
      target_path: targetPath,
      error: null,
      resumable: false,
    });
  });
  void downloadManagedModel(profileId, model, modelsDir, deps);
  return started;
}

async function startAllWorkerModelDownloads(payload = {}, deps = {}) {
  const profileId =
    payload.profileId ||
    payload.profile_id ||
    payload.input?.profile_id ||
    payload.input?.profileId;
  const modelsDir =
    payload.path ||
    payload.models_dir ||
    payload.input?.path ||
    payload.input?.models_dir ||
    defaultModelsDir();
  const catalog = await workerModelCatalog(modelsDir, deps);
  const missing = catalog
    .filter((model) => model.download_supported && !model.installed)
    .map((model) => model.variant);
  if (downloadQueueState(profileId).state === "running") {
    return downloadQueueState(profileId);
  }
  if (missing.length === 0) {
    return updateDownloadQueue(profileId, (state) => {
      Object.assign(state, {
        state: "completed",
        requested_variants: [],
        completed_variants: [],
        active_variant: null,
        failed_variant: null,
        total_count: 0,
        completed_count: 0,
        error: null,
      });
    });
  }
  const initial = updateDownloadQueue(profileId, (state) => {
    Object.assign(state, {
      state: "running",
      requested_variants: missing,
      completed_variants: [],
      active_variant: missing[0],
      failed_variant: null,
      total_count: missing.length,
      completed_count: 0,
      error: null,
    });
  });
  void (async () => {
    for (const variant of missing) {
      updateDownloadQueue(profileId, (state) => {
        state.active_variant = variant;
      });
      const model = managedModelByVariant(variant);
      const result = await downloadManagedModel(profileId, model, modelsDir, deps);
      if (result.state === "failed") {
        updateDownloadQueue(profileId, (state) => {
          state.state = "failed";
          state.failed_variant = variant;
          state.error = result.error;
          state.active_variant = null;
        });
        return;
      }
      updateDownloadQueue(profileId, (state) => {
        state.completed_variants = [...state.completed_variants, variant];
        state.completed_count = state.completed_variants.length;
      });
    }
    updateDownloadQueue(profileId, (state) => {
      state.state = "completed";
      state.active_variant = null;
      state.error = null;
    });
  })();
  return initial;
}

async function invokeBiosSidecarCommandCore(command, payload = {}, deps = {}) {
  switch (command) {
    case "system_discovery":
      const gpu = await detectGpu(deps);
      return {
        owner: "electron-main-sidecar",
        shell: "electron",
        platform: process.platform,
        arch: process.arch,
        cpu: {
          logical_cores: os.cpus().length,
          model: os.cpus()[0]?.model || "unknown",
        },
        memory: {
          total_bytes: os.totalmem(),
          free_bytes: os.freemem(),
        },
        gpu,
      };
    case "bios_shell_contract":
      const contractWorkerStatus = await workerRuntimeStatus(payload, deps);
      const contractBoxedStatus = await detectBoxedLaneStatus(deps);
      return buildBiosShellContract(payload, contractWorkerStatus, contractBoxedStatus);
    case "bios_runtime_status":
      const workerStatus = await workerRuntimeStatus(payload, deps);
      const boxedStatus = await detectBoxedLaneStatus(deps);
      return runtimeStatusFromWorkerAndBoxedStatus(workerStatus, boxedStatus, payload);
    case "bios_boxed_lane_status":
      return detectBoxedLaneStatus(deps);
    case "bios_prepare_boxed_lane":
      return prepareBoxedLane(payload, deps);
    case "worker_assets_status":
      const modelsDir = payload?.path || payload?.models_dir || defaultModelsDir();
      const assetsProfileId = payload?.profileId || payload?.profile_id;
      return {
        owner: "electron-main-sidecar",
        status: "ready",
        models_dir: modelsDir,
        installed_models: await installedModels(modelsDir, deps),
        bundled_sidecar_available: false,
        bundled_sidecar_path: null,
        selected_model: null,
        download: downloadState(assetsProfileId),
        download_queue: downloadQueueState(assetsProfileId),
      };
    case "worker_model_catalog":
      const catalogModelsDir = payload?.path || payload?.models_dir || defaultModelsDir();
      return {
        owner: "electron-main-sidecar",
        status: "ready",
        effective_path: catalogModelsDir,
        models: await workerModelCatalog(catalogModelsDir, deps),
      };
    case "start_worker_model_download":
      return startWorkerModelDownload(payload, deps);
    case "start_all_worker_model_downloads":
      return startAllWorkerModelDownloads(payload, deps);
    case "append_debug_log":
      return {
        accepted: true,
        persisted: true,
        owner: "electron-main-sidecar",
        record: await appendSidecarDebugLog(
          "frontend.append_debug_log",
          payload?.event || payload?.input?.event || "frontend.event",
          payload?.details ?? payload?.input?.details ?? "",
          deps,
        ),
      };
    case "read_debug_log":
      try {
        return await (deps.readFile ?? readFile)(defaultDebugLogPath(), "utf8");
      } catch {
        return "";
      }
    case "probe_local_runtime":
      return probeLocalRuntime(payload, deps);
    case "bios_local_worker_runtime_status":
      return workerRuntimeStatus(payload, deps);
    case "chat_with_local_worker":
      return chatWithLocalWorker(payload, deps);
    case "shutdown_local_worker_runtime":
      return shutdownLocalWorkerRuntime();
    default:
      throw new Error(`Unsupported BIOS sidecar command: ${command}`);
  }
}

export async function invokeBiosSidecarCommand(command, payload = {}, deps = {}) {
  const startedAt = Date.now();
  try {
    const result = await invokeBiosSidecarCommandCore(command, payload, deps);
    if (command !== "append_debug_log") {
      await appendSidecarDebugLog(
        "electron.sidecar",
        `command.${command}.success`,
        {
          command,
          duration_ms: Date.now() - startedAt,
          result_state: result?.status || result?.install_state || result?.action_taken || "ok",
        },
        deps,
      ).catch(() => null);
    }
    return result;
  } catch (error) {
    await appendSidecarDebugLog(
      "electron.sidecar",
      `command.${command}.failure`,
      {
        command,
        duration_ms: Date.now() - startedAt,
        error: error?.message || String(error),
      },
      deps,
    ).catch(() => null);
    throw error;
  }
}

export async function runBiosSidecarSmokeProof() {
  const system = await invokeBiosSidecarCommand("system_discovery");
  const runtime = await invokeBiosSidecarCommand("bios_runtime_status", {
    profile_id: "smoke",
    boss_name: "smoke",
  });
  const contract = await invokeBiosSidecarCommand("bios_shell_contract", {
    profile_id: "smoke",
    boss_name: "smoke",
  });
  const boxed = await invokeBiosSidecarCommand("bios_boxed_lane_status");
  const prepare = await invokeBiosSidecarCommand("bios_prepare_boxed_lane");
  const assets = await invokeBiosSidecarCommand("worker_assets_status");
  const catalog = await invokeBiosSidecarCommand("worker_model_catalog");
  const worker = await invokeBiosSidecarCommand("bios_local_worker_runtime_status", {
    profile_id: "smoke",
  });
  return {
    status:
      system.owner === "electron-main-sidecar" &&
      runtime.owner === "electron-main-sidecar" &&
      contract.owner === "electron-main-sidecar" &&
      contract.runtime?.owner === "electron-main-sidecar" &&
      boxed.owner === "electron-main-sidecar" &&
      prepare.owner === "electron-main-sidecar" &&
      prepare.action_taken !== "blocked_without_repair_owner" &&
      assets.owner === "electron-main-sidecar" &&
      catalog.owner === "electron-main-sidecar" &&
      worker.owner === "electron-main-sidecar" &&
      catalog.models.length === MANAGED_MODELS.length
        ? "pass"
        : "fail",
    commands: {
      system_discovery: system.owner,
      bios_shell_contract: contract.owner,
      bios_runtime_status: runtime.owner,
      bios_boxed_lane_status: boxed.owner,
      bios_prepare_boxed_lane: prepare.action_taken,
      worker_assets_status: assets.owner,
      worker_model_catalog: catalog.owner,
      bios_local_worker_runtime_status: worker.owner,
    },
  };
}
