/**
 * AetherGatewayClient
 * Standalone WebSocket client for communicating with the Aegis Core daemon.
 * Implements the full challenge/token handshake protocol.
 */
export class AetherGatewayClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.responseCallbacks = new Map();
    this.messageId = 1;

    // Resolve credentials and connection options from URL query params (set by Electron shell)
    const urlParams = new URLSearchParams(window.location.search);
    this.host = urlParams.get("host") || "127.0.0.1";
    this.port = parseInt(urlParams.get("port") || "18789", 10);
    this.token = urlParams.get("token") || "aether-core-nexus-handshake-secure-token-2026";

    this.url = `ws://${this.host}:${this.port}/gateway`;
  }

  /**
   * Establish WebSocket connection and perform auth handshake.
   */
  connect() {
    return new Promise((resolve, reject) => {
      console.log(`[AetherGateway] Connecting to ${this.url}...`);
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log("[AetherGateway] WebSocket connected. Initiating authentication handshake...");
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleIncomingMessage(message, resolve, reject);
        } catch (err) {
          console.error("[AetherGateway] Failed to parse message frame:", err);
        }
      };

      this.socket.onclose = (event) => {
        console.log("[AetherGateway] WebSocket connection closed:", event.code, event.reason);
        this.isConnected = false;
        this.emit("disconnect", event);
      };

      this.socket.onerror = (err) => {
        console.error("[AetherGateway] WebSocket error occurred:", err);
        reject(err);
      };
    });
  }

  /**
   * Handle incoming message frames.
   */
  handleIncomingMessage(msg, resolve, reject) {
    // Handshake Challenge Phase
    if (msg.type === "event" && msg.event === "connect.challenge") {
      console.log(
        "[AetherGateway] Received auth challenge connect.challenge. Sending connect request...",
      );
      this.connectRequestId = "connect-handshake-" + Math.random().toString(36).substring(2, 11);
      const request = {
        type: "req",
        id: this.connectRequestId,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "bios-ai-shell",
            version: "1.0.0",
            platform: "win32",
            mode: "ui",
          },
          caps: [],
          commands: [],
          role: "operator",
          scopes: ["operator.read", "operator.write", "operator.admin"],
          auth: {
            token: this.token,
          },
        },
      };
      this.socket.send(JSON.stringify(request));
      return;
    }

    // Handshake Response
    if (msg.type === "res" && msg.id === this.connectRequestId) {
      if (msg.ok) {
        console.log("[AetherGateway] Handshake successful. Connected to Aegis Core!");
        this.isConnected = true;
        this.emit("connect", msg.payload);
        resolve(msg.payload);
      } else {
        console.error("[AetherGateway] Handshake rejected:", msg.error || msg.reason);
        this.socket.close();
        reject(new Error(msg.error?.message || msg.reason || "Authentication rejected"));
      }
      return;
    }

    // Handshake Failure / Auth Reject Phase
    if (msg.type === "reject") {
      console.error("[AetherGateway] Handshake rejected:", msg.reason);
      this.socket.close();
      reject(new Error(msg.reason || "Authentication rejected"));
      return;
    }

    // Standard RPC Response Frame
    if (msg.type === "res") {
      const callback = this.responseCallbacks.get(msg.id);
      if (callback) {
        this.responseCallbacks.delete(msg.id);
        if (msg.ok) {
          callback.resolve(msg.payload);
        } else {
          callback.reject(new Error(msg.error?.message || msg.error || "Request execution failed"));
        }
      }
      return;
    }

    // Broadcast Event Frame (chat, agent streams, etc.)
    if (msg.type === "event") {
      this.emit(msg.event, msg.payload);
      return;
    }
  }

  /**
   * Send RPC command to backend.
   */
  request(method, params = {}) {
    if (!this.isConnected) {
      return Promise.reject(new Error("Gateway client is not connected"));
    }

    const id = String(this.messageId++);
    const frame = {
      type: "req",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.responseCallbacks.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(frame));
    });
  }

  /**
   * Event emitter helpers
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[AetherGateway] Event callback error for "${event}":`, err);
        }
      }
    }
  }
}
