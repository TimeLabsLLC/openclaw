/**
 * CognitiveSubtitles
 * Manages the ambient translucent subtitle overlays on the desktop screen.
 * Shows detailed micro-logs/actions of the agent without a large HUD viewport.
 */
export class CognitiveSubtitles {
  constructor() {
    this.container = null;
    this.textNode = null;
    this.statusNode = null;
    this.timeout = null;

    this.buildDom();
  }

  buildDom() {
    // Build floating overlay container
    this.container = document.createElement("div");
    this.container.id = "cognitive-subtitles";
    this.container.className = "cognitive-subtitles-hidden";

    const content = document.createElement("div");
    content.className = "cognitive-subtitles-content";

    const indicator = document.createElement("span");
    indicator.className = "cognitive-subtitles-indicator";
    indicator.style.display = "inline-flex";
    indicator.style.alignItems = "center";
    indicator.style.justifyContent = "center";
    indicator.innerHTML =
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(190,100%,50%);margin-right:6px;"></span>';

    this.statusNode = document.createElement("span");
    this.statusNode.className = "cognitive-subtitles-prefix";
    this.statusNode.innerText = "BIOS AI: ";

    this.textNode = document.createElement("span");
    this.textNode.className = "cognitive-subtitles-text";
    this.textNode.innerText = "Workspace is ready. Approvals and evidence stay in the main view.";

    content.appendChild(indicator);
    content.appendChild(this.statusNode);
    content.appendChild(this.textNode);
    this.container.appendChild(content);

    document.body.appendChild(this.container);
  }

  /**
   * Set dynamic status prefix and text value.
   */
  update(text, prefix = null, syncHero = true) {
    if (!text) {
      this.hide();
      return;
    }

    clearTimeout(this.timeout);

    const agentName = window.app?.agentName || "BIOS AI";

    let resolvedPrefix = prefix;
    if (resolvedPrefix) {
      resolvedPrefix = resolvedPrefix
        .replace(/BIOS AI Core/g, `${agentName} Core`)
        .replace(/BIOS AI/g, agentName);
    } else {
      resolvedPrefix = `${agentName}: `;
    }

    const resolvedText = text
      .replace(/BIOS AI Core/g, `${agentName} Core`)
      .replace(/BIOS AI/g, agentName);

    this.statusNode.innerText = resolvedPrefix;
    this.textNode.innerText = resolvedText;

    // Sync with viewport status bar
    if (syncHero) {
      const statusText = document.getElementById("viewport-status-text");
      if (statusText) {
        const shortText =
          resolvedText.length > 40 ? resolvedText.slice(0, 37) + "..." : resolvedText;
        statusText.innerText = shortText.toUpperCase();
      }
    }

    // Show container with smooth transition
    this.container.className = "cognitive-subtitles-visible";

    // Auto-hide subtitles after 5 seconds of complete silence
    this.timeout = setTimeout(() => {
      this.hide();
    }, 5000);
  }

  hide() {
    if (this.container) {
      this.container.className = "cognitive-subtitles-hidden";
    }
  }
}
