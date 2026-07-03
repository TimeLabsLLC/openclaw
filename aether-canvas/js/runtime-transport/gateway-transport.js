export function createGatewayRuntimeTransport({ gateway }) {
  return {
    kind: "gateway",

    isAvailable() {
      return gateway?.isConnected === true;
    },

    async loadChatHistory({ sessionKey, limit = 50 }) {
      const history = await gateway.request("chat.history", {
        sessionKey,
        limit,
      });
      const messages = Array.isArray(history?.messages)
        ? history.messages
            .map((msg) => {
              if (msg.role !== "user" && msg.role !== "assistant") {
                return null;
              }
              const text = msg.content?.[0]?.text || "";
              if (!text) {
                return null;
              }
              return { role: msg.role, text };
            })
            .filter(Boolean)
        : [];

      return {
        transport: "gateway",
        messages,
      };
    },

    async getCapabilityPosture() {
      return {
        transport: "gateway",
        summary: "Gateway runtime is connected and owns the active BIOS capability surface.",
      };
    },

    async loadMemorySurface() {
      const res = await gateway.request("memory.surface", {
        includeClipboard: true,
        includeDreamingReplay: true,
      });
      return {
        transport: "gateway",
        surface: res?.surface || null,
      };
    },

    async loadConnectorStatus() {
      const result = await gateway.request("connector.status", {});
      return {
        transport: "gateway",
        ...(result || {}),
      };
    },

    async invokeTool({ name, arguments: toolArguments = {}, confirm = false }) {
      const result = await gateway.request("tools.invoke", {
        name,
        arguments: toolArguments,
        confirm,
      });
      return {
        transport: "gateway",
        ...(result || {}),
      };
    },

    async invokeConnector({ connector, action, arguments: connectorArguments = {}, confirm = false }) {
      const result = await gateway.request("connector.invoke", {
        connector,
        action,
        arguments: connectorArguments,
        confirm,
      });
      return {
        transport: "gateway",
        ...(result || {}),
      };
    },

    async resolveApproval({ approvalId, decision }) {
      const result = await gateway.request("approvals.resolve", {
        approvalId,
        decision,
      });
      return {
        transport: "gateway",
        ...(result || {}),
      };
    },

    async sendChatMessage({ normalizedText, sessionKey, recordRouteDecision }) {
      const idempotencyKey =
        "intent-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
      let outboundText = normalizedText;

      try {
        const routeRes = await gateway.request("skills.route", { task: normalizedText });
        const decision = routeRes?.decision;
        recordRouteDecision?.(normalizedText, decision);
        if (decision?.system === 1 && decision?.hardenedSkill?.id) {
          outboundText =
            decision?.promotedTool?.invocation ||
            `Instantly execute skill sequence: ${decision.hardenedSkill.id}`;
        }
      } catch {
        /* route preflight failed — use raw text */
      }

      await gateway.request("chat.send", {
        sessionKey,
        message: outboundText,
        idempotencyKey,
      });

      return {
        ok: true,
        transport: "gateway",
        delivery: "queued",
      };
    },
  };
}
