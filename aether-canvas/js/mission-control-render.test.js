import { describe, expect, it } from "vitest";
import { renderMissionOperatorWorkSection } from "./mission-control-render.js";

describe("mission-control-render", () => {
  it("renders a live operator work section from an operator record", () => {
    const markup = renderMissionOperatorWorkSection({
      stepLabel: "Browser click blocked",
      summary: "Capture 1280x1024 (Desktop 2). Inputs: Email Address. Buttons: Retry Verify.",
      recoveryPlan: 'Could not locate target "#email" in visually introspected layout.',
      evidence: [
        "Target: BIOS AI Dashboard (chrome)",
        "Observation: Capture 1280x1024 (Desktop 2). Inputs: Email Address. Buttons: Retry Verify.",
        "Screenshot: recovery.png",
      ],
      residualRisk: ['Could not locate target "#email" in visually introspected layout.'],
    });

    expect(markup).toContain("Browser click blocked");
    expect(markup).toContain("Capture 1280x1024 (Desktop 2). Inputs: Email Address. Buttons: Retry Verify.");
    expect(markup).toContain("Recovery:");
    expect(markup).toContain("Visible targets");
    expect(markup).toContain("BIOS AI Dashboard (chrome)");
    expect(markup).toContain("Screenshot: recovery.png");
    expect(markup).toContain("Residual risk");
  });

  it("renders an empty-state message when no operator record is present", () => {
    const markup = renderMissionOperatorWorkSection(null);

    expect(markup).toContain("No live operator work captured yet.");
  });
});