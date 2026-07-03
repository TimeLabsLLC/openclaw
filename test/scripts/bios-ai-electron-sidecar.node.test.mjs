import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  invokeBiosSidecarCommand,
  isBiosSidecarCommand,
  runBiosSidecarSmokeProof,
} from "../../aether-canvas/electron/bios-sidecar.mjs";
import { invokeElectronShellSpikeCommand } from "../../aether-canvas/electron/spike-runtime.mjs";
import {
  chatWithLocalWorker,
  localWorkerServerArgs,
  parseLocalWorkerDeviceList,
  workerRuntimeStatus,
} from "../../aether-canvas/electron/worker-runtime.mjs";

describe("BIOS AI Electron sidecar adapter", () => {
  it("owns BIOS system, runtime, boxed-lane status, and boxed-lane repair commands", async () => {
    assert.equal(isBiosSidecarCommand("system_discovery"), true);
    assert.equal(isBiosSidecarCommand("bios_shell_contract"), true);
    assert.equal(isBiosSidecarCommand("bios_runtime_status"), true);
    assert.equal(isBiosSidecarCommand("bios_boxed_lane_status"), true);
    assert.equal(isBiosSidecarCommand("bios_prepare_boxed_lane"), true);
    assert.equal(isBiosSidecarCommand("worker_assets_status"), true);
    assert.equal(isBiosSidecarCommand("worker_model_catalog"), true);
    assert.equal(isBiosSidecarCommand("start_worker_model_download"), true);
    assert.equal(isBiosSidecarCommand("start_all_worker_model_downloads"), true);
    assert.equal(isBiosSidecarCommand("read_debug_log"), true);
    assert.equal(isBiosSidecarCommand("probe_local_runtime"), true);
    assert.equal(isBiosSidecarCommand("bios_local_worker_runtime_status"), true);
    assert.equal(isBiosSidecarCommand("chat_with_local_worker"), true);

    const discovery = await invokeBiosSidecarCommand("system_discovery", {}, {
      runProcess: async () => ({ status: "fail", exitCode: 1, timedOut: false, stdout: "", stderr: "" }),
    });
    assert.equal(discovery.owner, "electron-main-sidecar");
    assert.equal(discovery.cpu.logical_cores > 0, true);

    const boxed = await invokeBiosSidecarCommand("bios_prepare_boxed_lane", {}, {
      platform: "win32",
      runProcess: async (command, args) => {
        assert.equal(command, "wsl.exe");
        if (args.join(" ") === "--status") {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "Default Version: 2", stderr: "" };
        }
        if (args.join(" ") === "--version") {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "WSL version: 2.7.8.0", stderr: "" };
        }
        if (args.join(" ") === "--list --verbose") {
          return {
            status: "pass",
            exitCode: 0,
            timedOut: false,
            stdout: "  NAME      STATE           VERSION\n* Ubuntu    Stopped         2\n",
            stderr: "",
          };
        }
        if (args.join(" ") === "-d Ubuntu -- uname -s") {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "Linux\n", stderr: "" };
        }
        throw new Error(`unexpected boxed command ${args.join(" ")}`);
      },
    });
    assert.equal(boxed.action_taken, "verified_existing_boxed_lane");
    assert.equal(boxed.ready, true);
  });

  it("queues boxed-lane repair without OS mutation when the distro is missing", async () => {
    const prepare = await invokeBiosSidecarCommand("bios_prepare_boxed_lane", {}, {
      platform: "win32",
      runProcess: async (command, args) => {
        assert.equal(command, "wsl.exe");
        if (args.join(" ") === "--status" || args.join(" ") === "--version") {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "WSL version: 2.7.8.0", stderr: "" };
        }
        if (args.join(" ") === "--list --verbose") {
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "  NAME STATE VERSION\n", stderr: "" };
        }
        throw new Error(`unexpected boxed command ${args.join(" ")}`);
      },
    });

    assert.equal(prepare.action_taken, "background_repair_queued");
    assert.equal(prepare.ready, false);
    assert.match(prepare.blocked_reason, /will not change OS features/);
  });

  it("serves the BIOS shell contract through the Electron sidecar", async () => {
    const previous = process.env.BIOS_AI_LLAMA_SERVER;
    process.env.BIOS_AI_LLAMA_SERVER = "C:/BIOS/bin/llama-server.exe";
    try {
      const contract = await invokeBiosSidecarCommand(
        "bios_shell_contract",
        { profile_id: "babs", boss_name: "B.A.Bs" },
        {
          platform: "win32",
          access: async () => {},
          readFile: async (filePath) => {
            if (String(filePath).endsWith("worker-model.json")) {
              return JSON.stringify({
                variant: "qwen-3-14b",
                model_id: "Qwen3-14B-Q4_K_M",
                file_name: "Qwen3-14B-Q4_K_M.gguf",
                path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
              });
            }
            throw new Error(`unexpected read ${filePath}`);
          },
          runProcess: async (command, args) => {
            if (command === "wsl.exe" && args.join(" ") === "--status") {
              return { status: "pass", exitCode: 0, timedOut: false, stdout: "Default Version: 2", stderr: "" };
            }
            if (command === "wsl.exe" && args.join(" ") === "--version") {
              return { status: "pass", exitCode: 0, timedOut: false, stdout: "WSL version: 2.7.8.0", stderr: "" };
            }
            if (command === "wsl.exe" && args.join(" ") === "--list --verbose") {
              return {
                status: "pass",
                exitCode: 0,
                timedOut: false,
                stdout: "  NAME      STATE           VERSION\n* Ubuntu    Stopped         2\n",
                stderr: "",
              };
            }
            if (command === "wsl.exe" && args.join(" ") === "-d Ubuntu -- uname -s") {
              return { status: "pass", exitCode: 0, timedOut: false, stdout: "Linux\n", stderr: "" };
            }
            if (command === "C:/BIOS/bin/llama-server.exe") {
              return {
                status: "pass",
                exitCode: 0,
                timedOut: false,
                stdout: "CUDA0: NVIDIA GeForce RTX 5070 Ti\n",
                stderr: "",
              };
            }
            throw new Error(`unexpected command ${command} ${args.join(" ")}`);
          },
        },
      );

      assert.equal(contract.owner, "electron-main-sidecar");
      assert.equal(contract.shell, "electron");
      assert.equal(contract.profile.id, "babs");
      assert.equal(contract.onboarding.completed, true);
      assert.equal(contract.runtime.owner, "electron-main-sidecar");
      assert.equal(contract.runtime.profile_id, "babs");
      assert.equal(contract.boxed_lane.provisioning.safe_to_run_untrusted_work, true);
      assert.equal(contract.promotion.state, "ready");
      assert.equal(contract.diagnostics.owner, "electron-main-sidecar");
      assert.equal(contract.truth_spine.visibility, "internal");
    } finally {
      if (previous === undefined) {
        delete process.env.BIOS_AI_LLAMA_SERVER;
      } else {
        process.env.BIOS_AI_LLAMA_SERVER = previous;
      }
    }
  });

  it("reads NVIDIA VRAM through the hidden sidecar GPU probe", async () => {
    const discovery = await invokeBiosSidecarCommand("system_discovery", {}, {
      runProcess: async (command, args) => {
        assert.equal(command, "nvidia-smi");
        assert.deepEqual(args, ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]);
        return {
          status: "pass",
          exitCode: 0,
          timedOut: false,
          stdout: "NVIDIA GeForce RTX 5070 Ti, 16303\n",
          stderr: "",
        };
      },
    });

    assert.equal(discovery.gpu.detected, true);
    assert.equal(discovery.gpu.source, "nvidia-smi");
    assert.equal(discovery.gpu.gpu_vendor, "NVIDIA");
    assert.equal(discovery.gpu.gpu_vram_gb, 15.9);
  });

  it("discovers installed managed and external GGUF worker models from the model directory", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-sidecar-models-"));
    const modelsDir = path.join(tempRoot, "models");
    await mkdir(modelsDir, { recursive: true });
    await writeFile(path.join(modelsDir, "Qwen3-14B-Q4_K_M.gguf"), "managed");
    await writeFile(path.join(modelsDir, "Custom-Worker.gguf"), "external");

    const assets = await invokeBiosSidecarCommand("worker_assets_status", { models_dir: modelsDir });
    const catalog = await invokeBiosSidecarCommand("worker_model_catalog", { models_dir: modelsDir });

    assert.equal(assets.owner, "electron-main-sidecar");
    assert.equal(assets.installed_models.length, 2);
    assert.equal(
      assets.installed_models.find((model) => model.file_name === "Qwen3-14B-Q4_K_M.gguf")?.variant,
      "qwen-3-14b",
    );
    assert.equal(
      assets.installed_models.find((model) => model.file_name === "Custom-Worker.gguf")?.variant,
      "external",
    );
    assert.equal(catalog.owner, "electron-main-sidecar");
    assert.equal(catalog.models.length, 8);
    assert.equal(
      catalog.models.find((model) => model.variant === "qwen-3-14b")?.installed,
      true,
    );
  });

  it("downloads managed worker models through the Electron sidecar", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-sidecar-download-"));
    const modelsDir = path.join(tempRoot, "models");
    try {
      const initial = await invokeBiosSidecarCommand(
        "start_worker_model_download",
        { profileId: "download-test", variant: "gemma-3-1b", path: modelsDir },
        {
          fetch: async () => ({
            ok: true,
            status: 200,
            headers: { get: (name) => (name.toLowerCase() === "content-length" ? "11" : null) },
            arrayBuffer: async () => Buffer.from("hello model"),
          }),
        },
      );

      assert.equal(initial.state, "downloading");
      await new Promise((resolve) => setTimeout(resolve, 50));
      const assets = await invokeBiosSidecarCommand("worker_assets_status", {
        profileId: "download-test",
        path: modelsDir,
      });

      assert.equal(assets.download.state, "completed");
      assert.equal(assets.download.progress_percent, 100);
      assert.equal(
        assets.installed_models.some((model) => model.file_name === "gemma-3-1b-it-Q4_K_M.gguf"),
        true,
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("reads the fixed BIOS debug log path without exposing arbitrary file reads", async () => {
    const log = await invokeBiosSidecarCommand("read_debug_log", {}, {
      readFile: async (filePath, encoding) => {
        assert.match(filePath, /runtime-debug\.log$/);
        assert.equal(encoding, "utf8");
        return "bios-debug-log-v1 fixture";
      },
    });

    assert.equal(log, "bios-debug-log-v1 fixture");
  });

  it("persists deterministic sidecar action-log lineage", async () => {
    const previousHome = process.env.BIOS_AI_HOME_OVERRIDE;
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-sidecar-log-"));
    process.env.BIOS_AI_HOME_OVERRIDE = tempRoot;
    try {
      await invokeBiosSidecarCommand("append_debug_log", {
        event: "frontend.clicked",
        details: "root-action",
      });
      await invokeBiosSidecarCommand("system_discovery", {}, {
        runProcess: async () => ({ status: "fail", exitCode: 1, timedOut: false, stdout: "", stderr: "" }),
      });

      const raw = await readFile(path.join(tempRoot, "logs", "runtime-debug.log"), "utf8");
      const records = raw.trim().split(/\r?\n/).map((line) => JSON.parse(line));

      assert.equal(records.length, 2);
      assert.equal(records[0].version, "bios-debug-log-v1");
      assert.equal(records[0].source, "frontend.append_debug_log");
      assert.equal(records[0].parent_hash, null);
      assert.equal(records[0].record_hash.length, 64);
      assert.equal(records[1].source, "electron.sidecar");
      assert.equal(records[1].event, "command.system_discovery.success");
      assert.equal(records[1].parent_hash, records[0].record_hash);
      assert.equal(records[1].payload_hash.length, 64);
      assert.notEqual(records[1].record_hash, records[0].record_hash);
    } finally {
      if (previousHome === undefined) {
        delete process.env.BIOS_AI_HOME_OVERRIDE;
      } else {
        process.env.BIOS_AI_HOME_OVERRIDE = previousHome;
      }
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("routes Electron BIOS commands through the sidecar instead of renderer fixtures", async () => {
    const runtime = await invokeElectronShellSpikeCommand("bios_runtime_status", {
      profile_id: "babs",
      boss_name: "B.A.Bs",
    });
    const contract = await invokeElectronShellSpikeCommand("bios_shell_contract", {
      profile_id: "babs",
      boss_name: "B.A.Bs",
    });
    const boxed = await invokeElectronShellSpikeCommand("bios_boxed_lane_status");
    const catalog = await invokeElectronShellSpikeCommand("worker_model_catalog");

    assert.equal(runtime.owner, "electron-main-sidecar");
    assert.equal(runtime.profile_id, "babs");
    assert.equal(contract.owner, "electron-main-sidecar");
    assert.equal(contract.runtime.owner, "electron-main-sidecar");
    assert.equal(boxed.owner, "electron-main-sidecar");
    assert.equal(typeof boxed.ready, "boolean");
    assert.equal(catalog.owner, "electron-main-sidecar");
  });

  it("keeps the managed local worker GPU-first with the Tauri launch contract", () => {
    const args = localWorkerServerArgs(30011, "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf");
    assert.match(args.join(" "), /--gpu-layers 999/);
    assert.match(args.join(" "), /--flash-attn auto/);
    assert.match(args.join(" "), /--ctx-size 8192/);
    assert.match(args.join(" "), /--no-mmproj/);
    assert.equal(parseLocalWorkerDeviceList("Available devices:\nCPU").ready, false);
    assert.equal(parseLocalWorkerDeviceList("CUDA0: NVIDIA GeForce RTX 5070 Ti").ready, true);
  });

  it("reports Electron worker runtime readiness from persisted profile selection", async () => {
    const previous = process.env.BIOS_AI_LLAMA_SERVER;
    process.env.BIOS_AI_LLAMA_SERVER = "C:/BIOS/bin/llama-server.exe";
    try {
      const status = await workerRuntimeStatus(
        { profileId: "babs" },
        {
          access: async () => {},
          readFile: async (filePath) => {
            if (String(filePath).endsWith("worker-model.json")) {
              return JSON.stringify({
                variant: "qwen-3-14b",
                model_id: "Qwen3-14B-Q4_K_M",
                file_name: "Qwen3-14B-Q4_K_M.gguf",
                path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
              });
            }
            throw new Error(`unexpected read ${filePath}`);
          },
          runProcess: async (command, args, options) => {
            assert.equal(command, "C:/BIOS/bin/llama-server.exe");
            assert.deepEqual(args, ["--list-devices"]);
            assert.equal(options.timeoutMs, 180_000);
            return {
              status: "pass",
              exitCode: 0,
              timedOut: false,
              stdout: "CUDA0: NVIDIA GeForce RTX 5070 Ti\n",
              stderr: "",
            };
          },
        },
      );

      assert.equal(status.owner, "electron-main-sidecar");
      assert.equal(status.status, "ready_to_launch");
      assert.equal(status.model_id, "Qwen3-14B-Q4_K_M");
      assert.equal(status.gpu_acceleration_ready, true);
    } finally {
      if (previous === undefined) {
        delete process.env.BIOS_AI_LLAMA_SERVER;
      } else {
        process.env.BIOS_AI_LLAMA_SERVER = previous;
      }
    }
  });

  it("routes user chat through the Electron sidecar BOSS worker and OpenAI-compatible endpoint", async () => {
    const previous = process.env.BIOS_AI_LLAMA_SERVER;
    process.env.BIOS_AI_LLAMA_SERVER = "C:/BIOS/bin/llama-server.exe";
    const writes = [];
    let spawned = false;
    const fetchCalls = [];
    try {
      const reply = await chatWithLocalWorker(
        {
          profileId: "babs",
          workerRole: "worker_small",
          agentName: "B.A.Bs",
          messages: [{ role: "user", text: "How did the arena run go?" }],
          maxTokens: 64,
        },
        {
          access: async () => {},
          mkdir: async () => {},
          writeFile: async (filePath, body) => {
            writes.push({ filePath, body });
          },
          readFile: async (filePath) => {
            if (String(filePath).endsWith("worker-model.json")) {
              return JSON.stringify({
                variant: "qwen-3-14b",
                model_id: "Qwen3-14B-Q4_K_M",
                file_name: "Qwen3-14B-Q4_K_M.gguf",
                path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
              });
            }
            if (String(filePath).endsWith(".log")) {
              return "device_info: CUDA backend using device NVIDIA GeForce RTX";
            }
            throw new Error(`unexpected read ${filePath}`);
          },
          runProcess: async () => ({
            status: "pass",
            exitCode: 0,
            timedOut: false,
            stdout: "CUDA0: NVIDIA GeForce RTX 5070 Ti\n",
            stderr: "",
          }),
          spawnWorker: (sidecarPath, args, options) => {
            spawned = true;
            assert.equal(sidecarPath, "C:/BIOS/bin/llama-server.exe");
            assert.match(args.join(" "), /--gpu-layers 999/);
            assert.match(args.join(" "), /Qwen3-14B-Q4_K_M\.gguf/);
            assert.match(options.logPath, /local-worker-sidecar-babs-boss_brain\.log$/);
            return { pid: 1234, killed: false, kill: () => {} };
          },
          fetch: async (url, options) => {
            fetchCalls.push({ url, options });
            if (String(url).endsWith("/v1/models")) {
              return { ok: true };
            }
            assert.equal(url, "http://127.0.0.1:30011/v1/chat/completions");
            const body = JSON.parse(options.body);
            assert.equal(body.model, "Qwen3-14B-Q4_K_M");
            assert.equal(body.messages[0].role, "system");
            assert.equal(body.messages.at(-1).content, "How did the arena run go?");
            assert.equal(body.max_tokens, 64);
            return {
              ok: true,
              text: async () =>
                JSON.stringify({
                  choices: [{ message: { content: "Arena run summary from the BOSS." } }],
                }),
            };
          },
          startupAttempts: 1,
        },
      );

      assert.equal(spawned, true);
      assert.equal(reply, "Arena run summary from the BOSS.");
      assert.equal(fetchCalls.length, 2);
      assert.equal(writes.some((entry) => String(entry.filePath).endsWith("local-worker-state.json")), true);
      assert.match(writes.find((entry) => String(entry.filePath).endsWith("local-worker-state.json")).body, /"worker_role": "boss_brain"/);
    } finally {
      if (previous === undefined) {
        delete process.env.BIOS_AI_LLAMA_SERVER;
      } else {
        process.env.BIOS_AI_LLAMA_SERVER = previous;
      }
    }
  });

  it("reports package-smoke sidecar proof", async () => {
    const proof = await runBiosSidecarSmokeProof();

    assert.equal(proof.status, "pass");
    assert.equal(proof.commands.bios_shell_contract, "electron-main-sidecar");
    assert.notEqual(proof.commands.bios_prepare_boxed_lane, "blocked_without_repair_owner");
  });
});
