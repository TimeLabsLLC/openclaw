function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStringList(items, emptyText, icon) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p style="font-size: 10px; color: var(--text-dim); font-style: italic; margin: 0;">${escapeHtml(emptyText)}</p>`;
  }

  return items
    .map(
      (item) => `
        <div style="font-size: 9px; line-height: 1.4; color: var(--text-secondary); background: rgba(59,130,246,0.06); padding: 4px 8px; border: 1px solid rgba(59,130,246,0.12); border-radius: var(--radius-sm);">
          ${icon} ${escapeHtml(item)}
        </div>
      `,
    )
    .join("");
}

function partitionOperatorEvidence(items) {
  const evidenceItems = Array.isArray(items) ? items : [];
  const targetItems = [];
  const nonTargetItems = [];

  for (const item of evidenceItems) {
    if (typeof item === "string" && item.startsWith("Target: ")) {
      targetItems.push(item.replace(/^Target:\s*/, ""));
      continue;
    }
    nonTargetItems.push(item);
  }

  return { targetItems, nonTargetItems };
}

export function renderMissionOperatorWorkSection(operatorRecord) {
  if (!operatorRecord) {
    return `
      <p style="font-size: 10px; color: var(--text-dim); font-style: italic; margin-top: 6px;">
        No live operator work captured yet.
      </p>
    `;
  }

  const { targetItems, nonTargetItems } = partitionOperatorEvidence(operatorRecord.evidence);
  const evidenceItems = nonTargetItems.slice(-3);
  const residualRisk = Array.isArray(operatorRecord.residualRisk)
    ? operatorRecord.residualRisk.slice(0, 2)
    : [];
  const stepLabel = operatorRecord.stepLabel || "Live operator work";
  const summary = operatorRecord.summary || "Operator work record is active.";
  const recoveryPlan = operatorRecord.recoveryPlan || null;

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <span style="font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em;">${escapeHtml(stepLabel)}</span>
        <span class="tool-card-badge" style="background: rgba(59,130,246,0.12); color: var(--accent); padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">operator</span>
      </div>
      <p style="font-size: 10px; color: var(--text-muted); line-height: 1.45; margin: 0;">${escapeHtml(summary)}</p>
      ${recoveryPlan ? `<div style="font-size: 9px; color: var(--warning); line-height: 1.4; background: rgba(245,158,11,0.08); padding: 6px 8px; border: 1px solid rgba(245,158,11,0.16); border-radius: var(--radius-sm);">Recovery: ${escapeHtml(recoveryPlan)}</div>` : ""}
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 9px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em;">Visible targets</div>
        ${renderStringList(targetItems, "No visible targets captured.", "🪟")}
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 9px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em;">Recent evidence</div>
        ${renderStringList(evidenceItems, "No operator evidence captured.", "📄")}
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 9px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em;">Residual risk</div>
        ${renderStringList(residualRisk, "No residual risk recorded.", "⚠️")}
      </div>
    </div>
  `;
}