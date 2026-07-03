export function renderStatusOverviewCard(app) {
  const title = document.getElementById("status-overview-title");
  const copy = document.getElementById("status-overview-copy");
  if (!title || !copy) {
    return;
  }

  const boxedLane = app.biosShellContract?.boxed_lane || null;
  const promotion = app.biosShellContract?.promotion || null;
  const runtime = app.biosShellContract?.runtime || null;
  if (boxedLane && promotion) {
    const isReady = boxedLane.substrate_ready && boxedLane.worker_lane_ready;
    title.innerText = isReady
      ? "BIOS AI protected workspace is ready"
      : "BIOS AI is still setting up protected work";
    title.classList.toggle("status-overview-title-ready", isReady);
    copy.innerText = `${toCustomerStatusCopy(boxedLane.safety_summary)} BOSS: ${app.agentName}. Route: ${runtime?.route_mode_label || "Not configured"}. Status: ${toCustomerStatusCopy(promotion.state_label)}.`;
    return;
  }

  const gateway = document.getElementById("st-gateway")?.innerText || "Offline";
  const profile =
    document.getElementById("st-boss-profile")?.innerText || "Waiting on onboarding";
  const sandbox =
    document.getElementById("st-sandbox-health")?.innerText || "Waiting on setup check";
  const model = document.getElementById("st-model")?.innerText || "Not configured";

  const isReady =
    !/waiting|offline|not configured|needs|unavailable/i.test(
      `${gateway} ${profile} ${sandbox} ${model}`,
    );

  title.innerText = isReady
    ? "BIOS AI is ready for supervised work"
    : "BIOS AI still needs setup";
  title.classList.toggle("status-overview-title-ready", isReady);
  copy.innerText = `Online services: ${toCustomerStatusCopy(gateway)}. BOSS: ${profile}. Protected workspace: ${toCustomerStatusCopy(sandbox)}. Model route: ${model}.`;
}

function toCustomerStatusCopy(value) {
  return String(value ?? "")
    .replace(/promotion gated/gi, "status gated")
    .replace(/boxed-lane/gi, "protected workspace")
    .replace(/boxed lane/gi, "protected workspace")
    .replace(/host promotion/gi, "computer changes")
    .replace(/promotion gate/gi, "protected-work check")
    .replace(/promotion/gi, "status")
    .replace(/runtime audit/gi, "setup check")
    .replace(/substrate/gi, "workspace")
    .replace(/offline shell/gi, "offline");
}
