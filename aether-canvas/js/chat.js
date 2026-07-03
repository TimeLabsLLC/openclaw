/**
 * AetherChatRenderer
 * Renders high-fidelity chat sessions, message streaming, and dynamic tool cards.
 */
export class AetherChatRenderer {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById("chat-stream");
    this.input = document.getElementById("chat-input");
    this.btnSend = document.getElementById("btn-send");
    this.floatingAnchor = document.getElementById("floating-stream-anchor");
    this.shouldAutoScroll = true;

    this.activeRunId = null;
    this.activeMessageNode = null;
    this.activeMessageText = "";

    this.bindEvents();
  }

  bindEvents() {
    this.input.addEventListener("input", () => {
      this.btnSend.disabled = this.input.value.trim().length === 0;
      this.adjustInputHeight();
    });

    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submitMessage();
      }
    });

    this.btnSend.addEventListener("click", () => {
      this.submitMessage();
    });

    if (this.floatingAnchor) {
      this.floatingAnchor.addEventListener("click", () => {
        const responseStart = this.activeMessageNode
          ? this.activeMessageNode.closest(".message-wrapper")
          : null;
        if (responseStart) {
          responseStart.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          this.shouldAutoScroll = true;
          this.scrollToBottom();
        }
      });
    }

    if (this.container) {
      this.container.addEventListener("scroll", () => {
        const threshold = 120;
        const isNearBottom =
          this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight <=
          threshold;
        this.shouldAutoScroll = isNearBottom;
        if (isNearBottom) {
          this.hideFloatingAnchor();
        } else if (this.activeRunId) {
          this.showFloatingAnchor();
        }
      });
    }

    // Streaming Pill Action (Option B)
    const streamingPill = document.getElementById("streaming-pill");
    if (streamingPill) {
      streamingPill.addEventListener("click", () => {
        this.scrollToBottom();
        streamingPill.classList.add("hidden");
      });
    }
  }

  showFloatingAnchor(text = "⚛️ Stream active below — View from Start") {
    if (this.floatingAnchor) {
      this.floatingAnchor.innerText = text;
      this.floatingAnchor.classList.remove("hidden");
    }
  }

  hideFloatingAnchor() {
    if (this.floatingAnchor) {
      this.floatingAnchor.classList.add("hidden");
    }
  }

  adjustInputHeight() {
    this.input.style.height = "auto";
    this.input.style.height = `${Math.min(150, this.input.scrollHeight)}px`;
  }

  setBusy(isBusy, message = "") {
    if (this.input) {
      if (!this._idlePlaceholder) {
        this._idlePlaceholder = this.input.placeholder;
      }
      this.input.disabled = isBusy;
      this.input.placeholder = isBusy
        ? message || `${this.app.agentName || "BIOS AI"} is working...`
        : this._idlePlaceholder;
    }

    if (this.btnSend) {
      this.btnSend.disabled = isBusy || (this.input?.value.trim().length ?? 0) === 0;
      this.btnSend.setAttribute("aria-busy", isBusy ? "true" : "false");
      this.btnSend.title = isBusy ? message || "Working..." : "Send";
    }
  }

  async submitMessage() {
    const text = this.input.value.trim();
    if (!text) return;

    if (this.app.stopSpeaking) {
      this.app.stopSpeaking();
    }

    this.input.value = "";
    this.btnSend.disabled = true;
    this.input.style.height = "auto";

    // Clear any onboarding/welcome content on first real message
    if (this.container) {
      const onboardEls = this.container.querySelectorAll(".onboard-conv, .ctx-empty");
      onboardEls.forEach((el) => el.remove());
      // Also clear the centered welcome div if present
      if (
        this.container.children.length === 1 &&
        !this.container.querySelector(".message-wrapper")
      ) {
        this.container.innerHTML = "";
      }
    }

    // Renders the user's message locally first
    this.appendMessage("user", text);
    this.shouldAutoScroll = true;
    this.scrollToBottom();

    // Dispatch message to application controller
    await this.app.sendChatMessage(text);
  }

  /**
   * Render a message block locally.
   */
  appendMessage(role, text) {
    if (!this.container) return null;

    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper message-role-${role}`;

    const icon = document.createElement("div");
    icon.className = `message-avatar message-avatar--${role}`;
    icon.style.background = "none";
    icon.style.boxShadow = "none";

    const img = document.createElement("img");
    img.src = role === "user" ? "" : "";
    img.style.display = "none"; // Avatars replaced by role labels in minimal UI
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.borderRadius = "var(--radius-sm)";
    icon.appendChild(img);

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerText = text;

    wrapper.appendChild(icon);
    wrapper.appendChild(content);
    this.container.appendChild(wrapper);

    if (role === "user") {
      this.scrollToBottom();
    }

    return content;
  }

  /**
   * Handle incoming streaming chat tokens.
   */
  handleChatDelta(payload) {
    const { runId, message } = payload;
    const text = message?.content?.[0]?.text || "";

    // If this is a new run stream, create the target assistant text block
    if (this.activeRunId !== runId) {
      this.activeRunId = runId;
      this.activeMessageNode = this.appendMessage("assistant", "");
      this.activeMessageText = "";
      this.app.orb.setState("thinking");
      if (this.app.stopSpeaking) {
        this.app.stopSpeaking();
      }
    }

    if (this.activeMessageNode && text) {
      this.activeMessageText = text;
      this.activeMessageNode.innerText = text;

      // Dynamic real-time markdown outline sidebar mapping (Option A)
      this.updateOutlineMap(text);

      // Show streaming telemetry status indicator pill (Option B)
      const streamingPill = document.getElementById("streaming-pill");
      if (streamingPill) {
        streamingPill.classList.remove("hidden");
        const streamingPillText = document.getElementById("streaming-pill-text");
        if (streamingPillText) {
          streamingPillText.innerText = `${this.app.agentName || "BIOS AI"} is responding...`;
        }
      }
    }
  }

  /**
   * Finalize the streaming message run state.
   */
  handleChatFinal(payload) {
    const { runId, message } = payload;
    const text = message?.content?.[0]?.text || "";

    if (this.activeRunId === runId && this.activeMessageNode && text) {
      this.activeMessageText = text;
      this.activeMessageNode.innerText = text;
    }

    this.activeRunId = null;
    this.activeMessageNode = null;
    this.activeMessageText = "";
    this.app.orb.setState("idle");
    this.hideFloatingAnchor();

    // Hide streaming status pill on finalization
    const streamingPill = document.getElementById("streaming-pill");
    if (streamingPill) {
      streamingPill.classList.add("hidden");
    }

    if (text && this.app.speak) {
      this.app.speak(text);
    }
  }

  /**
   * Renders active tool execution card.
   */
  handleToolEvent(evt) {
    const { data } = evt;
    if (!data) return;

    const toolName = data.name || "Unknown Tool";
    const phase = data.phase || "start";

    // Track starting parameters for potential re-submission
    if (phase === "start") {
      this.activeToolCalls = this.activeToolCalls || new Map();
      const seqKey = evt.seq || data.toolCallId || `seq-${Date.now()}`;
      this.activeToolCalls.set(seqKey, {
        name: toolName,
        args: data.args || data.params || {},
      });
    }

    const isApprovalRequired =
      evt.requiresApproval ||
      evt.error?.requiresApproval ||
      data.requiresApproval ||
      data.result?.requiresApproval ||
      (data.result?.error && data.result.error.code === "requires_approval") ||
      (data.error && data.error.code === "requires_approval");

    if (isApprovalRequired) {
      this.app.orb.setState("thinking");
      this.app.subtitles.update("⚠️ Security approval required for local command execution.");

      const seqKey = evt.seq || data.toolCallId || "";
      const pendingCall = this.activeToolCalls?.get(seqKey);
      const callName = pendingCall?.name || toolName;
      const callArgs = pendingCall?.args || data.args || data.params || {};

      const securityCard = document.createElement("div");
      securityCard.className = "tool-card glass-panel security-approval-card";
      securityCard.style.border = "1px solid var(--warning)";
      securityCard.style.boxShadow = "0 0 15px var(--warning-glow)";
      securityCard.style.borderRadius = "var(--radius-md)";
      securityCard.style.overflow = "hidden";
      securityCard.style.transition = "all 0.3s var(--ease-out)";
      securityCard.style.margin = "var(--sp-3) 0";

      const reason =
        data.result?.error?.message ||
        data.error?.message ||
        "Security authorization required for local command execution.";
      const commandStr = callArgs.command || JSON.stringify(callArgs, null, 2);

      securityCard.innerHTML = `
        <div class="tool-card-header" style="background: var(--warning-glow); border-bottom: 1px solid rgba(245, 158, 11, 0.2); padding: var(--sp-3); display: flex; align-items: center; gap: var(--sp-2);">
          <span class="tool-card-icon" style="font-size: 16px;">⚠️</span>
          <span class="tool-card-title" style="color: var(--warning); font-family: var(--font-display); font-weight: 700; letter-spacing: 0.02em;">RISKY OPERATION DETECTED</span>
        </div>
        <div class="tool-card-body" style="padding: var(--sp-4); display: flex !important; flex-direction: column; gap: var(--sp-3);">
          <div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5;">
            <strong style="color: var(--text-primary);">Reason:</strong> ${reason}
          </div>
          <div style="font-size: var(--text-xs); font-family: var(--font-mono); background: rgba(0, 0, 0, 0.4); padding: var(--sp-3); border-radius: var(--radius-sm); border: 1px solid var(--glass-border); color: var(--text-primary); max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">
            <code>${commandStr}</code>
          </div>
          <div style="display: flex; gap: var(--sp-3); margin-top: var(--sp-1);">
            <button class="btn-authorize" style="
              flex: 1;
              background: rgba(16, 185, 129, 0.25);
              border: 1px solid var(--success);
              color: var(--text-primary);
              padding: var(--sp-2) var(--sp-3);
              border-radius: var(--radius-sm);
              cursor: pointer;
              font-family: var(--font-display);
              font-size: var(--text-xs);
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              transition: all 0.2s var(--ease-out);
              box-shadow: 0 0 10px var(--success-glow);
            ">Authorize Command</button>
            <button class="btn-reject" style="
              flex: 1;
              background: rgba(239, 68, 68, 0.25);
              border: 1px solid var(--danger);
              color: var(--text-primary);
              padding: var(--sp-2) var(--sp-3);
              border-radius: var(--radius-sm);
              cursor: pointer;
              font-family: var(--font-display);
              font-size: var(--text-xs);
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              transition: all 0.2s var(--ease-out);
              box-shadow: 0 0 10px var(--danger-glow);
            ">Reject Command</button>
          </div>
        </div>
      `;

      // Hover effects
      const btnAuth = securityCard.querySelector(".btn-authorize");
      const btnRej = securityCard.querySelector(".btn-reject");

      btnAuth.addEventListener("mouseover", () => {
        btnAuth.style.background = "rgba(16, 185, 129, 0.4)";
        btnAuth.style.boxShadow = "0 0 15px var(--success)";
      });
      btnAuth.addEventListener("mouseout", () => {
        btnAuth.style.background = "rgba(16, 185, 129, 0.25)";
        btnAuth.style.boxShadow = "0 0 10px var(--success-glow)";
      });

      btnRej.addEventListener("mouseover", () => {
        btnRej.style.background = "rgba(239, 68, 68, 0.4)";
        btnRej.style.boxShadow = "0 0 15px var(--danger)";
      });
      btnRej.addEventListener("mouseout", () => {
        btnRej.style.background = "rgba(239, 68, 68, 0.25)";
        btnRej.style.boxShadow = "0 0 10px var(--danger-glow)";
      });

      btnAuth.addEventListener("click", async () => {
        btnAuth.disabled = true;
        btnRej.disabled = true;
        btnAuth.innerText = "Executing...";

        try {
          if (evt.transport === "local-supervisor") {
            const approvalId =
              data.approvalId || data.result?.approval_id || data.result?.approvalId || null;
            if (!approvalId) {
              throw new Error("Local BIOS approval is missing its approval id.");
            }
            const result = await this.app.getRuntimeTransportClient().resolveApproval({
              profileId: this.app.getActiveBiosProfileId?.() || this.app.activeBiosProfileId || null,
              approvalId,
              decision: "approve",
            });
            securityCard.remove();
            this.appendMessage(
              "assistant",
              `${result?.summary || "BIOS AI approved the guarded action."} ${result?.detail || ""}`.trim(),
            );
          } else {
            await this.app.gateway.request("tools.invoke", {
              name: callName,
              arguments: callArgs,
              confirm: true,
            });
            securityCard.remove();
          }
          this.app.orb.setState("idle");
        } catch (err) {
          console.error("Authorization request failed:", err);
          this.app.subtitles.update("❌ Command execution failed.");
          btnAuth.disabled = false;
          btnRej.disabled = false;
          btnAuth.innerText = "Authorize Command";
        }
      });

      btnRej.addEventListener("click", async () => {
        if (evt.transport !== "local-supervisor") {
          securityCard.remove();
          this.appendMessage("assistant", "Action cancelled by operator.");
          this.app.orb.setState("idle");
          return;
        }

        btnAuth.disabled = true;
        btnRej.disabled = true;
        btnRej.innerText = "Rejecting...";

        try {
          const approvalId =
            data.approvalId || data.result?.approval_id || data.result?.approvalId || null;
          if (!approvalId) {
            throw new Error("Local BIOS approval is missing its approval id.");
          }
          const result = await this.app.getRuntimeTransportClient().resolveApproval({
            profileId: this.app.getActiveBiosProfileId?.() || this.app.activeBiosProfileId || null,
            approvalId,
            decision: "reject",
          });
          securityCard.remove();
          this.appendMessage(
            "assistant",
            `${result?.summary || "BIOS AI rejected the guarded action."} ${result?.detail || ""}`.trim(),
          );
          this.app.orb.setState("idle");
        } catch (err) {
          console.error("Rejection request failed:", err);
          btnAuth.disabled = false;
          btnRej.disabled = false;
          btnRej.innerText = "Reject Command";
          this.app.subtitles.update("âŒ Command rejection failed.");
        }
      });

      const existingCard = document.getElementById(`tool-${evt.seq}`);
      if (existingCard) {
        existingCard.replaceWith(securityCard);
      } else {
        this.container.appendChild(securityCard);
      }
      this.scrollToBottom();
      return;
    }

    if (phase === "start") {
      const toolCard = document.createElement("div");
      toolCard.className = "tool-card glass-panel";
      toolCard.id = `tool-${evt.seq}`;
      toolCard.innerHTML = `
        <div class="tool-card-header">
          <span class="tool-card-icon">⚡</span>
          <span class="tool-card-title">Running tool: <code>${toolName}</code></span>
          <span class="tool-card-spinner"></span>
        </div>
        <div class="tool-card-body hidden">
          <pre><code>${JSON.stringify(data.params || {}, null, 2)}</code></pre>
        </div>
      `;

      // Allow clicking header to toggle parameters visualization
      toolCard.querySelector(".tool-card-header").addEventListener("click", () => {
        const body = toolCard.querySelector(".tool-card-body");
        body.classList.toggle("hidden");
      });

      this.container.appendChild(toolCard);

      this.app.orb.setState("acting");
      this.app.subtitles.update(
        `Running tool ${toolName}...`,
        `${this.app.agentName || "BIOS AI"}: `,
      );
    }

    if (phase === "end" || phase === "result") {
      const seqKey = evt.seq || data.toolCallId || "";
      const toolCard = document.getElementById(`tool-${seqKey}`);
      if (toolCard) {
        const header = toolCard.querySelector(".tool-card-header");
        if (header && !header.querySelector(".tool-card-badge")) {
          header.classList.add("tool-card-completed");
          const spinner = header.querySelector(".tool-card-spinner");
          if (spinner) spinner.remove();

          const badge = document.createElement("span");
          badge.className = "tool-card-badge";
          badge.innerText = data.isError ? "failed" : "completed";
          if (data.isError) {
            badge.style.background = "var(--danger-glow)";
            badge.style.color = "var(--danger)";
          }
          header.appendChild(badge);
        }
      }
      this.app.orb.setState("idle");
    }
  }

  /**
   * Renders dynamically projected HTML widgets from the Apps SDK.
   */
  renderWidget(payload) {
    const { widgetId, html, title } = payload;
    if (!this.container) return;

    const widgetCard = document.createElement("div");
    widgetCard.className = "tool-card glass-panel widget-card";
    widgetCard.id = `widget-${widgetId}`;
    widgetCard.innerHTML = `
      <div class="tool-card-header">
        <span class="tool-card-icon">📱</span>
        <span class="tool-card-title">${title || "App Widget"}</span>
        <span class="tool-card-badge">projected</span>
      </div>
      <div class="tool-card-body widget-content" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        ${html}
      </div>
    `;

    // Map buttons with data-callback attributes to gateway requests
    widgetCard.querySelectorAll("button[data-callback]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const callbackName = btn.getAttribute("data-callback");
        const callbackDataStr = btn.getAttribute("data-data") || "{}";

        let callbackData = {};
        try {
          callbackData = JSON.parse(callbackDataStr);
        } catch {
          // Fallback if data is raw string
          callbackData = { value: callbackDataStr };
        }

        this.app.gateway
          .request("widget.callback", {
            widgetId,
            callback: callbackName,
            data: callbackData,
          })
          .catch((err) => console.error("Widget callback execution failed:", err));
      });
    });

    this.container.appendChild(widgetCard);
  }

  scrollToBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  updateOutlineMap(text) {
    const container = document.getElementById("outline-hud-section");
    if (!container) return;

    // Clear and build the dynamic outline portion of the HUD
    container.innerHTML = '<h3 class="hud-section-title">⚛&nbsp; OUTLINE MAP</h3>';

    // Regex to match markdown headings ## and ###
    const headingRegex = /^(##|###)\s+(.+)$/gm;
    let match;
    let hasNodes = false;

    while ((match = headingRegex.exec(text)) !== null) {
      hasNodes = true;
      const level = match[1];
      const label = match[2].trim();

      const node = document.createElement("a");
      node.className = `outline-node outline-node--${level === "##" ? "h2" : "h3"}`;
      node.innerText = label;
      node.title = `Jump to: ${label}`;

      node.addEventListener("click", () => {
        const elements = this.container.querySelectorAll(".message-content");
        for (const el of elements) {
          if (el.innerText.includes(label)) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            break;
          }
        }
      });

      container.appendChild(node);
    }

    if (!hasNodes) {
      container.innerHTML +=
        '<p style="font-size: 10px; color: var(--text-dim); font-style: italic; padding: 4px var(--sp-2);">No headings compiled in this turn.</p>';
    }
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
