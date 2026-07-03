export const BIOS_RUNTIME_CONTRACT_VERSION = "bios-runtime-v1";

export const BIOS_RUNTIME_METHODS = Object.freeze([
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

export const BIOS_RUNTIME_EVENTS = Object.freeze([
  "chat.message",
  "tool.event",
  "connector.event",
  "continuity.event",
  "boxed_lane.event",
  "runtime.event",
]);

export function buildBiosRuntimeContractManifest() {
  return {
    version: BIOS_RUNTIME_CONTRACT_VERSION,
    methods: [...BIOS_RUNTIME_METHODS],
    events: [...BIOS_RUNTIME_EVENTS],
  };
}
