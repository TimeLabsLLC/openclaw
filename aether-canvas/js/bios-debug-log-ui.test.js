import { describe, expect, it } from "vitest";
import {
  buildDebugLogMetaLabel,
  buildDebugLogSupportSummary,
  collectDebugLogLines,
  parseDebugLogEvent,
  renderDebugLogLine,
  renderDebugLogStream,
} from "./bios-debug-log-ui.js";

describe("bios debug log ui helpers", () => {
  const escapeHtml = (value) =>
    String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  it("builds the runtime log meta label", () => {
    expect(buildDebugLogMetaLabel({ debug_log_path: "C:/bios/debug.log" })).toBe(
      "Runtime log: C:/bios/debug.log",
    );
    expect(buildDebugLogMetaLabel(null)).toBe("Runtime log path unavailable.");
  });

  it("collects the newest non-empty log lines in reverse order", () => {
    expect(collectDebugLogLines("one\n\n two \nthree")).toEqual(["three", "two", "one"]);
  });

  it("renders structured debug log lines", () => {
    const line = JSON.stringify({
      ts: 1710000000000,
      event: "onboarding.discovery.summary",
      details: "ready <yes>",
    });
    const html = renderDebugLogLine(line, escapeHtml);
    expect(html).toContain("onboarding.discovery.summary");
    expect(html).toContain("ready &lt;yes&gt;");
    expect(html).toBeTypeOf("string");
    expect(parseDebugLogEvent(line)?.event).toBe("onboarding.discovery.summary");
  });

  it("renders plain text fallback lines and empty streams", () => {
    expect(renderDebugLogLine("raw <line>", escapeHtml)).toContain("raw &lt;line&gt;");
    expect(renderDebugLogStream("", escapeHtml)).toContain("No BIOS runtime log entries yet.");
  });

  it("summarizes selectable support log details", () => {
    const line = JSON.stringify({
      ts: 1710000000000,
      event: "runtime.route.ready",
      details: "ready",
    });
    expect(
      buildDebugLogSupportSummary(line, {
        route_status_label: "Local route ready",
      }),
    ).toContain("Latest event: runtime.route.ready.");
    expect(buildDebugLogSupportSummary("", null)).toContain("No latest event yet.");
  });
});
