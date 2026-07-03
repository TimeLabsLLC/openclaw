export function buildMissionControlSnapshot({
  mission,
  continuity,
  formatContinuityLabel,
}) {
  const continuityLabel = continuity ? formatContinuityLabel(continuity.lifecycle) : "unknown";
  const continuityRecovery = continuity
    ? formatContinuityLabel(continuity.recoveryAction)
    : "none";
  const continuitySummary = continuity?.summary || "Continuity snapshot not loaded yet.";
  const pendingApproval = continuity?.blockedByApproval ? mission.operatorRecord?.approval || null : null;
  const continuityTone =
    continuity?.health === "stale"
      ? "var(--danger)"
      : continuity?.health === "needs_review"
        ? "var(--warning)"
        : "var(--accent)";

  return {
    continuityLabel,
    continuityRecovery,
    continuitySummary,
    pendingApproval,
    continuityTone,
  };
}
