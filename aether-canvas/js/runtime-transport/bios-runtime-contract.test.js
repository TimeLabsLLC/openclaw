import { describe, expect, it } from "vitest";
import {
  BIOS_RUNTIME_CONTRACT_VERSION,
  BIOS_RUNTIME_EVENTS,
  BIOS_RUNTIME_METHODS,
  buildBiosRuntimeContractManifest,
} from "./bios-runtime-contract.js";

describe("bios runtime contract manifest", () => {
  it("exposes the canonical phase-zero contract version", () => {
    expect(BIOS_RUNTIME_CONTRACT_VERSION).toBe("bios-runtime-v1");
  });

  it("defines a stable transport-neutral method set", () => {
    expect(BIOS_RUNTIME_METHODS).toEqual([
      "chat.send",
      "chat.history",
      "memory.surface",
      "observation.snapshot",
      "tools.invoke",
      "connector.status",
      "connector.invoke",
      "runtime.capability_posture",
      "runtime.health",
      "approvals.resolve",
    ]);
  });

  it("defines a stable transport-neutral event set", () => {
    expect(BIOS_RUNTIME_EVENTS).toEqual([
      "chat.message",
      "tool.event",
      "connector.event",
      "continuity.event",
      "boxed_lane.event",
      "runtime.event",
    ]);
  });

  it("returns a manifest copy that callers can inspect without mutating source truth", () => {
    const manifest = buildBiosRuntimeContractManifest();

    expect(manifest).toEqual({
      version: "bios-runtime-v1",
      methods: [...BIOS_RUNTIME_METHODS],
      events: [...BIOS_RUNTIME_EVENTS],
    });

    expect(new Set(manifest.methods).size).toBe(manifest.methods.length);
    expect(new Set(manifest.events).size).toBe(manifest.events.length);
  });
});
