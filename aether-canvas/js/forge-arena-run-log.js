function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseDetails(details) {
  if (!details) return {};
  if (typeof details === "object") return details;
  try {
    const parsed = JSON.parse(String(details));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { detail: String(details) };
  }
}

function parseLogLine(line) {
  try {
    const parsed = JSON.parse(String(line || ""));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function newer(left, right) {
  return asNumber(left?.ts, 0) >= asNumber(right?.ts, 0) ? left : right;
}

export function summarizeForgeArenaOvernightLog(logText = "") {
  const records = String(logText || "")
    .split(/\r?\n/)
    .map((line) => parseLogLine(line.trim()))
    .filter(Boolean)
    .filter((entry) => String(entry.event || "").startsWith("major_boss_overnight."));

  if (!records.length) {
    return {
      state: "empty",
      title: "No overnight field run recorded yet",
      progressLabel: "0/50 scenarios",
      progressPercent: 0,
      detail: "Run Overnight Arena to create the first durable field-run log.",
      runId: "",
      completedScenarios: 0,
      totalScenarios: 50,
      batchIndex: 0,
      latestEvent: "",
      recordHash: "",
      source: "debug-log",
    };
  }

  let latestProgress = null;
  let latestCompleted = null;
  let latestBlocked = null;

  for (const record of records) {
    const event = String(record.event || "");
    const details = parseDetails(record.details);
    const enriched = { ...record, parsedDetails: details };
    if (event === "major_boss_overnight.progress") {
      latestProgress = latestProgress ? newer(latestProgress, enriched) : enriched;
    } else if (event === "major_boss_overnight.completed") {
      latestCompleted = latestCompleted ? newer(latestCompleted, enriched) : enriched;
    } else if (event === "major_boss_overnight.blocked") {
      latestBlocked = latestBlocked ? newer(latestBlocked, enriched) : enriched;
    }
  }

  const latest = records.reduce((current, entry) => newer(current, entry), records[0]);
  const source = latestCompleted || latestProgress || latestBlocked || latest;
  const details = source.parsedDetails || parseDetails(source.details);
  const blockedDetails = latestBlocked?.parsedDetails || {};
  const runId =
    details.runId ||
    latestProgress?.parsedDetails?.runId ||
    latestCompleted?.parsedDetails?.runId ||
    "";
  const completedScenarios = asNumber(
    details.completedScenarios,
    asNumber(latestProgress?.parsedDetails?.completedScenarios, asNumber(details.scenarioCount, 0)),
  );
  const totalScenarios = asNumber(
    details.totalScenarios,
    asNumber(latestProgress?.parsedDetails?.totalScenarios, asNumber(details.scenarioCount, 50)),
  );
  const progressPercent = totalScenarios
    ? Math.max(0, Math.min(100, Math.round((completedScenarios / totalScenarios) * 100)))
    : 0;
  const batchIndex = asNumber(
    details.batchIndex,
    asNumber(latestProgress?.parsedDetails?.batchIndex, asNumber(details.batchCount, 0)),
  );
  const blockedAfterProgress =
    latestBlocked &&
    (!latestProgress || asNumber(latestBlocked.ts, 0) >= asNumber(latestProgress.ts, 0));
  const completedAfterProgress =
    latestCompleted &&
    (!latestProgress || asNumber(latestCompleted.ts, 0) >= asNumber(latestProgress.ts, 0));

  if (completedAfterProgress) {
    return {
      state: "complete",
      title: "Overnight field run completed",
      progressLabel: `${asNumber(details.scenarioCount, completedScenarios)}/${totalScenarios} scenarios`,
      progressPercent: 100,
      detail: `${details.status || "completed"} with ${asNumber(details.judgedArtifacts, 0)} judged artifact(s), ${asNumber(details.contextSleepCount, 0)} context sleep(s), and ${asNumber(details.thermalSampleCount, 0)} thermal sample(s).`,
      runId,
      completedScenarios: asNumber(details.scenarioCount, completedScenarios),
      totalScenarios,
      batchIndex,
      latestEvent: "major_boss_overnight.completed",
      recordHash: latestCompleted.record_hash || "",
      source: "debug-log",
    };
  }

  if (blockedAfterProgress) {
    return {
      state: completedScenarios > 0 ? "partial" : "blocked",
      title: completedScenarios > 0 ? "Partial overnight field run" : "Overnight field run blocked",
      progressLabel: `${completedScenarios}/${totalScenarios} scenarios`,
      progressPercent,
      detail:
        blockedDetails.detail ||
        "The run stopped before completion. If the machine lost power, this is a partial field record rather than a completed run.",
      runId,
      completedScenarios,
      totalScenarios,
      batchIndex,
      latestEvent: "major_boss_overnight.blocked",
      recordHash: latestBlocked.record_hash || "",
      source: "debug-log",
    };
  }

  return {
    state: "running-or-interrupted",
    title:
      completedScenarios > 0
        ? "Overnight field run in progress or interrupted"
        : "Overnight field run started",
    progressLabel: `${completedScenarios}/${totalScenarios} scenarios`,
    progressPercent,
    detail:
      details.status === "cooldown"
        ? `Batch ${batchIndex} cooldown recorded. If BIOS AI is not still running, treat this as an interrupted partial run.`
        : `Batch ${batchIndex} progress recorded. If BIOS AI is not still running, treat this as an interrupted partial run.`,
    runId,
    completedScenarios,
    totalScenarios,
    batchIndex,
    latestEvent: "major_boss_overnight.progress",
    recordHash: latestProgress?.record_hash || "",
    source: "debug-log",
  };
}
