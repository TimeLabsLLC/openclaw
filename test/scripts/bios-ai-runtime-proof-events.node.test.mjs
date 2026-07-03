import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

function installBrowserShim(invoke) {
  const store = new Map();
  globalThis.localStorage = {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
  globalThis.window = {
    addEventListener() {},
    __TAURI__: {
      core: {
        invoke,
      },
    },
  };
  globalThis.document = {
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

afterEach(() => {
  delete globalThis.document;
  delete globalThis.localStorage;
  delete globalThis.window;
});

describe("BIOS AI runtime proof events", () => {
  it("records proof events through the safe native proof-spine bridge", async () => {
    const calls = [];
    installBrowserShim(async (command, payload) => {
      calls.push({ command, payload });
      return { record_hash: "hash-1" };
    });
    const { recordBiosProofEventSafe } = await import(
      "../../aether-canvas/js/bios-runtime.js?runtime-proof-helper"
    );

    const result = await recordBiosProofEventSafe({
      profileId: "claw",
      eventType: "settings_changed",
      source: "settings.provider_config",
      summary: "Provider settings changed.",
      tags: ["settings"],
      payloadRedacted: {
        active_provider: "openai",
        key_count: 1,
      },
    });

    assert.equal(result.record_hash, "hash-1");
    assert.deepEqual(calls, [
      {
        command: "record_bios_proof_event",
        payload: {
          input: {
            profile_id: "claw",
            event_type: "settings_changed",
            source: "settings.provider_config",
            summary: "Provider settings changed.",
            tags: ["settings"],
            visibility: "private",
            payload_redacted: {
              active_provider: "openai",
              key_count: 1,
            },
          },
        },
      },
    ]);
  });

  it("does not block runtime callers when proof recording fails", async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    installBrowserShim(async () => {
      throw new Error("native proof unavailable");
    });
    try {
      const { recordBiosProofEventSafe } = await import(
        "../../aether-canvas/js/bios-runtime.js?runtime-proof-failure"
      );

      const result = await recordBiosProofEventSafe({
        profileId: "claw",
        eventType: "settings_changed",
        source: "settings",
        summary: "Settings changed.",
      });

      assert.equal(result, null);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("records a BOSS profile create proof event from the real profile save path", async () => {
    const calls = [];
    installBrowserShim(async (command, payload) => {
      calls.push({ command, payload });
      if (command === "save_bios_profile") {
        return {
          profile: {
            id: "claw",
            display_name: "Claw",
            completed: true,
          },
        };
      }
      if (command === "record_bios_proof_event") {
        return { record_hash: "proof-hash" };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const { AetherApp } = await import("../../aether-canvas/js/app.js?runtime-proof-app");
    const app = {
      activeBiosProfileId: null,
      agentName: "Claw",
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      loadBiosProfiles: async () => [],
      loadForgeArenaProfile: async () => null,
      saveSavedOnboardingSnapshot: AetherApp.prototype.saveSavedOnboardingSnapshot,
      updateAgentNameDOM() {},
    };

    const detail = await AetherApp.prototype.saveBiosProfileSnapshot.call(
      app,
      {
        agentName: "Claw",
        completed: true,
        modelPref: "local",
        preferredLocalBackend: "bios-managed",
        localWorkerModelVariant: "qwen-3-8b",
      },
      null,
      true,
    );

    assert.equal(detail.profile.id, "claw");
    assert.equal(app.activeBiosProfileId, "claw");
    assert.equal(localStorage.getItem("bios-ai-active-profile"), "claw");
    assert.equal(
      calls.some(
        (call) =>
          call.command === "record_bios_proof_event" &&
          call.payload.input.profile_id === "claw" &&
          call.payload.input.event_type === "boss_profile_created" &&
          call.payload.input.payload_redacted.local_worker_model_variant === "qwen-3-8b",
      ),
      true,
    );
  });
});
