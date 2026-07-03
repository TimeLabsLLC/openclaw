export function buildBoxedLaneRenderSnapshot(contract, options = {}) {
  const boxedLane = contract?.boxed_lane || null;
  const promotion = contract?.promotion || null;
  const sandboxState = contract?.sandbox_state || null;
  const diagnostics = contract?.diagnostics || null;
  const runtime = contract?.runtime || null;
  const profileName = options.profileName || contract?.profile?.display_name || "waiting";

  if (!boxedLane || !promotion) {
    return {
      sandboxHealthLabel: "Waiting on setup check",
      workerShellLabel: "Waiting on onboarding",
      promotionGateLabel: "Waiting on setup check",
      boxedLaneStateLabel: "Waiting on setup check",
      boxedLaneSubstrateLabel: "Waiting on setup check",
      boxedLaneSummary: "BIOS AI will show protected workspace readiness here.",
      safetySummaryLabel: "Waiting on onboarding",
      queueSummaryLabel: "No protected work pending",
      latestDecisionLabel: "No protected work decision yet",
      latestEventLabel: "No protected work event yet",
      queueItems: [],
      queueLifecycleSummary: "No protected work has started yet",
      statusOverviewTitle: "BIOS AI still needs setup",
      statusOverviewCopy:
        "Your BOSS profile, model route, and protected workspace will summarize here once setup is ready.",
    };
  }

  const routeLabel = runtime?.route_mode_label || "Not configured";
  const isReady = boxedLane.substrate_ready && boxedLane.worker_lane_ready;
  const provisioning = boxedLane.provisioning || {};
  const productLabel = provisioning.backend || boxedLane.backend || "Protected workspace";
  const adapterLabel = provisioning.adapter_label || provisioning.substrate_label || "";
  const proofState = provisioning.proof_state || "unknown";
  const repairState = provisioning.repair_state || "";
  const repairSummary =
    provisioning.last_repair_summary || provisioning.background_repair_label || "";
  const rebootNote = provisioning.requires_reboot
    ? " Windows may need a restart before BIOS AI can finish verification."
    : "";
  const proofCopy = isReady
    ? `Protected workspace check: ${proofState}.`
    : `${repairSummary}${rebootNote}`.trim();

  const queueItems = reconcileQueueItemsForCurrentReadiness(sandboxState?.queue || [], isReady);

  return {
    sandboxHealthLabel: toCustomerProtectedWorkCopy(boxedLane.state_label),
    workerShellLabel: boxedLane.worker_status_label,
    promotionGateLabel: toCustomerProtectedWorkCopy(promotion.state_label),
    boxedLaneStateLabel: toCustomerProtectedWorkCopy(boxedLane.state_label),
    boxedLaneSubstrateLabel: toCustomerProtectedWorkCopy(boxedLane.substrate_label),
    boxedLaneSummary: toCustomerProtectedWorkCopy([boxedLane.note, proofCopy].filter(Boolean).join(" ")),
    safetySummaryLabel: toCustomerProtectedWorkCopy(promotion.summary),
    queueSummaryLabel: toCustomerProtectedWorkCopy(
      sandboxState?.queue_summary || "No protected work pending",
    ),
    latestDecisionLabel:
      toCustomerProtectedWorkCopy(
        sandboxState?.latest_decision_label || "No protected work decision yet",
      ),
    latestEventLabel: toCustomerProtectedWorkCopy(
      sandboxState?.latest_event_label || "No protected work event yet",
    ),
    queueItems,
    queueLifecycleSummary: buildQueueLifecycleSummary(queueItems),
    statusOverviewTitle: isReady
      ? "BIOS AI protected workspace is ready"
      : "BIOS AI is still setting up protected work",
    statusOverviewCopy: toCustomerProtectedWorkCopy(
      `${boxedLane.safety_summary} BOSS: ${profileName}. Route: ${routeLabel}. Protected workspace: ${productLabel}${adapterLabel ? ` via ${adapterLabel}` : ""}. Status: ${promotion.state_label}. Repair: ${repairState || "idle"}. Queue: ${sandboxState?.queue_summary || "no queue yet"}.`,
    ),
  };
}

export function toCustomerProtectedWorkCopy(value) {
  return String(value ?? "")
    .replace(/boxed-lane/gi, "protected workspace")
    .replace(/boxed lane/gi, "protected workspace")
    .replace(/boxed execution substrate/gi, "protected workspace")
    .replace(/boxed substrate/gi, "protected workspace")
    .replace(/boxed proof/gi, "protected workspace check")
    .replace(/boxed work/gi, "protected work")
    .replace(/boxed artifact/gi, "protected item")
    .replace(/host adoption/gi, "computer changes")
    .replace(/host writes/gi, "computer changes")
    .replace(/host promotion/gi, "computer changes")
    .replace(/promotion gate/gi, "protected-work check")
    .replace(/promotion required/gi, "approval required")
    .replace(/promotion/gi, "approval")
    .replace(/substrate/gi, "workspace")
    .replace(/native shell contract/gi, "app setup check")
    .replace(/runtime audit/gi, "setup check");
}

function reconcileQueueItemsForCurrentReadiness(items, isReady) {
  if (!isReady) {
    return items;
  }
  return items.map((item) => {
    if (!/blocked|rejected/i.test(item?.state || "")) {
      return item;
    }
    return {
      ...item,
      state: "historical_blocked",
      lifecycle_stage_label: "Past blocked record",
      host_access_label: "Current protected workspace is ready; this record is history",
      promotion_action_label: "No current action required unless this specific artifact is retried",
      detail:
        "This blocked record happened before the current protected workspace check. BIOS AI keeps it as history, not current readiness.",
    };
  });
}

function buildQueueLifecycleSummary(items) {
  if (!items.length) {
    return "No protected work has started yet";
  }
  const historical = items.filter((item) => /historical_blocked/i.test(item.state || "")).length;
  const blocked = items.filter(
    (item) =>
      /blocked|rejected/i.test(item.state || "") && !/historical_blocked/i.test(item.state || ""),
  ).length;
  const approved = items.filter((item) => /approved|completed/i.test(item.state || "")).length;
  const pending = items.filter((item) => /pending|validated/i.test(item.state || "")).length;
  const historicalCopy = historical ? `, ${historical} past blocked` : "";
  return `${items.length} recent protected item${items.length === 1 ? "" : "s"}: ${approved} approved, ${blocked} currently blocked${historicalCopy}, ${pending} waiting or checked.`;
}
