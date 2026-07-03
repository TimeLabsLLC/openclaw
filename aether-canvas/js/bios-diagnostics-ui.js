export function buildBiosDiagnosticsSnapshot({
  activeProfile = null,
  diagnostics = null,
  onboarding = null,
  runtimeStatus = null,
  brainstem = null,
} = {}) {
  const profileName = activeProfile?.display_name || onboarding?.agentName || "BIOS AI";
  const onboardingCompleted = Boolean(onboarding?.completed);
  const routeReady = Boolean(runtimeStatus?.route_ready);
  const workerReady = Boolean(runtimeStatus?.worker_ready);
  const boxedLaneReady = Boolean(runtimeStatus?.boxed_lane_ready);
  const brainstemLifecycle = String(brainstem?.lifecycle || "")
    .trim()
    .toLowerCase();

  const issues = [];
  const issueGroups = [];
  const recoveryActions = [];
  const whatStillWorks = [];
  const addIssue = (group, title, message, action) => {
    issues.push(message);
    issueGroups.push({ group, title, message, action });
    if (action) recoveryActions.push(action);
  };

  if (!activeProfile && !onboardingCompleted) {
    addIssue(
      "profile",
      "BOSS profile",
      "No BOSS profile is active yet.",
      "Create a new BOSS profile or choose an existing one before normal chat unlocks.",
    );
  }
  if (!onboardingCompleted) {
    addIssue(
      "profile",
      "Setup progress",
      `Setup is still in progress for ${profileName}.`,
      "Resume onboarding from the saved profile state.",
    );
  }
  if (onboardingCompleted && !routeReady) {
    addIssue(
      "runtime",
      "Chat route",
      runtimeStatus?.route_status_label || "The selected route is not runnable yet.",
      runtimeStatus?.next_step || "Finish runtime recovery before chat unlocks.",
    );
  }
  if (onboarding?.modelPref !== "commercial" && !workerReady) {
    addIssue(
      "model",
      "Local model",
      runtimeStatus?.worker_status_label || "The local worker still needs attention.",
      "Choose or install a managed local model for this BOSS profile.",
    );
  }
  if (!boxedLaneReady) {
    addIssue(
      "sandbox",
      "Boxed lane",
      diagnostics?.boxed_lane_ready === false
        ? "The boxed execution lane still needs provisioning."
        : "The boxed execution lane has not been verified yet.",
      runtimeStatus?.next_step ||
        "Finish boxed-lane preparation before risky work can be promoted.",
    );
  }
  if (brainstemLifecycle === "waiting_for_approval") {
    addIssue(
      "approval",
      "Guarded approval",
      "Guarded identity changes are waiting for approval before BIOS AI continues.",
      "Review the pending guarded identity changes.",
    );
  }
  if (brainstemLifecycle === "recovering" && brainstem?.summary) {
    addIssue(
      "runtime",
      "Recovery",
      brainstem.summary,
      "Let BIOS AI complete recovery, then retry.",
    );
  }

  if (activeProfile || onboardingCompleted) {
    whatStillWorks.push(`${profileName}'s saved BOSS profile can still be inspected.`);
  }
  if (routeReady) {
    whatStillWorks.push("The main chat route is available.");
  }
  if (workerReady) {
    whatStillWorks.push("The selected local worker is reachable.");
  }
  if (boxedLaneReady) {
    whatStillWorks.push("The boxed execution lane is ready for sandbox-first work.");
  }
  if (!whatStillWorks.length) {
    whatStillWorks.push("BIOS AI can still guide setup and show recovery steps.");
  }

  let headline = `${profileName} is ready`;
  let recoveryLabel = "No recovery work needed.";
  let summary = `${profileName} has a saved BOSS profile and the current BIOS AI route is available.`;

  if (brainstemLifecycle === "waiting_for_approval") {
    headline = `${profileName} is waiting for approval`;
    recoveryLabel = "Review the pending guarded identity changes.";
    summary =
      brainstem?.summary ||
      `${profileName} is paused until the operator decides whether those guarded soul changes should become canonical.`;
  } else if (brainstemLifecycle === "consolidating" || brainstemLifecycle === "dreaming") {
    headline = `${profileName} is consolidating memory`;
    recoveryLabel = "Let BIOS AI finish the current dream cycle.";
    summary =
      brainstem?.summary ||
      `${profileName} is folding recent memory into durable long-term recall.`;
  } else if (!onboardingCompleted || brainstemLifecycle === "onboarding") {
    headline = `${profileName} setup needs to resume`;
    recoveryLabel = "Resume onboarding from the saved profile state.";
    summary = `${profileName} already has saved BIOS-only state, but onboarding still needs to finish before normal chat should be trusted.`;
  } else if (brainstemLifecycle === "recovering" || !routeReady) {
    headline = `${profileName} needs route recovery`;
    recoveryLabel = runtimeStatus?.next_step || "Finish runtime recovery before chat unlocks.";
    summary = brainstem?.summary
      ? `${brainstem.summary} ${recoveryLabel}`.trim()
      : runtimeStatus?.route_detail
        ? `${runtimeStatus.route_detail} ${recoveryLabel}`.trim()
        : `${profileName} has saved state, but the active route still needs recovery before first chat.`;
  } else if (!boxedLaneReady) {
    headline = `${profileName} is usable, but hardening still needs attention`;
    recoveryLabel = runtimeStatus?.next_step || "Finish boxed-lane preparation.";
    summary =
      "The main route is usable, but BIOS AI still needs the boxed lane fully healthy before the full sandbox-first posture is complete.";
  }

  return {
    headline,
    recoveryLabel,
    summary,
    issues,
    issueGroups,
    recoveryActions: [...new Set(recoveryActions)],
    whatStillWorks,
    supportSummary: buildDiagnosticsSupportSummary({
      profileName,
      issues,
      routeReady,
      workerReady,
      boxedLaneReady,
      debugLogPath: diagnostics?.debug_log_path || runtimeStatus?.debug_log_path || "Unavailable",
    }),
    debugLogPath: diagnostics?.debug_log_path || runtimeStatus?.debug_log_path || "Unavailable",
  };
}

export function buildDiagnosticsSupportSummary({
  profileName,
  issues,
  routeReady,
  workerReady,
  boxedLaneReady,
}) {
  const issueCount = Array.isArray(issues) ? issues.length : 0;
  const readiness = [
    routeReady ? "route ready" : "route blocked",
    workerReady ? "worker ready" : "worker not ready",
    boxedLaneReady ? "boxed lane ready" : "boxed lane not ready",
  ].join(", ");
  return `${profileName}: ${issueCount} active recovery item(s); ${readiness}. Support details stay in the Log surface.`;
}

export function renderDiagnosticsIssueGroups(issueGroups, escapeHtml) {
  const groups = Array.isArray(issueGroups) ? issueGroups : [];
  if (groups.length === 0) {
    return '<p class="setting-note">No active BIOS AI recovery issues.</p>';
  }
  return groups
    .map((issue) => {
      const title = escapeHtml(issue?.title || issue?.group || "Recovery item");
      const message = escapeHtml(issue?.message || "BIOS AI needs attention.");
      const action = issue?.action
        ? `<p class="setting-note" style="margin: 6px 0 0;">Next: ${escapeHtml(issue.action)}</p>`
        : "";
      return `<div class="settings-mini-card"><strong>${title}</strong><p class="setting-note" style="margin: 6px 0 0;">${message}</p>${action}</div>`;
    })
    .join("");
}

export function renderDiagnosticsActionList(actions, escapeHtml) {
  const uniqueActions = [...new Set(Array.isArray(actions) ? actions.filter(Boolean) : [])];
  if (uniqueActions.length === 0) {
    return '<p class="setting-note">No recovery action is needed right now.</p>';
  }
  return `<ol class="settings-action-list">${uniqueActions
    .map((action) => `<li>${escapeHtml(action)}</li>`)
    .join("")}</ol>`;
}

export function renderDiagnosticsStillWorksList(items, escapeHtml) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safeItems.length === 0) {
    return '<p class="setting-note">BIOS AI can still show setup and recovery guidance.</p>';
  }
  return `<ul class="settings-action-list">${safeItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}
