import os from "node:os";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const LOCAL_WORKER_PORT = 30011;
export const WORKER_ROLE_BOSS_BRAIN = "boss_brain";

const ACCELERATOR_HINTS = [
  "cuda",
  "cublas",
  "vulkan",
  "metal",
  "rocm",
  "hip",
  "sycl",
  "oneapi",
  "opencl",
  "directml",
  "musa",
  "cann",
  "gpu",
  "nvidia",
  "geforce",
  "rtx",
  "gtx",
  "quadro",
  "amd",
  "radeon",
  "intel arc",
  "apple",
];

const workerProcess = {
  child: null,
  profileId: null,
  modelPath: null,
  workerRole: null,
  modelId: null,
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEVICE_PROBE_TIMEOUT_MS = 180_000;

function biosStateRoot() {
  const override = process.env.BIOS_AI_HOME_OVERRIDE?.trim();
  if (override) {
    return override;
  }
  return path.join(os.homedir(), ".agentos", "bios-ai");
}

function profileDir(profileId) {
  return path.join(biosStateRoot(), "profiles", profileId);
}

function normalizeProfileId(profileId) {
  return String(profileId || "").trim();
}

export function normalizeWorkerRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (!normalized || normalized === "boss" || normalized === WORKER_ROLE_BOSS_BRAIN) {
    return WORKER_ROLE_BOSS_BRAIN;
  }
  if (["medium", "worker_medium"].includes(normalized)) {
    return "worker_medium";
  }
  if (["small", "worker_small"].includes(normalized)) {
    return "worker_small";
  }
  return WORKER_ROLE_BOSS_BRAIN;
}

function userChatWorkerRole() {
  return WORKER_ROLE_BOSS_BRAIN;
}

async function pathExists(filePath, deps = {}) {
  try {
    await (deps.access ?? access)(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, deps = {}) {
  try {
    return JSON.parse(await (deps.readFile ?? readFile)(filePath, "utf8"));
  } catch {
    return null;
  }
}

function workerSelectionPath(profileId) {
  return path.join(profileDir(profileId), "worker-model.json");
}

function workerRosterPath(profileId) {
  return path.join(profileDir(profileId), "worker-roster.json");
}

function workerStoragePath(profileId) {
  return path.join(profileDir(profileId), "worker-storage.json");
}

function localWorkerStatePath() {
  return path.join(biosStateRoot(), "runtime", "local-worker-state.json");
}

function sanitizeLogSegment(value, fallback) {
  const sanitized = String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "-");
  return sanitized || fallback;
}

function localWorkerSidecarLogPath(profileId, workerRole) {
  return path.join(
    biosStateRoot(),
    "logs",
    `local-worker-sidecar-${sanitizeLogSegment(profileId, "active")}-${sanitizeLogSegment(workerRole, "boss_brain")}.log`,
  );
}

function defaultModelsDir() {
  return path.join(biosStateRoot(), "models");
}

async function effectiveModelsDir(profileId, deps = {}) {
  const storage = await readJson(workerStoragePath(profileId), deps);
  if (typeof storage?.path === "string" && path.isAbsolute(storage.path)) {
    return storage.path;
  }
  return defaultModelsDir();
}

async function resolveSelectionForRole(profileId, requestedRole, deps = {}) {
  const role = normalizeWorkerRole(requestedRole);
  const roster = await readJson(workerRosterPath(profileId), deps);
  if (Array.isArray(roster)) {
    const entry = roster.find((candidate) => normalizeWorkerRole(candidate?.role) === role);
    if (entry?.selection?.path && (await pathExists(entry.selection.path, deps))) {
      return { ...entry.selection, workerRole: role };
    }
  }

  const selection = await readJson(workerSelectionPath(profileId), deps);
  if (selection?.path && (await pathExists(selection.path, deps))) {
    return { ...selection, workerRole: WORKER_ROLE_BOSS_BRAIN };
  }

  const modelsDir = await effectiveModelsDir(profileId, deps);
  const fallbackModelPath = path.join(modelsDir, "Qwen3-8B-Q4_K_M.gguf");
  if (await pathExists(fallbackModelPath, deps)) {
    return {
      variant: "qwen-3-8b",
      model_id: "Qwen3-8B-Q4_K_M",
      file_name: "Qwen3-8B-Q4_K_M.gguf",
      path: fallbackModelPath,
      workerRole: WORKER_ROLE_BOSS_BRAIN,
    };
  }

  return null;
}

function resourceRootCandidates() {
  const candidates = [];
  if (process.env.BIOS_AI_LLAMA_SERVER) {
    candidates.push(path.dirname(process.env.BIOS_AI_LLAMA_SERVER));
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "bin"));
    candidates.push(path.join(process.resourcesPath, "resources", "bin"));
  }
  candidates.push(path.resolve(moduleDir, "..", "resources", "bin"));
  candidates.push(path.resolve("aether-canvas", "src-tauri", "resources", "bin"));
  candidates.push(path.resolve("src-tauri", "resources", "bin"));
  return [...new Set(candidates)];
}

export async function resolveLlamaServerPath(deps = {}) {
  if (process.env.BIOS_AI_LLAMA_SERVER && (await pathExists(process.env.BIOS_AI_LLAMA_SERVER, deps))) {
    return process.env.BIOS_AI_LLAMA_SERVER;
  }
  const fileName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  for (const root of resourceRootCandidates()) {
    const candidate = path.join(root, fileName);
    if (await pathExists(candidate, deps)) {
      return candidate;
    }
  }
  return null;
}

export function localWorkerServerArgs(port, modelPath) {
  return [
    "--port",
    String(port),
    "--threads",
    "8",
    "--threads-batch",
    "8",
    "--parallel",
    "1",
    "--ctx-size",
    "8192",
    "--gpu-layers",
    "999",
    "--flash-attn",
    "auto",
    "--model",
    modelPath,
    "--no-mmproj",
  ];
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

function acceleratorBackendHint(value) {
  const lower = String(value || "").toLowerCase();
  return ACCELERATOR_HINTS.some((hint) => lower.includes(hint));
}

export function parseLocalWorkerDeviceList(raw) {
  const devices = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^available devices:?$/i.test(line));
  const ready = devices.some((device) => acceleratorBackendHint(device) && device.toLowerCase() !== "cpu");
  return {
    ready,
    devices,
    detail: ready
      ? `BIOS AI detected llama.cpp accelerator device(s): ${devices.join("; ")}.`
      : devices.length
        ? `BIOS AI refused the managed local BOSS runtime because llama.cpp did not list a GPU accelerator. Devices: ${devices.join("; ")}.`
        : "BIOS AI refused the managed local BOSS runtime because bundled llama.cpp listed no GPU/accelerator devices.",
  };
}

async function localWorkerAccelerationStatus(sidecarPath, deps = {}) {
  if (!sidecarPath) {
    return {
      ready: false,
      devices: [],
      detail: "Bundled llama-server sidecar is unavailable, so BIOS AI cannot prove GPU acceleration.",
    };
  }
  const runner = deps.runProcess ?? runHiddenProcess;
  const result = await runner(sidecarPath, ["--list-devices"], {
    cwd: path.dirname(sidecarPath),
    timeoutMs: deps.deviceProbeTimeoutMs ?? DEVICE_PROBE_TIMEOUT_MS,
  });
  if (result.status !== "pass") {
    const detail = [
      result.timedOut ? `timed out after ${Math.round((deps.deviceProbeTimeoutMs ?? DEVICE_PROBE_TIMEOUT_MS) / 1000)} seconds` : null,
      result.error,
      result.stderr,
      result.stdout,
    ]
      .filter(Boolean)
      .join(" | ");
    return {
      ready: false,
      devices: [],
      detail: `BIOS AI could not prove GPU acceleration because llama.cpp --list-devices failed${detail ? `: ${detail}` : "."}`,
    };
  }
  return parseLocalWorkerDeviceList(`${result.stdout || ""}\n${result.stderr || ""}`);
}

function localWorkerLogAcceptsAcceleration(raw) {
  const lower = String(raw || "").toLowerCase();
  return (
    (acceleratorBackendHint(lower) &&
      (lower.includes("offload") ||
        lower.includes("device_info") ||
        lower.includes("using device") ||
        lower.includes("backend"))) ||
    (lower.includes("offloaded") && lower.includes("gpu"))
  );
}

async function verifyRuntimeAcceleration(logPath, deps = {}) {
  const raw = await (deps.readFile ?? readFile)(logPath, "utf8").catch(() => "");
  if (!localWorkerLogAcceptsAcceleration(raw)) {
    throw new Error(`BIOS AI refused the managed local BOSS runtime because the sidecar log did not prove GPU acceleration. Log: ${logPath}`);
  }
}

async function persistLocalWorkerState(state, deps = {}) {
  const statePath = localWorkerStatePath();
  await (deps.mkdir ?? mkdir)(path.dirname(statePath), { recursive: true });
  await (deps.writeFile ?? writeFile)(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function spawnWorkerProcess(sidecarPath, args, logPath, deps = {}) {
  if (deps.spawnWorker) {
    return deps.spawnWorker(sidecarPath, args, { cwd: path.dirname(sidecarPath), logPath });
  }
  const stream = createWriteStream(logPath, { flags: "w" });
  const child = spawn(sidecarPath, args, {
    cwd: path.dirname(sidecarPath),
    windowsHide: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(stream, { end: false });
  child.stderr?.pipe(stream, { end: false });
  child.once("close", () => {
    stream.end();
  });
  child.once("error", () => {
    stream.end();
  });
  return child;
}

function childStillRunning(child) {
  if (!child) {
    return false;
  }
  if (typeof child.exitCode === "number" && child.exitCode !== null) {
    return false;
  }
  return !child.killed;
}

async function localWorkerStartupAttempts(modelPath, deps = {}) {
  const metadata = await (deps.stat ?? stat)(modelPath).catch(() => null);
  const sizeBytes = metadata?.size ?? 0;
  if (sizeBytes >= 8_000_000_000) {
    return 360;
  }
  if (sizeBytes >= 4_000_000_000) {
    return 240;
  }
  return 180;
}

async function waitForWorkerReady(child, modelId, logPath, deps = {}) {
  const fetcher = deps.fetch ?? globalThis.fetch;
  const attempts = deps.startupAttempts ?? 180;
  const delayMs = deps.startupDelayMs ?? 500;
  for (let index = 0; index < attempts; index += 1) {
    if (!childStillRunning(child)) {
      throw new Error(`Local worker exited before it became ready. Log: ${logPath}`);
    }
    try {
      const response = await fetcher(`http://127.0.0.1:${LOCAL_WORKER_PORT}/v1/models`);
      if (response?.ok) {
        await verifyRuntimeAcceleration(logPath, deps);
        return modelId;
      }
    } catch {
      // Keep probing until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Local worker sidecar did not become ready in time after about ${Math.round((attempts * delayMs) / 1000)} seconds. Sidecar log: ${logPath}`);
}

export async function ensureLocalWorkerServer(payload = {}, deps = {}) {
  const profileId = normalizeProfileId(payload.profileId || payload.profile_id);
  if (!profileId) {
    throw new Error("No BOSS profile is active, so BIOS AI cannot start the managed local BOSS runtime.");
  }
  const requestedRole = normalizeWorkerRole(payload.workerRole || payload.worker_role);
  const resolvedRole = requestedRole === WORKER_ROLE_BOSS_BRAIN ? WORKER_ROLE_BOSS_BRAIN : requestedRole;
  const selection = await resolveSelectionForRole(profileId, resolvedRole, deps);
  if (!selection) {
    throw new Error("No BOSS brain model is installed or selected.");
  }
  const sidecarPath = await resolveLlamaServerPath(deps);
  const acceleration = await localWorkerAccelerationStatus(sidecarPath, deps);
  if (!acceleration.ready) {
    if (workerProcess.child) {
      workerProcess.child.kill?.();
    }
    workerProcess.child = null;
    workerProcess.profileId = null;
    workerProcess.modelPath = null;
    workerProcess.workerRole = null;
    workerProcess.modelId = null;
    throw new Error(acceleration.detail);
  }

  const modelPath = selection.path;
  const modelId = selection.model_id || selection.modelId || path.basename(modelPath, ".gguf");
  if (
    childStillRunning(workerProcess.child) &&
    workerProcess.profileId === profileId &&
    workerProcess.modelPath === modelPath &&
    workerProcess.workerRole === resolvedRole
  ) {
    return { modelId: workerProcess.modelId || modelId, workerRole: resolvedRole, reused: true };
  }

  if (workerProcess.child) {
    workerProcess.child.kill?.();
  }

  const logPath = localWorkerSidecarLogPath(profileId, resolvedRole);
  await (deps.mkdir ?? mkdir)(path.dirname(logPath), { recursive: true });
  const args = localWorkerServerArgs(LOCAL_WORKER_PORT, modelPath);
  const child = spawnWorkerProcess(sidecarPath, args, logPath, deps);
  workerProcess.child = child;
  workerProcess.profileId = profileId;
  workerProcess.modelPath = modelPath;
  workerProcess.workerRole = resolvedRole;
  workerProcess.modelId = modelId;
  await persistLocalWorkerState(
    {
      pid: child.pid ?? child.id?.() ?? 0,
      sidecar_path: sidecarPath,
      model_path: modelPath,
      profile_id: profileId,
      worker_role: resolvedRole,
      updated_at_ms: Date.now(),
      shell: "electron",
    },
    deps,
  );
  await waitForWorkerReady(child, modelId, logPath, {
    ...deps,
    startupAttempts: deps.startupAttempts ?? (await localWorkerStartupAttempts(modelPath, deps)),
  });
  return { modelId, workerRole: resolvedRole, reused: false, logPath };
}

function openAiMessages(messages, systemPrompt) {
  const converted = [{ role: "system", content: systemPrompt }];
  for (const message of messages || []) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const content = message?.content ?? message?.text ?? "";
    if (String(content).trim()) {
      converted.push({ role, content: String(content) });
    }
  }
  return converted;
}

export async function chatWithLocalWorker(payload = {}, deps = {}) {
  const agentName = payload.agentName || payload.agent_name || "BOSS";
  const systemPrompt =
    payload.systemPrompt ||
    payload.system_prompt ||
    `You are ${agentName}, the BOSS agent running inside BIOS AI - a local-first agent operating system. You are the user's personal AI that knows them, works for them, and can self-extend. Be direct, practical, and honest about local-model limits. Prefer clear next steps over long explanations.`;
  const worker = await ensureLocalWorkerServer(
    {
      ...payload,
      workerRole: userChatWorkerRole(payload.workerRole || payload.worker_role),
    },
    deps,
  );
  const fetcher = deps.fetch ?? globalThis.fetch;
  const response = await fetcher(`http://127.0.0.1:${LOCAL_WORKER_PORT}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: worker.modelId,
      messages: openAiMessages(payload.messages || [], systemPrompt),
      max_tokens: Number.isFinite(Number(payload.maxTokens ?? payload.max_tokens))
        ? Math.max(1, Math.min(2048, Math.floor(Number(payload.maxTokens ?? payload.max_tokens))))
        : undefined,
      temperature: Number.isFinite(Number(payload.temperature))
        ? Math.max(0, Math.min(2, Number(payload.temperature)))
        : undefined,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Local worker returned ${response.status}: ${text}`);
  }
  const parsed = JSON.parse(text);
  const content = parsed?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Local worker response did not include assistant content.");
  }
  return content;
}

export async function probeLocalRuntime(payload = {}, deps = {}) {
  const provider = String(payload.provider || "").trim().toLowerCase();
  if (!["bios-managed", "bios-worker"].includes(provider)) {
    throw new Error(`Electron sidecar only owns BIOS-managed runtime probing, not provider: ${payload.provider}`);
  }
  const worker = await ensureLocalWorkerServer(payload, deps);
  return {
    provider: "bios-managed",
    reachable: true,
    resolved_model: worker.modelId,
    endpoint: `http://127.0.0.1:${LOCAL_WORKER_PORT}/v1/chat/completions`,
    detail: `BIOS AI managed llama.cpp runtime is reachable with ${worker.modelId} on the ${worker.workerRole} lane.`,
  };
}

export async function workerRuntimeStatus(payload = {}, deps = {}) {
  const profileId = normalizeProfileId(payload.profileId || payload.profile_id);
  const sidecarPath = await resolveLlamaServerPath(deps);
  const selection = profileId
    ? await resolveSelectionForRole(profileId, normalizeWorkerRole(payload.workerRole || payload.worker_role), deps)
    : null;
  if (!selection) {
    return {
      owner: "electron-main-sidecar",
      status: "blocked",
      profile_id: profileId || null,
      model_id: null,
      model_path: null,
      sidecar_path: sidecarPath,
      gpu_acceleration_ready: false,
      gpu_devices: [],
      detail: "No BOSS brain model is installed or selected.",
    };
  }
  const acceleration = await localWorkerAccelerationStatus(sidecarPath, deps);
  return {
    owner: "electron-main-sidecar",
    status: selection && sidecarPath && acceleration.ready ? "ready_to_launch" : "blocked",
    profile_id: profileId || null,
    model_id: selection?.model_id || null,
    model_path: selection?.path || null,
    sidecar_path: sidecarPath,
    gpu_acceleration_ready: acceleration.ready,
    gpu_devices: acceleration.devices,
    detail: selection
      ? acceleration.detail
      : "No BOSS brain model is installed or selected.",
  };
}

export async function shutdownLocalWorkerRuntime() {
  if (workerProcess.child) {
    workerProcess.child.kill?.();
  }
  workerProcess.child = null;
  workerProcess.profileId = null;
  workerProcess.modelPath = null;
  workerProcess.workerRole = null;
  workerProcess.modelId = null;
  return {
    owner: "electron-main-sidecar",
    stopped: true,
  };
}
