import { describe, expect, it } from "vitest";
import { buildViewportIdleSnapshot } from "./bios-viewport-ui.js";

describe("buildViewportIdleSnapshot", () => {
  it("applies defaults for an empty snapshot", () => {
    expect(buildViewportIdleSnapshot(null)).toEqual({
      kicker: "BIOS Home",
      title: "Local workspace ready",
      profileLabel: "BOSS: waiting",
      routeLabel: "Route: waiting",
      safetyLabel: "Safety: waiting",
      authorityLabel: "Authority: ask first",
      bodyStateLabel: "Workspace ready",
      hostInterruptionPolicy: "Computer changes stay paused until protected work is ready.",
      userControlLabel: "Computer control is paused.",
      viewportTitle: "BIOS Home",
      readinessLabel: "Waiting for route",
      workerLabel: "No BOSS runtime yet",
      nextActionLabel: "Finish setup on the left before the first chat.",
      nextBodyAction: "Finish setup or send work to activate protected work.",
      supportLabel: "Logs and recovery details stay visible in Settings and Log.",
      note: "Finish setup on the left. BIOS AI will keep protected defaults active.",
    });
  });

  it("preserves provided snapshot values", () => {
    expect(
      buildViewportIdleSnapshot({
        kicker: "Command deck",
        title: "Finish setup",
        profileLabel: "BOSS: Claw",
        routeLabel: "Route: hybrid",
        safetyLabel: "Safety: LXC-first hardened",
        authorityLabel: "Authority: broad",
        bodyStateLabel: "Body: private body active",
        hostInterruptionPolicy: "User desktop interruption blocked by default",
        userControlLabel: "Take control is available.",
        viewportTitle: "https://example.com/workbench",
        readinessLabel: "Cloud and local ready",
        workerLabel: "Managed worker ready",
        nextActionLabel: "You can start chatting now.",
        nextBodyAction: "Watch the private body work here.",
        supportLabel: "Runtime logs are available in Settings.",
        note: "Install a worker.",
      }),
    ).toEqual({
      kicker: "Command deck",
      title: "Finish setup",
      profileLabel: "BOSS: Claw",
      routeLabel: "Route: hybrid",
      safetyLabel: "Safety: LXC-first hardened",
      authorityLabel: "Authority: broad",
      bodyStateLabel: "Body: private body active",
      hostInterruptionPolicy: "User desktop interruption blocked by default",
      userControlLabel: "Take control is available.",
      viewportTitle: "https://example.com/workbench",
      readinessLabel: "Cloud and local ready",
      workerLabel: "Managed worker ready",
      nextActionLabel: "You can start chatting now.",
      nextBodyAction: "Watch the private body work here.",
      supportLabel: "Runtime logs are available in Settings.",
      note: "Install a worker.",
    });
  });
});
