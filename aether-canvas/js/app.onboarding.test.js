import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function buildWorkerModelCatalog() {
  return [
    {
      variant: "gemma-3-1b",
      model_id: "gemma-3-1b-it",
      label: "Gemma 3 1B",
      family: "Gemma",
      size_label: "1B",
      size_billions: 1,
      recommended_for_local: false,
      recommended_for_hybrid: false,
      min_memory_gb: 8,
      min_cores: 4,
      estimated_download_bytes: 806058240,
    },
    {
      variant: "gemma-3-4b",
      model_id: "gemma-3-4b-it",
      label: "Gemma 3 4B",
      family: "Gemma",
      size_label: "4B",
      size_billions: 4,
      recommended_for_local: false,
      recommended_for_hybrid: true,
      min_memory_gb: 16,
      min_cores: 8,
      estimated_download_bytes: 2489312256,
    },
    {
      variant: "qwen-3-8b",
      model_id: "qwen3-8b-instruct",
      label: "Qwen3 8B",
      family: "Qwen",
      size_label: "8B",
      size_billions: 8,
      recommended_for_local: false,
      recommended_for_hybrid: false,
      min_memory_gb: 24,
      min_cores: 12,
      estimated_download_bytes: 5580000000,
    },
    {
      variant: "qwen-3-14b",
      model_id: "qwen3-14b-instruct",
      label: "Qwen3 14B",
      family: "Qwen",
      size_label: "14B",
      size_billions: 14,
      recommended_for_local: true,
      recommended_for_hybrid: false,
      min_memory_gb: 28,
      min_cores: 16,
      estimated_download_bytes: 9663676416,
    },
    {
      variant: "gemma-3-12b",
      model_id: "gemma-3-12b-it",
      label: "Gemma 3 12B",
      family: "Gemma",
      size_label: "12B",
      size_billions: 12,
      recommended_for_local: false,
      recommended_for_hybrid: false,
      min_memory_gb: 28,
      min_cores: 16,
      estimated_download_bytes: 8697308774,
    },
  ];
}

function createOnboardingDom() {
  document.body.innerHTML = `
    <div id="chat-empty"></div>
    <div id="chat-stream"></div>
    <div id="naming-modal"></div>
    <textarea id="chat-input"></textarea>
    <div id="connect-status"></div>
    <div id="viewport-idle-agent"></div>
    <div id="settings-agent-name"></div>
    <div class="chat-compose"></div>
  `;

  const composeBar = document.querySelector(".chat-compose");
  composeBar.scrollIntoView = vi.fn();

  return {
    chatStream: document.getElementById("chat-stream"),
    composeBar,
  };
}

function buildSaveBiosProfileSnapshotMock(app) {
  return vi.fn(async (snapshot) => {
    localStorage.setItem("bios-ai-onboarding", JSON.stringify(snapshot));
    if (!app.activeBiosProfileId) {
      app.activeBiosProfileId = "claw";
    }
    return {
      profile: {
        id: app.activeBiosProfileId,
        display_name: snapshot?.agentName || app.agentName || "BIOS AI",
      },
      onboarding: {
        ...snapshot,
      },
    };
  });
}

async function clickChoice(text) {
  let match = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const buttons = Array.from(document.querySelectorAll("button")).filter(
      (button) => !button.disabled && button.textContent?.includes(text),
    );
    match = buttons.at(-1) || null;
    if (match) {
      break;
    }
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
  }
  expect(
    match,
    `expected button containing \"${text}\". Current onboarding text: ${document.body.textContent?.replace(/\s+/g, " ").trim()}`,
  ).toBeTruthy();
  match.click();
  await Promise.resolve();
}

async function flushTimers() {
  await vi.runOnlyPendingTimersAsync();
  await Promise.resolve();
}

function setCheckboxChecked(type, checked, index = null) {
  const selector =
    index === null
      ? `.disc-check[data-type="${type}"]`
      : `.disc-check[data-type="${type}"][data-index="${index}"]`;
  const input = document.querySelector(selector);
  expect(input, `expected checkbox for ${type}${index === null ? "" : `:${index}`}`).toBeTruthy();
  input.checked = checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("AetherApp onboarding conversation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    let defaultWorkerStatusCalls = 0;
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 8,
    });
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 8,
    });
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command, payload) => {
          if (command === "append_debug_log") {
            return null;
          }
          if (command === "system_discovery") {
            return {
              api_keys: [
                {
                  key_id: "disc-openai-1",
                  provider: "openai",
                  env_var: "OPENAI_API_KEY",
                  source: "env",
                  masked_value: "sk-t...cdef",
                },
              ],
              git_identity: {
                name: "Nick Example",
                email: "nick@example.com",
              },
              local_models: [{ model_id: "gemma-4-4b-it-q4", source: "ollama" }],
              ssh_key_types: ["ed25519"],
              ai_tools: [{ tool: "Cursor", config_path: "C:/Users/test/.cursor" }],
              agent_identity: null,
              machine_profile: {
                os: "windows",
                arch: "x86_64",
                logical_cores: 20,
                total_memory_gb: 32,
              },
              scan_duration_ms: 123,
            };
          }

          if (command === "save_provider_config") {
            return null;
          }

          if (command === "probe_local_runtime") {
            return {
              provider: payload?.provider || "bios-managed",
              reachable: true,
              resolved_model: "gemma-3-1b-it",
              endpoint: "http://127.0.0.1:30011/v1/chat/completions",
              detail: "Local runtime is reachable.",
            };
          }

          if (command === "worker_assets_status") {
            defaultWorkerStatusCalls += 1;
            return {
              installed_models:
                defaultWorkerStatusCalls >= 3
                  ? [
                      {
                        variant: "gemma-3-4b",
                        model_id: "gemma-3-4b-it",
                        file_name: "gemma-3-4b-it-Q4_K_M.gguf",
                        path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
                        size_bytes: 2489312256,
                      },
                    ]
                  : [],
              bundled_sidecar_available: true,
              bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
              selected_model:
                defaultWorkerStatusCalls >= 3
                  ? {
                      variant: "gemma-3-4b",
                      model_id: "gemma-3-4b-it",
                      file_name: "gemma-3-4b-it-Q4_K_M.gguf",
                      path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
                      updated_at: "123",
                    }
                  : null,
              models_dir: "C:/Users/test/.bios-ai/models",
              download: {
                state:
                  defaultWorkerStatusCalls >= 3
                    ? "completed"
                    : defaultWorkerStatusCalls >= 2
                      ? "downloading"
                      : "idle",
                variant: defaultWorkerStatusCalls >= 2 ? "gemma-3-4b" : null,
                file_name: defaultWorkerStatusCalls >= 2 ? "gemma-3-4b-it-Q4_K_M.gguf" : null,
                downloaded_bytes: defaultWorkerStatusCalls >= 3 ? 2489312256 : 52428800,
                total_bytes: defaultWorkerStatusCalls >= 2 ? 100000000 : null,
                progress_percent:
                  defaultWorkerStatusCalls >= 3 ? 100 : defaultWorkerStatusCalls >= 2 ? 52.4 : null,
                target_path:
                  defaultWorkerStatusCalls >= 2
                    ? "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf"
                    : null,
                error: null,
              },
            };
          }

          if (command === "start_worker_model_download") {
            return {
              state: "downloading",
              variant: payload?.variant || "gemma-3-4b",
              file_name: "gemma-3-4b-it-Q4_K_M.gguf",
              downloaded_bytes: 0,
              total_bytes: 100000000,
              progress_percent: 0,
              target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
              error: null,
            };
          }

          if (command === "save_worker_runtime_selection") {
            return null;
          }

          if (command === "save_worker_runtime_roster") {
            return null;
          }

          if (command === "worker_model_catalog") {
            return buildWorkerModelCatalog();
          }

          if (command === "worker_storage_status") {
            return {
              configured_path: null,
              effective_path: "C:/Users/test/.bios-ai/models",
              options: [
                {
                  key: "default",
                  label: "Default path",
                  path: "C:/Users/test/.bios-ai/models",
                  free_bytes: 200 * 1024 * 1024 * 1024,
                  total_bytes: 500 * 1024 * 1024 * 1024,
                  is_default: true,
                  is_recommended: true,
                },
              ],
            };
          }

          if (command === "save_worker_storage_location") {
            return {
              configured_path: payload?.path || null,
              effective_path: payload?.path || "C:/Users/test/.bios-ai/models",
              options: [
                {
                  key: "default",
                  label: "Default path",
                  path: "C:/Users/test/.bios-ai/models",
                  free_bytes: 200 * 1024 * 1024 * 1024,
                  total_bytes: 500 * 1024 * 1024 * 1024,
                  is_default: true,
                  is_recommended: true,
                },
              ],
            };
          }

          if (command === "import_discovered_provider_keys") {
            return {
              imported_key_count: 1,
              active_provider: "openai",
            };
          }

          throw new Error(`Unexpected Tauri command: ${command}`);
        }),
      },
    };
  });

  it("shows step-by-step transition feedback and saves the selected onboarding flow", async () => {
    const { chatStream, composeBar } = createOnboardingDom();
    const gateway = {
      request: vi.fn(async () => ({})),
    };
    const app = {
      gateway,
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(function updateAgentNameDOM() {
        const chatInput = document.getElementById("chat-input");
        if (chatInput) {
          chatInput.placeholder = `Message ${this.agentName}...`;
        }
      }),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    expect(chatStream.textContent).toContain("Scan completed in 123ms");

    await clickChoice("Import Selected");
    expect(chatStream.textContent).toContain(
      "Importing what you approved and folding it into BIOS AI setup...",
    );
    expect(chatStream.textContent).toContain("Imported 5 items");

    await flushTimers();
    await flushTimers();
    await clickChoice("Confirm");
    expect(chatStream.textContent).toContain(
      "Saving Nick as your BOSS name and moving into runtime setup...",
    );

    await flushTimers();
    await clickChoice("Hybrid");

    await flushTimers();
    await clickChoice("Gemma 3 4B");
    await flushTimers();
    await clickChoice("Default path");
    expect(chatStream.textContent).toContain("Storage location locked for this install");
    expect(
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.disabled && button.textContent?.includes("Storage locked"),
      ),
    ).toBe(true);
    await flushTimers();
    await flushTimers();
    await flushTimers();
    await clickChoice("Broad authority");
    expect(chatStream.textContent).toContain(
      "Saving broad authority for routine actions while keeping kernel hard stops active, then preparing your final readback...",
    );

    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    expect(localStorage.getItem("bios-ai-onboarding")).toContain("Nick");
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("import_discovered_provider_keys", {
      selection: {
        profile_id: "claw",
        key_ids: ["disc-openai-1"],
        primary_key_id: "disc-openai-1",
        preferred_local_backend: "bios-managed",
      },
    });
    expect(chatStream.textContent).toContain("Nick is ready");
    expect(chatStream.textContent).toContain("Provider connections are saved and ready.");
    expect(chatStream.textContent).toContain("1 key imported");
    expect(composeBar.scrollIntoView).toHaveBeenCalled();
    expect(app.updateAgentNameDOM).toHaveBeenCalled();
  });

  it("lets BIOS AI govern provider choice and still asks for the boss brain on local routes", async () => {
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [
            {
              key_id: "disc-openai-1",
              provider: "openai",
              env_var: "OPENAI_API_KEY",
              source: "env",
              masked_value: "sk-t...cdef",
            },
            {
              key_id: "disc-anthropic-1",
              provider: "anthropic",
              env_var: "ANTHROPIC_API_KEY",
              source: "env",
              masked_value: "sk-a...wxyz",
            },
          ],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [
            { model_id: "qwen-local-14b", source: "lmstudio" },
            { model_id: "gemma-4-4b-it-q4", source: "ollama" },
          ],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
          },
          scan_duration_ms: 123,
        };
      }

      if (command === "save_provider_config") {
        return null;
      }

      if (command === "save_worker_runtime_selection") {
        return null;
      }

      if (command === "save_worker_runtime_roster") {
        return null;
      }

      if (command === "save_worker_runtime_selection") {
        return null;
      }

      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }

      if (command === "worker_assets_status") {
        return {
          installed_models: [
            {
              variant: "gemma-3-1b",
              model_id: "gemma-3-1b-it",
              file_name: "gemma-3-1b-it-Q4_K_M.gguf",
              path: "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf",
              size_bytes: 806058240,
            },
            {
              variant: "qwen-3-8b",
              model_id: "qwen3-8b-instruct",
              file_name: "Qwen3-8B-Q4_K_M.gguf",
              path: "C:/Users/test/.bios-ai/models/Qwen3-8B-Q4_K_M.gguf",
              size_bytes: 5580000000,
            },
          ],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          selected_model: null,
          models_dir: "C:/Users/test/.bios-ai/models",
          download: {
            state: "idle",
            variant: null,
            file_name: null,
            downloaded_bytes: 0,
            total_bytes: null,
            progress_percent: null,
            target_path: null,
            error: null,
          },
        };
      }

      if (command === "probe_local_runtime") {
        return {
          provider: payload?.provider || "bios-managed",
          reachable: true,
          resolved_model: "qwen3-8b-instruct",
          endpoint: "http://127.0.0.1:30011/v1/chat/completions",
          detail: "Local runtime is reachable.",
        };
      }

      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 200 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
          ],
        };
      }

      if (command === "save_worker_storage_location") {
        return {
          configured_path: payload?.path || null,
          effective_path: payload?.path || "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 200 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
          ],
        };
      }

      if (command === "import_discovered_provider_keys") {
        return {
          imported_key_count: 2,
          active_provider: "openai",
        };
      }

      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Import Selected");

    await flushTimers();
    await flushTimers();
    await clickChoice("Confirm");

    await flushTimers();
    await clickChoice("Local only");

    await flushTimers();
    expect(chatStream.textContent).toContain(
      "These BIOS AI managed local BOSS brains are already on this machine. Pick the exact one this BOSS should wake up with first.",
    );
    await clickChoice("Qwen3 8B");
    await flushTimers();
    await flushTimers();
    await flushTimers();
    await clickChoice("Ask me first");

    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding"));
    expect(saved.preferredLocalBackend).toBe("bios-managed");
    expect(saved.modelPref).toBe("local");
    expect(saved.localWorkerModelVariant).toBe("qwen-3-8b");
    expect(saved.safetyPostureLabel).toBe("Native boxed-lane hardened");
    expect(saved.promotionPolicy).toBe("Approval and validation before host adoption");
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("import_discovered_provider_keys", {
      selection: {
        profile_id: "claw",
        key_ids: ["disc-openai-1", "disc-anthropic-1"],
        primary_key_id: "disc-openai-1",
        preferred_local_backend: "bios-managed",
      },
    });
  });

  it("only uses confirmed discovery items for later onboarding defaults", async () => {
    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();

    setCheckboxChecked("git", false);
    setCheckboxChecked("model", false, 0);
    setCheckboxChecked("tool", false, 0);
    setCheckboxChecked("ssh", false);

    await clickChoice("Import Selected");
    expect(chatStream.textContent).toContain("Imported 1 item");

    await flushTimers();
    await flushTimers();
    await flushTimers();
    const nameInput = document.getElementById("conv-name-input");
    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe("");
    await clickChoice("Confirm");

    await flushTimers();
    expect(chatStream.textContent).not.toContain("Local models found (gemma-4-4b-it-q4)");
    await clickChoice("Cloud BOSS");

    await flushTimers();
    await flushTimers();
    await clickChoice("Ask me first");

    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding"));
    expect(saved.gitIdentity).toBeNull();
    expect(saved.localModels).toEqual([]);
    expect(saved.sshKeyTypes).toEqual([]);
    expect(saved.aiTools).toEqual([]);
  });

  it("offers a local worker download when hybrid is chosen without an existing local model", async () => {
    let workerStatusCalls = 0;
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [
            {
              key_id: "disc-openai-1",
              provider: "openai",
              env_var: "OPENAI_API_KEY",
              source: "env",
              masked_value: "sk-t...cdef",
            },
          ],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
          },
          scan_duration_ms: 123,
        };
      }

      if (command === "worker_assets_status") {
        workerStatusCalls += 1;
        if (workerStatusCalls < 3) {
          return {
            installed_models: [],
            bundled_sidecar_available: true,
            bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
            download: {
              state: workerStatusCalls === 1 ? "idle" : "downloading",
              variant: workerStatusCalls === 1 ? null : "gemma-3-1b",
              file_name: workerStatusCalls === 1 ? null : "gemma-3-1b-it-Q4_K_M.gguf",
              downloaded_bytes: workerStatusCalls === 1 ? 0 : 52428800,
              total_bytes: workerStatusCalls === 1 ? null : 100000000,
              progress_percent: workerStatusCalls === 1 ? null : 52.4,
              target_path:
                workerStatusCalls === 1
                  ? null
                  : "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf",
              error: null,
            },
          };
        }
        return {
          installed_models: [
            {
              variant: "gemma-3-1b",
              model_id: "gemma-3-1b-it",
              file_name: "gemma-3-1b-it-Q4_K_M.gguf",
              path: "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf",
              size_bytes: 806058240,
            },
          ],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          download: {
            state: "completed",
            variant: "gemma-3-1b",
            file_name: "gemma-3-1b-it-Q4_K_M.gguf",
            downloaded_bytes: 806058240,
            total_bytes: 806058240,
            progress_percent: 100,
            target_path: "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf",
            error: null,
          },
        };
      }

      if (command === "start_worker_model_download") {
        return {
          state: "downloading",
          variant: "gemma-3-1b",
          file_name: "gemma-3-1b-it-Q4_K_M.gguf",
          downloaded_bytes: 0,
          total_bytes: 100000000,
          progress_percent: 0,
          target_path: "C:/Users/test/.bios-ai/models/gemma-3-1b-it-Q4_K_M.gguf",
          error: null,
        };
      }

      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 200 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
            {
              key: "drive-d",
              label: "D drive",
              path: "D:/BIOS AI/models",
              free_bytes: 700 * 1024 * 1024 * 1024,
              total_bytes: 1000 * 1024 * 1024 * 1024,
              is_default: false,
              is_recommended: false,
            },
          ],
        };
      }

      if (command === "save_worker_storage_location") {
        return {
          configured_path: payload?.path || null,
          effective_path: payload?.path || "D:/BIOS AI/models",
          options: [],
        };
      }

      if (command === "save_provider_config") {
        return null;
      }

      if (command === "save_worker_runtime_roster") {
        return null;
      }

      if (command === "save_worker_runtime_selection") {
        return null;
      }

      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }

      if (command === "probe_local_runtime") {
        return {
          provider: payload?.provider || "bios-managed",
          reachable: true,
          resolved_model: "gemma-3-1b-it",
          endpoint: "http://127.0.0.1:30011/v1/chat/completions",
          detail: "Local runtime is reachable.",
        };
      }

      if (command === "import_discovered_provider_keys") {
        return {
          imported_key_count: 1,
          active_provider: "openai",
        };
      }

      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Import Selected");
    await flushTimers();
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Hybrid");
    await flushTimers();
    await clickChoice("Gemma 3 1B");
    await flushTimers();
    await clickChoice("D drive");
    await flushTimers();
    await flushTimers();
    await clickChoice("Ask me first");
    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding"));
    expect(saved.localWorkerModelVariant).toBe("gemma-3-1b");
    expect(saved.localWorkerDownloadStatus).toBe("completed");
    expect(saved.preferredLocalBackend).toBe("bios-managed");
    expect(chatStream.textContent).toContain("Gemma 3 1B");
  });

  it("forces the BIOS-managed local runtime to finish worker setup before local-only onboarding can complete", async () => {
    let workerStatusCalls = 0;
    let downloadStarted = false;
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [
            {
              key_id: "disc-github-1",
              provider: "github",
              env_var: "GITHUB_TOKEN",
              source: "env",
              masked_value: "ghu_...abcd",
            },
          ],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
          },
          scan_duration_ms: 123,
        };
      }
      if (command === "worker_assets_status") {
        workerStatusCalls += 1;
        if (!downloadStarted) {
          return {
            installed_models: [],
            bundled_sidecar_available: true,
            bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
            selected_model: null,
            models_dir: "C:/Users/test/.bios-ai/models",
            download: {
              state: "idle",
              variant: null,
              file_name: null,
              downloaded_bytes: 0,
              total_bytes: null,
              progress_percent: null,
              target_path: null,
              error: null,
            },
          };
        }
        if (workerStatusCalls < 5) {
          return {
            installed_models: [],
            bundled_sidecar_available: true,
            bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
            selected_model: null,
            models_dir: "C:/Users/test/.bios-ai/models",
            download: {
              state: "downloading",
              variant: "gemma-3-4b",
              file_name: "gemma-3-4b-it-Q4_K_M.gguf",
              downloaded_bytes: 52428800,
              total_bytes: 100000000,
              progress_percent: 52.4,
              target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
              error: null,
            },
          };
        }
        return {
          installed_models: [
            {
              variant: "gemma-3-4b",
              model_id: "gemma-3-4b-it",
              file_name: "gemma-3-4b-it-Q4_K_M.gguf",
              path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
              size_bytes: 2489312256,
            },
          ],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          selected_model: {
            variant: "gemma-3-4b",
            model_id: "gemma-3-4b-it",
            file_name: "gemma-3-4b-it-Q4_K_M.gguf",
            path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
            updated_at: "123",
          },
          models_dir: "C:/Users/test/.bios-ai/models",
          download: {
            state: "completed",
            variant: "gemma-3-4b",
            file_name: "gemma-3-4b-it-Q4_K_M.gguf",
            downloaded_bytes: 2489312256,
            total_bytes: 2489312256,
            progress_percent: 100,
            target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
            error: null,
          },
        };
      }
      if (command === "start_worker_model_download") {
        downloadStarted = true;
        return {
          state: "downloading",
          variant: "gemma-3-4b",
          file_name: "gemma-3-4b-it-Q4_K_M.gguf",
          downloaded_bytes: 0,
          total_bytes: 100000000,
          progress_percent: 0,
          target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
          error: null,
        };
      }
      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 200 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
          ],
        };
      }
      if (command === "save_worker_storage_location") {
        return {
          configured_path: payload?.path || null,
          effective_path: payload?.path || "C:/Users/test/.bios-ai/models",
          options: [],
        };
      }
      if (command === "save_provider_config") {
        return null;
      }
      if (command === "save_worker_runtime_selection") {
        return null;
      }
      if (command === "save_worker_runtime_roster") {
        return null;
      }
      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }
      if (command === "probe_local_runtime") {
        return {
          provider: payload?.provider || "bios-managed",
          reachable: true,
          resolved_model: "gemma-3-4b-it",
          endpoint: "http://127.0.0.1:30011/v1/chat/completions",
          detail: "Local runtime is reachable.",
        };
      }

      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Import Selected");
    await flushTimers();
    await flushTimers();
    await flushTimers();
    await clickChoice("Skip for Now");
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Local only");
    await flushTimers();
    expect(chatStream.textContent).toContain(
      "BIOS AI needs a working local model before setup can finish",
    );
    await clickChoice("Gemma 3 4B");
    await flushTimers();
    await clickChoice("Default path");
    await flushTimers();
    await flushTimers();
    await clickChoice("Ask me first");
    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding"));
    expect(saved.preferredLocalBackend).toBe("bios-managed");
    expect(saved.modelPref).toBe("local");
    expect(saved.localWorkerModelVariant).toBe("gemma-3-4b");
    expect(saved.localWorkerDownloadStatus).toBe("completed");
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("start_worker_model_download", {
      variant: "gemma-3-4b",
      profileId: "claw",
    });
  });

  it("does not complete local-only onboarding when managed worker download fails even if the runtime probe responds", async () => {
    let downloadStarted = false;
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
            gpu_vram_gb: 16,
          },
          scan_duration_ms: 123,
        };
      }
      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }
      if (command === "worker_assets_status") {
        return {
          installed_models: [],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          selected_model: null,
          models_dir: "C:/Users/test/.bios-ai/models",
          download: downloadStarted
            ? {
                state: "failed",
                variant: "gemma-3-4b",
                file_name: "gemma-3-4b-it-Q4_K_M.gguf",
                downloaded_bytes: 0,
                total_bytes: 100000000,
                progress_percent: 0,
                target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
                error: "Download failed: network unavailable",
              }
            : {
                state: "idle",
                variant: null,
                file_name: null,
                downloaded_bytes: 0,
                total_bytes: null,
                progress_percent: null,
                target_path: null,
                error: null,
              },
        };
      }
      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 200 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
          ],
        };
      }
      if (command === "save_worker_storage_location") {
        return {
          configured_path: payload?.path || null,
          effective_path: payload?.path || "C:/Users/test/.bios-ai/models",
          options: [],
        };
      }
      if (command === "start_worker_model_download") {
        downloadStarted = true;
        return {
          state: "downloading",
          variant: "gemma-3-4b",
          file_name: "gemma-3-4b-it-Q4_K_M.gguf",
          downloaded_bytes: 0,
          total_bytes: 100000000,
          progress_percent: 0,
          target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
          error: null,
        };
      }
      if (command === "probe_local_runtime") {
        return {
          provider: payload?.provider || "bios-managed",
          reachable: true,
          resolved_model: "stale-model",
          endpoint: "http://127.0.0.1:30011/v1/chat/completions",
          detail: "Local runtime is reachable.",
        };
      }

      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Skip All");
    await flushTimers();
    await clickChoice("Skip for Now");
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Local only");
    await flushTimers();
    await clickChoice("Gemma 3 4B");
    await flushTimers();
    await clickChoice("Default path");
    await flushTimers();
    await flushTimers();
    await clickChoice("Ask me first");
    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding") || "null");
    expect(saved?.completed).toBe(false);
    expect(chatStream.textContent).toContain(
      "Local only was selected, but the BIOS AI managed local BOSS brain is not installed and verified yet.",
    );
    expect(
      app.saveBiosProfileSnapshot.mock.calls.some(([snapshot]) => snapshot?.completed === true),
    ).toBe(false);
  });

  it("keeps local-only onboarding incomplete when a completed managed worker install still needs verification", async () => {
    let downloadStarted = false;
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 28,
            total_memory_gb: 31,
            gpu_vram_gb: 16,
          },
          scan_duration_ms: 123,
        };
      }
      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }
      if (command === "worker_assets_status") {
        return {
          installed_models: downloadStarted
            ? [
                {
                  variant: "qwen-3-14b",
                  model_id: "qwen3-14b-instruct",
                  file_name: "Qwen3-14B-Q4_K_M.gguf",
                  path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
                  size_bytes: 9001752960,
                },
              ]
            : [],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          selected_model: downloadStarted
            ? {
                variant: "qwen-3-14b",
                model_id: "qwen3-14b-instruct",
                file_name: "Qwen3-14B-Q4_K_M.gguf",
                path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
                updated_at: "123",
              }
            : null,
          models_dir: "E:/BIOS AI/models",
          download: downloadStarted
            ? {
                state: "completed",
                variant: "qwen-3-14b",
                file_name: "Qwen3-14B-Q4_K_M.gguf",
                downloaded_bytes: 9001752960,
                total_bytes: 9001752960,
                progress_percent: 100,
                target_path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
                error: null,
              }
            : {
                state: "idle",
                variant: null,
                file_name: null,
                downloaded_bytes: 0,
                total_bytes: null,
                progress_percent: null,
                target_path: null,
                error: null,
              },
        };
      }
      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "E:/BIOS AI/models",
          options: [
            {
              key: "e",
              label: "E drive",
              path: "E:/BIOS AI/models",
              free_bytes: 7 * 1024 * 1024 * 1024 * 1024,
              total_bytes: 8 * 1024 * 1024 * 1024 * 1024,
              is_default: false,
              is_recommended: true,
            },
          ],
        };
      }
      if (command === "save_worker_storage_location") {
        return {
          configured_path: payload?.path || null,
          effective_path: payload?.path || "E:/BIOS AI/models",
          options: [],
        };
      }
      if (command === "start_worker_model_download") {
        downloadStarted = true;
        return {
          state: "downloading",
          variant: "qwen-3-14b",
          file_name: "Qwen3-14B-Q4_K_M.gguf",
          downloaded_bytes: 0,
          total_bytes: 9001752960,
          progress_percent: 0,
          target_path: "E:/BIOS AI/models/Qwen3-14B-Q4_K_M.gguf",
          error: null,
        };
      }
      if (command === "save_worker_runtime_selection") {
        return null;
      }
      if (command === "probe_local_runtime") {
        throw new Error("Local worker sidecar did not become ready in time.");
      }

      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
      loadBiosRuntimeStatus: vi.fn(async () => ({})),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Skip All");
    await flushTimers();
    await clickChoice("Skip for Now");
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Local only");
    await flushTimers();
    await clickChoice("Qwen3 14B");
    await flushTimers();
    await clickChoice("E drive");
    await flushTimers();
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding") || "null");
    expect(saved?.completed).toBe(false);
    expect(saved?.localWorkerDownloadStatus).toBe("installed-needs-verification");
    expect(saved?.localWorkerModelVariant).toBe("qwen-3-14b");
    expect(chatStream.textContent).toContain("managed llama.cpp route is still starting");
    expect(
      app.saveBiosProfileSnapshot.mock.calls.some(([snapshot]) => snapshot?.completed === true),
    ).toBe(false);
  });

  it("resumes an incomplete managed local profile at the local worker setup step", async () => {
    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "Claw",
      activeBiosProfileId: "claw",
      updateAgentNameDOM: vi.fn(),
      loadBiosProfileDetail: vi.fn(async () => ({
        profile: {
          id: "claw",
          display_name: "Claw",
          completed: false,
        },
        onboarding: {
          completed: false,
          agent_name: "Claw",
          model_pref: "local",
          preferred_local_backend: "bios-managed",
          local_runtime_owner: "BIOS AI",
          local_runtime_engine: "BIOS AI managed llama.cpp lane",
          local_runtime_strategy: "BIOS-managed local runtime",
          local_worker_download_status: "failed",
        },
      })),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    expect(chatStream.textContent).toContain("local brain setup was not finished");
    expect(chatStream.textContent).not.toContain("Give me a name");
    await clickChoice("Gemma 3 4B");
    await flushTimers();
    await clickChoice("Default path");
    await flushTimers();
    await flushTimers();
    await clickChoice("Ask me first");
    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    const saved = JSON.parse(localStorage.getItem("bios-ai-onboarding") || "null");
    expect(saved?.completed).toBe(true);
    expect(saved?.agentName).toBe("Claw");
    expect(saved?.modelPref).toBe("local");
    expect(saved?.localWorkerModelVariant).toBe("gemma-3-4b");
  });

  it("shows larger local models as visible but non-choosable on a smaller machine", async () => {
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [
            {
              key_id: "disc-openai-1",
              provider: "openai",
              env_var: "OPENAI_API_KEY",
              source: "env",
              masked_value: "sk-t...cdef",
            },
          ],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 8,
            total_memory_gb: 8,
          },
          scan_duration_ms: 123,
        };
      }
      if (command === "worker_assets_status") {
        return {
          installed_models: [],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          download: {
            state: "idle",
            variant: null,
            file_name: null,
            downloaded_bytes: 0,
            total_bytes: null,
            progress_percent: null,
            target_path: null,
            error: null,
          },
        };
      }
      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 50 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
          ],
        };
      }
      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }
      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Import Selected");
    await flushTimers();
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Hybrid");
    await flushTimers();

    const balanced = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Gemma 3 4B"),
    );
    const bossLite = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Qwen3 8B"),
    );
    expect(balanced).toBeTruthy();
    expect(bossLite).toBeTruthy();
    expect(balanced.disabled).toBe(true);
    expect(bossLite.disabled).toBe(true);
    expect(chatStream.textContent).toContain("Not recommended on this system");

    runPromise.catch(() => {});
  });

  it("asks for a runnable local route when Local only is chosen from discovered model inventories", async () => {
    let workerStatusCalls = 0;
    window.__TAURI__.core.invoke.mockImplementation(async (command) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [
            {
              key_id: "disc-openai-1",
              provider: "openai",
              env_var: "OPENAI_API_KEY",
              source: "env",
              masked_value: "sk-t...cdef",
            },
          ],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [
            { model_id: "qwen-local-14b", source: "lmstudio" },
            { model_id: "gemma-4-4b-it-q4", source: "ollama" },
          ],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
          },
          scan_duration_ms: 123,
        };
      }
      if (command === "worker_assets_status") {
        workerStatusCalls += 1;
        return {
          installed_models: [],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          download: {
            state: workerStatusCalls > 1 ? "downloading" : "idle",
            variant: workerStatusCalls > 1 ? "gemma-3-4b" : null,
            file_name: workerStatusCalls > 1 ? "gemma-3-4b-it-Q4_K_M.gguf" : null,
            downloaded_bytes: 0,
            total_bytes: workerStatusCalls > 1 ? 100000000 : null,
            progress_percent: workerStatusCalls > 1 ? 0 : null,
            target_path:
              workerStatusCalls > 1
                ? "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf"
                : null,
            error: null,
          },
        };
      }
      if (command === "start_worker_model_download") {
        return {
          state: "downloading",
          variant: "gemma-3-4b",
          file_name: "gemma-3-4b-it-Q4_K_M.gguf",
          downloaded_bytes: 0,
          total_bytes: 100000000,
          progress_percent: 0,
          target_path: "C:/Users/test/.bios-ai/models/gemma-3-4b-it-Q4_K_M.gguf",
          error: null,
        };
      }
      if (command === "worker_storage_status") {
        return {
          configured_path: null,
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [
            {
              key: "default",
              label: "Default path",
              path: "C:/Users/test/.bios-ai/models",
              free_bytes: 200 * 1024 * 1024 * 1024,
              total_bytes: 500 * 1024 * 1024 * 1024,
              is_default: true,
              is_recommended: true,
            },
          ],
        };
      }
      if (command === "save_worker_storage_location") {
        return {
          configured_path: "C:/Users/test/.bios-ai/models",
          effective_path: "C:/Users/test/.bios-ai/models",
          options: [],
        };
      }
      if (command === "save_provider_config") {
        return null;
      }

      if (command === "save_worker_runtime_roster") {
        return null;
      }

      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }

      if (command === "probe_local_runtime") {
        return {
          provider: payload?.provider || "bios-managed",
          reachable: true,
          resolved_model: "gemma-3-4b-it",
          endpoint: "http://127.0.0.1:30011/v1/chat/completions",
          detail: "Local runtime is reachable.",
        };
      }
      if (command === "import_discovered_provider_keys") {
        return {
          imported_key_count: 1,
          active_provider: "openai",
        };
      }
      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Import Selected");
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Local only");
    await flushTimers();

    expect(chatStream.textContent).toContain(
      "BIOS AI is keeping the local lane on the owned managed runtime",
    );
    expect(chatStream.textContent).toContain(
      "BIOS AI needs a working local model before setup can finish",
    );

    runPromise.catch(() => {});
  });

  it("lets local-only onboarding finish when cloud key import fails but the local route is healthy", async () => {
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "system_discovery") {
        return {
          api_keys: [
            {
              key_id: "disc-openai-1",
              provider: "openai",
              env_var: "OPENAI_API_KEY",
              source: "env",
              masked_value: "sk-t...cdef",
            },
          ],
          git_identity: {
            name: "Nick Example",
            email: "nick@example.com",
          },
          local_models: [],
          ssh_key_types: [],
          ai_tools: [],
          agent_identity: null,
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
          },
          scan_duration_ms: 123,
        };
      }
      if (command === "worker_assets_status") {
        return {
          installed_models: [
            {
              variant: "qwen-3-8b",
              model_id: "qwen3-8b-instruct",
              file_name: "Qwen3-8B-Q4_K_M.gguf",
              path: "C:/Users/test/.bios-ai/models/Qwen3-8B-Q4_K_M.gguf",
              size_bytes: 5580000000,
            },
          ],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          selected_model: {
            variant: "qwen-3-8b",
            model_id: "qwen3-8b-instruct",
            file_name: "Qwen3-8B-Q4_K_M.gguf",
            path: "C:/Users/test/.bios-ai/models/Qwen3-8B-Q4_K_M.gguf",
            updated_at: "123",
          },
          models_dir: "C:/Users/test/.bios-ai/models",
          download: {
            state: "idle",
            variant: null,
            file_name: null,
            downloaded_bytes: 0,
            total_bytes: null,
            progress_percent: null,
            target_path: null,
            error: null,
          },
        };
      }
      if (command === "worker_model_catalog") {
        return buildWorkerModelCatalog();
      }
      if (command === "probe_local_runtime") {
        return {
          provider: payload?.provider || "bios-managed",
          reachable: true,
          resolved_model: "qwen3-8b-instruct",
          endpoint: "http://127.0.0.1:30011/v1/chat/completions",
          detail: "Local runtime is reachable.",
        };
      }
      if (command === "save_worker_runtime_roster") {
        return null;
      }
      if (command === "save_worker_runtime_selection") {
        return null;
      }
      if (command === "save_provider_config") {
        return null;
      }
      if (command === "import_discovered_provider_keys") {
        throw new Error("Discovery import is temporarily unavailable.");
      }
      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    const { chatStream } = createOnboardingDom();
    const app = {
      gateway: {
        request: vi.fn(async () => ({})),
      },
      agentName: "BIOS AI",
      activeBiosProfileId: null,
      updateAgentNameDOM: vi.fn(),
    };
    app.saveBiosProfileSnapshot = buildSaveBiosProfileSnapshotMock(app);

    const runPromise = AetherApp.prototype.runConversationalOnboarding.call(app, chatStream);

    await flushTimers();
    await flushTimers();
    await clickChoice("Import Selected");
    await flushTimers();
    await flushTimers();
    await clickChoice("Confirm");
    await flushTimers();
    await clickChoice("Local only");
    await flushTimers();
    await clickChoice("Qwen3 8B");
    await flushTimers();
    await clickChoice("Ask me first");
    await flushTimers();
    await clickChoice("Start Working");
    await flushTimers();
    await runPromise;

    expect(JSON.parse(localStorage.getItem("bios-ai-onboarding")).completed).toBe(true);
    expect(chatStream.textContent).toContain("Nick is ready");
    expect(chatStream.textContent).toContain(
      "Local BIOS AI is ready. Cloud key import can be revisited later.",
    );
  });
});
