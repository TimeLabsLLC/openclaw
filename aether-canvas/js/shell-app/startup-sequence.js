import { describeBootstrapAction } from "../app-action-feedback.js";

export async function runInitialShellHydrationSequence(app) {
  app.setConnectOverlayMessage(describeBootstrapAction("connected", { agentName: app.agentName }));

  const runStep = async (step, fn) => {
    app.setConnectOverlayMessage(describeBootstrapAction("hydrate-step", { step }));
    await fn();
  };

  await runStep("conversation history", () => app.loadSessionHistory());
  await runStep("mission state", () => app.loadSessionMission());
  await runStep("Forge Arena", () => app.refreshForgeArenaFeed({ connected: true }));
  await runStep("onboarding state", () => app.loadOnboardingState());
  await runStep("brainstem lifecycle", () => app.tickBiosBrainstem());
  await runStep("BIOS runtime", () => app.loadBiosRuntimeStatus({ tickBrainstem: false }));
  await runStep("BIOS debug log", () => app.loadDebugLog());
  await runStep("continuity", () => app.loadContinuityHealth());
  await runStep("memory", () => app.loadMemorySurface());
  await runStep("token economy", () => app.loadTokenEconomy());
  await runStep("restart recovery", () => app.loadRestartRecovery());
  await runStep("browser sandbox", () => app.loadBrowserSandboxStatus());
  await runStep("circadian state", () => app.loadCircadianState());
  await runStep("compaction health", () => app.loadCompactionHealth());

  const overlay = document.getElementById("connect-overlay");
  if (overlay) overlay.classList.add("hidden");
  app.showConnectionStatusBar(
    describeBootstrapAction("ready", { agentName: app.agentName }),
    "success",
  );
  setTimeout(() => app.hideConnectionStatusBar(), 2500);
}
