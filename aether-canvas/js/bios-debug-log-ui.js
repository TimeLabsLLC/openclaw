export function buildDebugLogMetaLabel(runtimeStatus) {
  return runtimeStatus?.debug_log_path
    ? `Runtime log: ${runtimeStatus.debug_log_path}`
    : "Runtime log path unavailable.";
}

export function collectDebugLogLines(logText) {
  return String(logText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-200)
    .reverse();
}

export function parseDebugLogEvent(line) {
  if (!line) return null;
  try {
    const entry = JSON.parse(line);
    return typeof entry === "object" && entry ? entry : null;
  } catch {
    return null;
  }
}

export function buildDebugLogSupportSummary(logText, runtimeStatus = null) {
  const lines = collectDebugLogLines(logText);
  const latest = parseDebugLogEvent(lines[0]);
  const latestLabel = latest?.event ? `Latest event: ${latest.event}.` : "No latest event yet.";
  const routeLabel = runtimeStatus?.route_status_label || runtimeStatus?.route_label || null;
  const route = routeLabel ? ` Route: ${routeLabel}.` : "";
  return `Showing ${lines.length} recent log entr${lines.length === 1 ? "y" : "ies"}. ${latestLabel}${route}`;
}

export function renderDebugLogLine(line, escapeHtml) {
  try {
    const entry = parseDebugLogEvent(line);
    if (!entry) throw new Error("plain text log line");
    const ts = entry?.ts ? new Date(Number(entry.ts)).toLocaleString() : "Unknown time";
    const details = entry?.details ? escapeHtml(String(entry.details)) : "";
    return `<div class="chat-bubble chat-bubble-agent" style="margin-bottom: 8px;"><p style="font-size: 11px; color: #4fd1c5; margin: 0 0 4px;">${escapeHtml(ts)} - ${escapeHtml(entry?.event || "event")}</p><p style="font-size: 11px; color: #a0aec0; margin: 0; white-space: pre-wrap;">${details || "No details"}</p></div>`;
  } catch {
    return `<div class="chat-bubble chat-bubble-agent" style="margin-bottom: 8px;"><p style="font-size: 11px; color: #a0aec0; margin: 0; white-space: pre-wrap;">${escapeHtml(line)}</p></div>`;
  }
}

export function renderDebugLogStream(logText, escapeHtml) {
  const lines = collectDebugLogLines(logText);
  if (lines.length === 0) {
    return '<p class="ctx-empty">No BIOS runtime log entries yet.</p>';
  }
  return lines.map((line) => renderDebugLogLine(line, escapeHtml)).join("");
}
