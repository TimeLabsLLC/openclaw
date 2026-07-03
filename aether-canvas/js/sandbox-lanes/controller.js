import { buildBoxedLaneRenderSnapshot, toCustomerProtectedWorkCopy } from "./boxed-lane-ui.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function boxedLaneItemClass(item) {
  if (/historical_blocked/i.test(item.state || "")) {
    return "settings-profile-card";
  }
  if (/approved|completed/i.test(item.state || "")) {
    return "settings-profile-card settings-profile-card--ready";
  }
  if (/blocked|rejected/i.test(item.state || "")) {
    return "settings-profile-card settings-profile-card--danger";
  }
  return "settings-profile-card";
}

function renderQueueItem(item) {
  const label = escapeHtml(toCustomerProtectedWorkCopy(item.label || "Protected item"));
  const kind = escapeHtml(item.kind || "artifact");
  const lifecycle = escapeHtml(
    toCustomerProtectedWorkCopy(item.lifecycle_stage_label || item.state || "Recorded"),
  );
  const hostAccess = escapeHtml(
    toCustomerProtectedWorkCopy(
      item.host_access_label || "Computer changes wait until the protected workspace check passes",
    ),
  );
  const action = escapeHtml(
    toCustomerProtectedWorkCopy(item.promotion_action_label || "Continue protected work"),
  );
  const detail = escapeHtml(
    toCustomerProtectedWorkCopy(item.detail || "No detail recorded yet."),
  );
  const evidence = escapeHtml(
    toCustomerProtectedWorkCopy(item.evidence_summary || `Evidence items: ${item.evidence_count || 0}`),
  );
  return `
    <article class="${boxedLaneItemClass(item)}">
      <div class="settings-profile-card__title">
        <strong>${label}</strong>
        <span>${kind}</span>
      </div>
      <p class="setting-note">${lifecycle}. ${hostAccess}.</p>
      <p class="setting-note">${detail}</p>
      <p class="setting-note"><strong>Next:</strong> ${action}. <strong>Check:</strong> ${evidence}.</p>
    </article>
  `;
}

function describePrepareBoxedLaneResult(result) {
  const action = result?.action_taken || "unknown";
  const blocked = result?.blocked_reason || "";
  const command = result?.command_preview || "";
  const installState = result?.status?.install_state || "";
  const proofState = result?.status?.proof_state || "";
  const requiresReboot = Boolean(result?.status?.requires_reboot);
  const lastRepairSummary = result?.status?.last_repair_summary || "";
  const nextAction = result?.status?.next_action || "";
  const suffix = [
    installState ? `State: ${installState}.` : "",
    proofState ? `Proof: ${proofState}.` : "",
    requiresReboot ? "Windows may need a restart before BIOS AI can finish verification." : "",
    lastRepairSummary,
    nextAction,
  ]
    .filter(Boolean)
    .join(" ");
  if (action === "already_ready") {
    return "Protected workspace is ready.";
  }
  if (action === "os_setup_started") {
    return suffix
      ? `Protected workspace setup started. BIOS AI will refresh readiness after the computer finishes setup. ${suffix}`
      : "Protected workspace setup started. BIOS AI will refresh readiness after the computer finishes setup.";
  }
  if (action === "background_repair_queued") {
    return `${blocked || "BOSS queued protected workspace setup in the background."} ${suffix}`.trim();
  }
  if (action === "blocked_by_setup_safety_gate") {
    return `${blocked || "BIOS AI paused protected workspace setup until it can run without interrupting you."} ${suffix}`.trim();
  }
  if (action === "blocked_until_os_consent") {
    return command
      ? `${blocked} Setup command: ${command}. ${suffix}`.trim()
      : `${blocked || "Protected workspace setup needs permission to change this computer."} ${suffix}`.trim();
  }
  if (action === "unsupported_automatic_setup") {
    return `${blocked || "This platform still needs BIOS AI protected workspace setup."} ${suffix}`.trim();
  }
  if (action === "os_setup_failed") {
    return `${blocked || "The computer did not complete protected workspace setup."} ${suffix}`.trim();
  }
  return `${blocked || "Protected workspace setup finished without a ready check."} ${suffix}`.trim();
}

function boxedLaneRepairIsPending(snapshot, app) {
  const provisioning =
    app.biosBoxedLane?.provisioning || app.biosRuntimeStatus?.boxed_lane_provisioning || {};
  const latest = app.biosBoxedLaneManualRepairResult?.status || provisioning;
  return ["verifying_after_os_setup", "waiting_for_permission"].includes(
    latest?.repair_state || provisioning?.repair_state || "",
  );
}

function wirePrepareBoxedLaneButton(app, snapshot) {
  const button = document.getElementById("settings-prepare-boxed-lane");
  const status = document.getElementById("settings-prepare-boxed-lane-status");
  if (!button) {
    return;
  }
  const ready = /ready for supervised work/i.test(snapshot.statusOverviewTitle || "");
  const repairPending = boxedLaneRepairIsPending(snapshot, app);
  button.disabled = ready || repairPending || !app.activeBiosProfileId;
  button.innerText = ready
    ? "Protected Workspace Ready"
    : repairPending
      ? "Checking Protected Workspace"
      : "Set Up Protected Workspace";
  if (status && ready) {
    status.innerText = "Protected workspace is ready for unknown work.";
  } else if (status && !app.activeBiosProfileId) {
    status.innerText = "Choose a BOSS profile before setting up the protected workspace.";
  } else if (status && app.biosBoxedLaneManualRepairResult) {
    status.innerText = `Latest setup attempt: ${toCustomerProtectedWorkCopy(describePrepareBoxedLaneResult(app.biosBoxedLaneManualRepairResult))}`;
  } else if (status && app.biosBoxedLaneManualRepairError) {
    status.innerText = `Latest setup attempt failed: ${toCustomerProtectedWorkCopy(app.biosBoxedLaneManualRepairError)}`;
  } else if (status && repairPending) {
    const provisioning =
      app.biosBoxedLane?.provisioning || app.biosRuntimeStatus?.boxed_lane_provisioning || {};
    status.innerText =
      provisioning.last_repair_summary ||
      provisioning.background_repair_label ||
      "BIOS AI is checking protected workspace setup.";
  } else if (status && app.biosBoxedLaneAutoPrepareResult) {
    status.innerText = `BIOS AI protected workspace setup is waiting. ${toCustomerProtectedWorkCopy(describePrepareBoxedLaneResult(app.biosBoxedLaneAutoPrepareResult))}`;
  } else if (status && app.biosBoxedLaneAutoPrepareError) {
    status.innerText = `BIOS AI tried to prepare the protected workspace automatically, but setup needs attention: ${toCustomerProtectedWorkCopy(app.biosBoxedLaneAutoPrepareError)}`;
  } else if (status && snapshot.boxedLaneSubstrateLabel) {
    status.innerText =
      `${snapshot.boxedLaneSubstrateLabel}. ${snapshot.boxedLaneSummary || ""}`.trim();
  }
  button.onclick = async () => {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !app.activeBiosProfileId) {
      if (status) {
        status.innerText = "The installed BIOS AI app is required to prepare the protected workspace.";
      }
      return;
    }
    button.disabled = true;
    app.biosBoxedLaneManualRepairResult = null;
    app.biosBoxedLaneManualRepairError = null;
    if (status) {
      status.innerText = "Checking protected workspace setup...";
    }
    try {
      await tauriInvoke("append_debug_log", {
        event: "boxed_lane.repair.clicked",
        details: JSON.stringify({
          profileId: app.activeBiosProfileId,
          source: "settings",
          allowOsChanges: true,
        }),
      }).catch?.(() => null);
      const result = await tauriInvoke("bios_prepare_boxed_lane", {
        input: {
          profile_id: app.activeBiosProfileId,
          allow_os_changes: true,
        },
      });
      app.biosBoxedLaneManualRepairResult = result;
      if (status) {
        status.innerText = `Latest setup attempt: ${toCustomerProtectedWorkCopy(describePrepareBoxedLaneResult(result))}`;
      }
      if (boxedLaneRepairIsPending(snapshot, app)) {
        button.innerText = "Checking Protected Workspace";
        button.disabled = true;
      }
      await app.loadBiosRuntimeStatus?.({ tickBrainstem: false });
    } catch (err) {
      app.biosBoxedLaneManualRepairError = err?.message || String(err);
      if (status) {
        status.innerText = `Latest setup attempt failed: ${toCustomerProtectedWorkCopy(app.biosBoxedLaneManualRepairError)}`;
      }
    } finally {
      button.disabled = boxedLaneRepairIsPending(snapshot, app);
    }
  };
}

export function renderSandboxLaneSurface(app, contract) {
  const snapshot = buildBoxedLaneRenderSnapshot(contract, {
    profileName: app.agentName || "waiting",
  });

  app.setStatusValue("st-sandbox-health", snapshot.sandboxHealthLabel);
  app.setStatusValue("st-workers", snapshot.workerShellLabel);
  app.setStatusValue("st-promotion-gate", snapshot.promotionGateLabel);

  const textMap = [
    ["settings-boxed-lane-state", snapshot.boxedLaneStateLabel],
    ["settings-boxed-lane-substrate", snapshot.boxedLaneSubstrateLabel],
    ["settings-promotion-gate", snapshot.promotionGateLabel],
    ["settings-safety-summary", snapshot.safetySummaryLabel],
    ["settings-boxed-lane-summary", snapshot.boxedLaneSummary],
    ["settings-boxed-lane-queue", snapshot.queueSummaryLabel],
    ["settings-promotion-record", snapshot.latestDecisionLabel],
    ["settings-boxed-lane-events", snapshot.latestEventLabel],
  ];

  textMap.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = value;
    }
  });

  const title = document.getElementById("status-overview-title");
  const copy = document.getElementById("status-overview-copy");
  if (title) {
    title.innerText = snapshot.statusOverviewTitle;
    title.classList.toggle(
      "status-overview-title-ready",
      /ready/i.test(snapshot.statusOverviewTitle),
    );
  }
  if (copy) {
    copy.innerText = snapshot.statusOverviewCopy;
  }

  const queueList = document.getElementById("settings-boxed-lane-queue-list");
  if (queueList) {
    queueList.innerHTML = snapshot.queueItems.length
      ? snapshot.queueItems.map((item) => renderQueueItem(item)).join("")
      : '<p class="setting-note">No protected work recorded yet.</p>';
  }
  wirePrepareBoxedLaneButton(app, snapshot);

  return snapshot;
}
