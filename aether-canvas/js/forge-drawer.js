/**
 * ForgeDrawer
 * Governs the dynamic bottom drawer developer REPL interface.
 * Shows dynamic TypeScript compilations, skill generator streams, and code visualizers.
 */
export class ForgeDrawer {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById("forge-drawer");
    this.isOpen = false;

    this.buildDom();
  }

  buildDom() {
    if (!this.container) return;

    this.container.className = "forge-drawer-hidden glass-panel";
    this.container.innerHTML = `
      <div class="forge-header">
        <div class="forge-title">
          <span class="forge-icon">🛠️</span>
          <h4>The Forge — Dynamic Tool Synthetics</h4>
        </div>
        <button id="forge-btn-close" class="forge-btn-close" aria-label="Close Forge">✕</button>
      </div>
      <div class="forge-prototype-note">Prototype preview only. Live approvals, verification, and evidence stay in the main shell.</div>
      <div class="forge-body">
        <div class="forge-editor-pane">
          <div class="forge-pane-header">Dynamic Code Synthesis Buffer</div>
          <pre id="forge-code-preview"><code>// Dynamic tools code preview will be rendered here...</code></pre>
        </div>
        <div class="forge-console-pane">
          <div class="forge-pane-header">Compiler & Skill Registry Output</div>
          <div id="forge-console-log" class="console-logs"></div>
        </div>
      </div>
    `;

    document.getElementById("forge-btn-close").addEventListener("click", () => {
      this.close();
    });
  }

  /**
   * Slide open the Forge Drawer and populate it with compiler metrics.
   */
  open() {
    if (!this.container) return;
    this.container.className = "forge-drawer-visible glass-panel";
    this.isOpen = true;
    this.app.orb.setState("forging");
  }

  close() {
    if (!this.container) return;
    this.container.className = "forge-drawer-hidden glass-panel";
    this.isOpen = false;
    this.app.orb.setState("idle");
  }

  /**
   * Push code generation blocks onto the editor view.
   */
  updateCode(codeText, language = "typescript") {
    const codeNode = document.querySelector("#forge-code-preview code");
    if (codeNode) {
      codeNode.innerText = codeText;
      codeNode.className = `language-${language}`;
    }
  }

  /**
   * Append lines to the compiler console feed.
   */
  log(message, type = "info") {
    const consoleLog = document.getElementById("forge-console-log");
    if (!consoleLog) return;

    const entry = document.createElement("div");
    entry.className = `console-entry console-entry-${type}`;

    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="console-time">[${timestamp}]</span> <span class="console-text">${message}</span>`;

    consoleLog.appendChild(entry);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  clearLogs() {
    const consoleLog = document.getElementById("forge-console-log");
    if (consoleLog) {
      consoleLog.innerHTML = "";
    }
  }
}
