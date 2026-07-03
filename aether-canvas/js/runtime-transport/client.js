import { createGatewayRuntimeTransport } from "./gateway-transport.js";
import { createLocalSupervisorRuntimeTransport } from "./local-supervisor-transport.js";

export function createBiosRuntimeTransportClient({ gateway, getTauriInvoke }) {
  const gatewayTransport = createGatewayRuntimeTransport({ gateway });
  const localSupervisorTransport = createLocalSupervisorRuntimeTransport({
    getTauriInvoke,
  });

  function resolveTransport() {
    if (gatewayTransport.isAvailable()) {
      return gatewayTransport;
    }
    return localSupervisorTransport;
  }

  return {
    getActiveTransportKind() {
      return resolveTransport().kind;
    },

    async loadChatHistory(input) {
      return resolveTransport().loadChatHistory(input);
    },

    async getCapabilityPosture(input) {
      return resolveTransport().getCapabilityPosture(input);
    },

    async loadMemorySurface(input) {
      return resolveTransport().loadMemorySurface(input);
    },

    async loadConnectorStatus(input) {
      return resolveTransport().loadConnectorStatus(input);
    },

    async invokeTool(input) {
      return resolveTransport().invokeTool(input);
    },

    async invokeConnector(input) {
      return resolveTransport().invokeConnector(input);
    },

    async resolveApproval(input) {
      return resolveTransport().resolveApproval(input);
    },

    async sendChatMessage(input) {
      return resolveTransport().sendChatMessage(input);
    },
  };
}
