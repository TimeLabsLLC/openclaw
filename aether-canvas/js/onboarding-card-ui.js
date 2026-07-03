export function renderManagedWorkerSetupCard({
  agentName,
  cardStyle,
  ghostBtn,
  primaryBtn,
  recommendedWorker,
  workerOptions,
  mustFinishWithLocalWorker,
  modelChoice,
  escapeTooltip,
  installedMode = false,
  machineFitSummary = "the verified machine read is still incomplete",
  showBringYourOwnOption = true,
}) {
  return `
    <div style="${cardStyle}">
      <p style="font-size: 13px; color: #a0aec0; margin: 0 0 6px; line-height: 1.6;">
        ${
          installedMode
            ? "These BIOS AI managed local BOSS brains are already on this machine. Pick the exact one this BOSS should wake up with first."
            : `${agentName} can run locally, but BIOS AI still needs the exact local BOSS brain files before first work can begin.`
        }
      </p>
      <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px; line-height: 1.6;">
        ${
          installedMode
            ? "The selected model is already installed in the BIOS AI managed llama.cpp runtime, so BIOS AI can verify it and continue immediately."
            : "BIOS AI recommends one based on this machine, downloads that exact model into the BIOS AI managed llama.cpp runtime, verifies it, and only then continues."
        }
      </p>
      ${
        mustFinishWithLocalWorker
          ? `<p style="font-size: 11px; color: #f6ad55; margin: 0 0 12px; line-height: 1.6;">Because ${
              modelChoice === "local"
                ? "you chose Local only"
                : modelChoice === "hybrid"
                  ? "you chose Hybrid"
                  : "no cloud API key is configured"
            }, BIOS AI needs a working local model before setup can finish.</p>`
          : '<p style="font-size: 11px; color: #4a5568; margin: 0 0 12px; line-height: 1.6;">You can skip this for now because your cloud route is already ready.</p>'
      }
      <p style="font-size: 11px; color: #4a5568; margin: 0 0 10px; line-height: 1.6;">
        BIOS AI recommends <strong>${recommendedWorker.label}</strong> on this machine based on BIOS AI's verified machine read: ${machineFitSummary}.
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${workerOptions
          .map((option) => {
            const selectedStyle =
              option.variant === recommendedWorker.variant ? primaryBtn : ghostBtn;
            const disabledStyle = option.enabled
              ? ""
              : "opacity: 0.45; cursor: not-allowed; border-color: rgba(255,255,255,0.08); color: #718096;";
            const tooltip = [option.summary, option.reason].filter(Boolean).join(" ");
            const sourceLine = option.managed
              ? "BIOS AI managed download and runtime lane"
              : "Bring-your-own GGUF already found in the BIOS AI model lane";
            const licenseLine = option.licenseLabel
              ? `License: ${option.licenseLabel}`
              : "License: user-provided model terms";
            const sourceUrlLine = option.sourceUrl ? ` Source: ${option.sourceUrl}` : "";
            const readinessLabel = option.enabled
              ? installedMode
                ? "Ready now"
                : option.fitConfidence === "partial"
                  ? "Available, hardware partly verified"
                  : "Available"
              : "Not recommended on this system";
            return `
              <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px;">
                <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                  <button data-value="${option.variant}" class="conv-action" title="${escapeTooltip(tooltip)}" ${option.enabled ? "" : "disabled"} style="${selectedStyle} ${disabledStyle}">${option.label}${option.variant === recommendedWorker.variant ? " (recommended)" : ""}</button>
                  <span title="${escapeTooltip(tooltip)}" style="font-size: 10px; color: ${option.enabled ? "hsl(160,100%,60%)" : "#a0aec0"};">${readinessLabel}</span>
                </div>
                <p style="font-size: 11px; color: hsl(160,100%,70%); margin: 8px 0 0; line-height: 1.5;">${option.role}</p>
                <p style="font-size: 11px; color: #a0aec0; margin: 8px 0 0; line-height: 1.5;">${option.summary}</p>
                <p style="font-size: 10px; color: #4a5568; margin: 6px 0 0; line-height: 1.5;">Exact model: ${option.modelId || option.variant}</p>
                <p style="font-size: 10px; color: #4a5568; margin: 6px 0 0; line-height: 1.5;">${licenseLine}.${sourceUrlLine}</p>
                <p style="font-size: 10px; color: #4a5568; margin: 6px 0 0; line-height: 1.5;">${option.sizeLabel} - ${sourceLine}</p>
                ${option.reason ? `<p style="font-size: 10px; color: #f6ad55; margin: 6px 0 0; line-height: 1.5;">${option.reason}</p>` : ""}
              </div>
            `;
          })
          .join("")}
        ${
          showBringYourOwnOption
            ? `<button data-value="use-own-gguf" class="conv-action" style="${ghostBtn}">Use my own llama.cpp GGUF</button>`
            : ""
        }
        ${
          mustFinishWithLocalWorker
            ? ""
            : `<button data-value="skip-download" class="conv-action" style="${ghostBtn}">Skip for now</button>`
        }
      </div>
    </div>
  `;
}

export function renderExternalWorkerSetupCard({ cardStyle, primaryBtn }) {
  return `
    <div style="${cardStyle}">
      <p style="font-size: 13px; color: #a0aec0; margin: 0 0 6px; line-height: 1.6;">
        Use your own llama.cpp-compatible GGUF for this BOSS profile.
      </p>
      <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px; line-height: 1.6;">
        Paste the full path to a local <strong>.gguf</strong> file. BIOS AI will verify the file, bind it to this BOSS profile, and then keep using that exact brain until you change it.
      </p>
      <input
        id="external-gguf-path-input"
        type="text"
        placeholder="E:\\Models\\Qwen3-14B-Q4_K_M.gguf"
        style="width: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(3,7,18,0.8); color: #e2e8f0; padding: 10px 12px; font-size: 12px; margin: 0 0 10px;"
      />
      <p id="external-gguf-path-status" style="font-size: 11px; color: #4a5568; margin: 0 0 12px; line-height: 1.6;">
        This does not copy the model into BIOS AI storage. It tells BIOS AI to use the exact GGUF file you already have.
      </p>
      <button data-value="save-external-gguf" class="conv-action" style="${primaryBtn}">Use this GGUF</button>
    </div>
  `;
}

export function renderWorkerStorageCard({
  cardStyle,
  escapeOnboardingHtml,
  formatStorageBytes,
  ghostBtn,
  primaryBtn,
  recommendedStorage,
  selectedWorkerLabel,
  storageOptions,
}) {
  return `
    <div style="${cardStyle}">
      <p style="font-size: 13px; color: #a0aec0; margin: 0 0 6px; line-height: 1.6;">
        Where should BIOS AI store the ${selectedWorkerLabel} files?
      </p>
      <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px; line-height: 1.6;">
        BIOS AI will download the model into the location you choose here and keep using that location later unless you change it in Settings.
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${storageOptions
          .map((option) => {
            const statusBits = [
              option.is_default ? "default" : "",
              option.is_recommended ? "recommended" : "",
              option.free_bytes ? `${formatStorageBytes(option.free_bytes)} free` : "",
            ].filter(Boolean);
            return `
              <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px;">
                <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                  <button data-value="${escapeOnboardingHtml(option.path)}" class="conv-action" style="${option.path === recommendedStorage.path ? primaryBtn : ghostBtn}">${option.label}${option.path === recommendedStorage.path ? " (recommended)" : ""}</button>
                  <span style="font-size: 10px; color: ${option.free_bytes ? "hsl(160,100%,60%)" : "#a0aec0"};">${statusBits.join(" | ")}</span>
                </div>
                <p style="font-size: 10px; color: #4a5568; margin: 8px 0 0; line-height: 1.5;">${escapeOnboardingHtml(option.path)}</p>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

export function renderOnboardingReadbackCard({
  agentName,
  cardStyle,
  keysSummary,
  localRuntimeLabel,
  localWorkerLabel,
  modeLabel,
  modelLabel,
  modelPref,
  primaryBtn,
  promotionPolicy,
  routeReadinessDetail,
  routeReadinessHeadline,
  safetyPostureLabel,
}) {
  return `
    <div style="${cardStyle}">
      <p style="font-size: 13px; color: #e2e8f0; margin: 0 0 12px; line-height: 1.7;">
        <strong style="color: hsl(160,100%,70%);">${agentName}</strong> is configured. Check the final setup before BIOS AI starts.
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px; margin: 0 0 12px;">
        <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px;">
          <p style="font-size: 10px; color: #4a5568; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em;">Route readiness</p>
          <p style="font-size: 12px; color: #e2e8f0; margin: 0;"><strong>${routeReadinessHeadline}</strong></p>
          <p style="font-size: 11px; color: #a0aec0; margin: 6px 0 0;">${routeReadinessDetail}</p>
        </div>
        <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px;">
          <p style="font-size: 10px; color: #4a5568; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em;">BOSS route</p>
          <p style="font-size: 12px; color: #e2e8f0; margin: 0;"><strong>${modelLabel}</strong></p>
          ${modelPref === "commercial" ? "" : `<p style="font-size: 11px; color: #a0aec0; margin: 6px 0 0;">${localRuntimeLabel} · ${localWorkerLabel}</p>`}
        </div>
        <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px;">
          <p style="font-size: 10px; color: #4a5568; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em;">Authority and safety</p>
          <p style="font-size: 12px; color: #e2e8f0; margin: 0;"><strong>${modeLabel}</strong></p>
          <p style="font-size: 11px; color: #a0aec0; margin: 6px 0 0;">${safetyPostureLabel} · ${promotionPolicy}</p>
        </div>
        <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px;">
          <p style="font-size: 10px; color: #4a5568; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em;">Imported connections</p>
          <p style="font-size: 11px; color: #a0aec0; margin: 0;">${keysSummary}</p>
        </div>
      </div>
      <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px;">
        Press Start Working and BIOS AI will save this setup into the shell. You can change these choices later in Settings.
      </p>
      <button data-value="done" class="conv-action" style="${primaryBtn}">Start Working -></button>
    </div>
  `;
}
