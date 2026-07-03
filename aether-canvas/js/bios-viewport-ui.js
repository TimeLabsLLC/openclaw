export function buildViewportIdleSnapshot(snapshot) {
  return {
    kicker: snapshot?.kicker || "BIOS Home",
    title: snapshot?.title || "Local workspace ready",
    profileLabel: snapshot?.profileLabel || "BOSS: waiting",
    routeLabel: snapshot?.routeLabel || "Route: waiting",
    safetyLabel: snapshot?.safetyLabel || "Safety: waiting",
    authorityLabel: snapshot?.authorityLabel || "Authority: ask first",
    bodyStateLabel: snapshot?.bodyStateLabel || "Workspace ready",
    hostInterruptionPolicy:
      snapshot?.hostInterruptionPolicy ||
      "Computer changes stay paused until protected work is ready.",
    userControlLabel: snapshot?.userControlLabel || "Computer control is paused.",
    viewportTitle: snapshot?.viewportTitle || "BIOS Home",
    readinessLabel: snapshot?.readinessLabel || "Waiting for route",
    workerLabel: snapshot?.workerLabel || "No BOSS runtime yet",
    nextActionLabel: snapshot?.nextActionLabel || "Finish setup on the left before the first chat.",
    nextBodyAction: snapshot?.nextBodyAction || "Finish setup or send work to activate protected work.",
    supportLabel:
      snapshot?.supportLabel || "Logs and recovery details stay visible in Settings and Log.",
    note:
      snapshot?.note ||
      "Finish setup on the left. BIOS AI will keep protected defaults active.",
  };
}
