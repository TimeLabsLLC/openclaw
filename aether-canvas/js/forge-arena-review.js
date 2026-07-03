function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function formatTimestamp(value) {
  const numeric = asNumber(value, 0);
  if (!numeric) {
    return "Awaiting review timestamp";
  }
  return new Date(numeric).toLocaleString();
}

function formatDelta(value) {
  const numeric = asNumber(value, 0);
  return numeric > 0 ? `+${numeric}` : `${numeric}`;
}

function createTextNode(tagName, text, className = "") {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  node.textContent = text;
  return node;
}

export function formatArenaRunRatingAdjustment(value) {
  const numeric = asNumber(value, 0);
  return numeric > 0 ? `+${numeric}` : `${numeric}`;
}

export function resolveArenaRunChallengeContext(run = {}) {
  const pairedChallengeId = asString(run.pairedChallengeId);
  const pairedChallengeTitle = asString(run.pairedChallengeTitle);
  const pairedChallengeStatus = asString(run.pairedChallengeStatus, asString(run.challengeStatus, "open"));
  if (pairedChallengeId || pairedChallengeTitle) {
    return {
      id: pairedChallengeId || asString(run.challengeId),
      title: pairedChallengeTitle || asString(run.challengeTitle, "Paired challenge"),
      status: pairedChallengeStatus,
      kind: "paired",
    };
  }

  const challengeId = asString(run.challengeId);
  const challengeTitle = asString(run.challengeTitle);
  if (challengeId || challengeTitle) {
    return {
      id: challengeId,
      title: challengeTitle || "Linked challenge",
      status: asString(run.challengeStatus, "open"),
      kind: "linked",
    };
  }

  return null;
}

export function summarizeArenaRunForReview(run = {}) {
  const challenge = resolveArenaRunChallengeContext(run);
  const rating = asNumber(run.rating, 0);
  const ratingAdjustment = asNumber(run.ratingAdjustment, 0);
  const resultCount = asNumber(run.resultCount, 0);
  const latestVerdict = asString(run.lastJudgement, "pending");
  const latestReviewCategory = asString(run.lastReviewCategory, latestVerdict === "pending" ? "awaiting review" : "breakthrough");
  const reviewSummary =
    asString(run.reviewSummary) ||
    asString(run.lastJudgementSummary) ||
    asString(run.detail) ||
    asString(run.summary) ||
    "Awaiting reviewed outcomes.";

  return {
    id: asString(run.id),
    title: asString(run.title, "Unknown run"),
    status: asString(run.status, "Tracked"),
    sessionKey: asString(run.sessionKey),
    updatedAtLabel: formatTimestamp(run.updatedAt),
    reviewedAtLabel: asNumber(run.lastJudgedAt, 0) ? formatTimestamp(run.lastJudgedAt) : "No judged result yet",
    challenge,
    latestVerdict,
    latestReviewCategory,
    resultCount,
    reviewSummary,
    comparisonSummary: asString(run.comparisonSummary),
    recentResults: asArray(run.recentResults)
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        recordedAt: asNumber(entry.recordedAt, 0),
        challengeId: asString(entry.challengeId),
        challengeTitle: asString(entry.challengeTitle, "Unknown challenge"),
        verdict: asString(entry.verdict, "hold"),
        reviewCategory: asString(entry.reviewCategory, "breakthrough"),
        scoreDelta: asNumber(entry.scoreDelta, 0),
        ratingDelta: asNumber(entry.ratingDelta, 0),
        scoreAfter: asNumber(entry.scoreAfter, 0),
        summary: asString(entry.summary),
      })),
    metrics: [
      `Score ${asNumber(run.score, 0)}`,
      `Rating ${rating}`,
      `Adj ${formatArenaRunRatingAdjustment(ratingAdjustment)}`,
      `${resultCount} result${resultCount === 1 ? "" : "s"}`,
    ],
  };
}

function resolveChallengeForRun(run = {}, challenges = []) {
  const runChallenge = resolveArenaRunChallengeContext(run);
  if (!runChallenge?.id) {
    return null;
  }
  return (
    asArray(challenges).find((challenge) => challenge && typeof challenge === "object" && asString(challenge.id) === runChallenge.id) ||
    null
  );
}

export function summarizeArenaRunReviewDetail(run = {}, { challenges = [] } = {}) {
  const summary = summarizeArenaRunForReview(run);
  const challenge = resolveChallengeForRun(run, challenges);
  const standings = asArray(challenge?.standings)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      rank: index + 1,
      runId: asString(entry.runId),
      runTitle: asString(entry.runTitle, "Unknown run"),
      score: asNumber(entry.score, 0),
      rating: asNumber(entry.rating, 0),
      deltaFromLeader: asNumber(entry.deltaFromLeader, 0),
      resultCount: asNumber(entry.resultCount, 0),
      latestVerdict: asString(entry.latestVerdict, "hold"),
      latestReviewCategory: asString(entry.latestReviewCategory, "breakthrough"),
      lastReviewedAtLabel: formatTimestamp(entry.lastReviewedAt),
      summary: asString(entry.summary),
    }));

  return {
    ...summary,
    challengeMeta: challenge
      ? {
          id: asString(challenge.id),
          title: asString(challenge.title, summary.challenge?.title || "Challenge"),
          status: asString(challenge.status, summary.challenge?.status || "open"),
          leaderSummary: asString(challenge.leaderSummary),
          standingsSummary: asString(challenge.standingsSummary),
          pairedRunId: asString(challenge.pairedRunId),
        }
      : summary.challenge,
    standings,
  };
}

function createBadge(text, modifier = "") {
  const badge = document.createElement("span");
  badge.className = `forge-arena-badge${modifier ? ` forge-arena-badge--${modifier}` : ""}`;
  badge.textContent = text;
  return badge;
}

function createActionButton(label, onClick, modifier = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `forge-arena-inline-button${modifier === "primary" ? "" : " forge-arena-inline-button--secondary"}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

export function renderArenaRunReviewList(
  container,
  { runs = [], selectedRunId = "", onSelectRun, onInspectChallenge } = {},
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const normalizedRuns = asArray(runs)
    .filter((run) => run && typeof run === "object")
    .map((run) => summarizeArenaRunForReview(run));

  if (!normalizedRuns.length) {
    const empty = document.createElement("li");
    empty.textContent = "Visible runs and result summaries will appear here once arena.get returns runs[].";
    container.appendChild(empty);
    return;
  }

  normalizedRuns.forEach((run) => {
    const item = document.createElement("li");
    item.className = "forge-arena-run-review-item";
    if (run.id && run.id === selectedRunId) {
      item.classList.add("is-selected");
    }

    const title = document.createElement("strong");
    title.textContent = run.title;
    item.appendChild(title);

    const badgeRow = document.createElement("div");
    badgeRow.className = "forge-arena-run-badge-row";
    badgeRow.appendChild(createBadge(String(run.status || "Tracked").toUpperCase(), "status"));

    if (run.challenge) {
      const challengeLabel = `${run.challenge.kind === "paired" ? "PAIRED" : "LINKED"} · ${run.challenge.title} · ${String(run.challenge.status || "open").toUpperCase()}`;
      badgeRow.appendChild(createBadge(challengeLabel, run.challenge.kind === "paired" ? "paired" : "linked"));
    }

    if (run.latestVerdict && run.latestVerdict !== "pending") {
      badgeRow.appendChild(createBadge(`VERDICT · ${String(run.latestVerdict).toUpperCase()}`, "verdict"));
    }
    if (run.latestReviewCategory && run.latestReviewCategory !== "awaiting review") {
      badgeRow.appendChild(createBadge(`REVIEW · ${String(run.latestReviewCategory).toUpperCase()}`, "review"));
    }
    item.appendChild(badgeRow);

    const meta = document.createElement("span");
    meta.className = "forge-arena-list-meta";
    meta.textContent = `${run.sessionKey ? `Session ${run.sessionKey} · ` : ""}Updated ${run.updatedAtLabel} · Reviewed ${run.reviewedAtLabel}`;
    item.appendChild(meta);

    const detail = document.createElement("p");
    detail.className = "forge-arena-list-detail";
    detail.textContent = run.reviewSummary;
    item.appendChild(detail);

    const metrics = document.createElement("div");
    metrics.className = "forge-arena-run-metrics";
    run.metrics.forEach((metric) => {
      const chip = document.createElement("span");
      chip.className = "forge-arena-stat-chip";
      chip.textContent = metric;
      metrics.appendChild(chip);
    });
    item.appendChild(metrics);

    const actions = document.createElement("div");
    actions.className = "forge-arena-run-actions";
    actions.appendChild(
      createActionButton("Use for pairing", () => {
        if (typeof onSelectRun === "function") {
          onSelectRun(run.id);
        }
      }, "primary"),
    );
    if (run.challenge?.id) {
      actions.appendChild(
        createActionButton("Inspect challenge", () => {
          if (typeof onInspectChallenge === "function") {
            onInspectChallenge(run.challenge.id);
          }
        }),
      );
    }
    item.appendChild(actions);

    container.appendChild(item);
  });
}

export function renderArenaRunReviewDetail(
  container,
  { run = null, challenges = [], onSelectRun, onInspectChallenge } = {},
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!run || typeof run !== "object") {
    container.appendChild(
      createTextNode("p", "Select a visible run to inspect pairing context, leader summaries, standings, and recent judged results.", "forge-arena-list-detail"),
    );
    return;
  }

  const detail = summarizeArenaRunReviewDetail(run, { challenges });

  const header = document.createElement("div");
  header.className = "forge-arena-run-review-detail-header";
  header.appendChild(createTextNode("strong", detail.title));
  header.appendChild(
    createTextNode(
      "span",
      `${detail.sessionKey ? `Session ${detail.sessionKey} · ` : ""}Updated ${detail.updatedAtLabel} · Reviewed ${detail.reviewedAtLabel}`,
      "forge-arena-list-meta",
    ),
  );
  container.appendChild(header);

  const badgeRow = document.createElement("div");
  badgeRow.className = "forge-arena-run-badge-row";
  badgeRow.appendChild(createBadge(String(detail.status || "Tracked").toUpperCase(), "status"));
  if (detail.challengeMeta?.title) {
    const kind = detail.challenge?.kind === "paired" ? "paired" : detail.challenge?.kind === "linked" ? "linked" : "status";
    const prefix = detail.challenge?.kind === "paired" ? "PAIRED" : detail.challenge?.kind === "linked" ? "LINKED" : "CHALLENGE";
    badgeRow.appendChild(
      createBadge(
        `${prefix} · ${detail.challengeMeta.title} · ${String(detail.challengeMeta.status || "open").toUpperCase()}`,
        kind,
      ),
    );
  }
  if (detail.latestVerdict && detail.latestVerdict !== "pending") {
    badgeRow.appendChild(createBadge(`VERDICT · ${String(detail.latestVerdict).toUpperCase()}`, "verdict"));
  }
  if (detail.latestReviewCategory && detail.latestReviewCategory !== "awaiting review") {
    badgeRow.appendChild(createBadge(`REVIEW · ${String(detail.latestReviewCategory).toUpperCase()}`, "review"));
  }
  container.appendChild(badgeRow);

  const metrics = document.createElement("div");
  metrics.className = "forge-arena-run-metrics";
  detail.metrics.forEach((metric) => {
    metrics.appendChild(createTextNode("span", metric, "forge-arena-stat-chip"));
  });
  container.appendChild(metrics);

  container.appendChild(createTextNode("p", detail.reviewSummary, "forge-arena-list-detail"));

  if (detail.comparisonSummary) {
    const comparison = document.createElement("div");
    comparison.className = "forge-arena-review-note";
    comparison.appendChild(createTextNode("span", "Comparison"));
    comparison.appendChild(createTextNode("p", detail.comparisonSummary));
    container.appendChild(comparison);
  }

  if (detail.challengeMeta?.leaderSummary || detail.challengeMeta?.standingsSummary) {
    const challengeSummary = document.createElement("div");
    challengeSummary.className = "forge-arena-review-note";
    challengeSummary.appendChild(createTextNode("span", "Challenge review context"));
    if (detail.challengeMeta?.leaderSummary) {
      challengeSummary.appendChild(createTextNode("p", detail.challengeMeta.leaderSummary));
    }
    if (detail.challengeMeta?.standingsSummary) {
      challengeSummary.appendChild(createTextNode("p", detail.challengeMeta.standingsSummary));
    }
    container.appendChild(challengeSummary);
  }

  const actions = document.createElement("div");
  actions.className = "forge-arena-run-actions";
  actions.appendChild(
    createActionButton("Reuse for pairing", () => {
      if (typeof onSelectRun === "function") {
        onSelectRun(detail.id);
      }
    }, "primary"),
  );
  if (detail.challengeMeta?.id) {
    actions.appendChild(
      createActionButton("Inspect paired challenge", () => {
        if (typeof onInspectChallenge === "function") {
          onInspectChallenge(detail.challengeMeta.id);
        }
      }),
    );
  }
  container.appendChild(actions);

  const standingsSection = document.createElement("section");
  standingsSection.className = "forge-arena-review-section";
  standingsSection.appendChild(createTextNode("h4", "Challenge standings"));
  const standingsList = document.createElement("ul");
  standingsList.className = "forge-arena-review-sublist";
  if (!detail.standings.length) {
    standingsList.appendChild(
      createTextNode(
        "li",
        detail.challengeMeta?.pairedRunId
          ? "This run is paired, but the challenge has no reviewed standings rows yet."
          : "No challenge standings rows are available for this run yet.",
      ),
    );
  } else {
    detail.standings.slice(0, 3).forEach((entry) => {
      const item = document.createElement("li");
      const title = createTextNode(
        "strong",
        `#${entry.rank} ${entry.runTitle} · ${entry.score} pts · rating ${entry.rating}`,
      );
      const meta = createTextNode(
        "span",
        `${entry.deltaFromLeader === 0 ? "Current leader" : `${entry.deltaFromLeader} behind leader`} · ${String(entry.latestVerdict).toUpperCase()} · ${String(entry.latestReviewCategory).toUpperCase()} · ${entry.resultCount} review${entry.resultCount === 1 ? "" : "s"}`,
        "forge-arena-list-meta",
      );
      const summary = createTextNode("p", entry.summary || `Reviewed ${entry.lastReviewedAtLabel}.`, "forge-arena-list-detail");
      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(summary);
      standingsList.appendChild(item);
    });
  }
  standingsSection.appendChild(standingsList);
  container.appendChild(standingsSection);

  const resultsSection = document.createElement("section");
  resultsSection.className = "forge-arena-review-section";
  resultsSection.appendChild(createTextNode("h4", "Recent judged results"));
  const resultsList = document.createElement("ul");
  resultsList.className = "forge-arena-review-sublist";
  if (!detail.recentResults.length) {
    resultsList.appendChild(createTextNode("li", "No recent reviewed outcomes are recorded for this run yet."));
  } else {
    detail.recentResults.forEach((entry) => {
      const item = document.createElement("li");
      item.appendChild(
        createTextNode(
          "strong",
          `${entry.challengeTitle} · ${String(entry.verdict).toUpperCase()} ${formatDelta(entry.scoreDelta)} · ${String(entry.reviewCategory).toUpperCase()}`,
        ),
      );
      item.appendChild(
        createTextNode(
          "span",
          `${formatTimestamp(entry.recordedAt)} · score ${entry.scoreAfter} · rating ${formatDelta(entry.ratingDelta)}`,
          "forge-arena-list-meta",
        ),
      );
      item.appendChild(createTextNode("p", entry.summary || "Result recorded.", "forge-arena-list-detail"));
      resultsList.appendChild(item);
    });
  }
  resultsSection.appendChild(resultsList);
  container.appendChild(resultsSection);
}
