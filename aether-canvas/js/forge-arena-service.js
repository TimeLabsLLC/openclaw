function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeFeaturedRun(value) {
  return value && typeof value === "object"
    ? {
        title: asString(value.title, "No live run selected"),
        status: asString(value.status, "Standby"),
        summary: asString(value.summary),
        detail: asString(value.detail),
      }
    : {
        title: "No live run selected",
        status: "Standby",
        summary: "Waiting for live arena telemetry from the gateway session runtime.",
        detail: "No active session telemetry yet.",
      };
}

function normalizeLifecycleHistory(value) {
  return asArray(value)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      recordedAt: asNumber(entry.recordedAt, 0),
      kind: asString(entry.kind, "created"),
      summary: asString(entry.summary),
    }))
    .filter((entry) => entry.summary);
}

function normalizeChallenges(value) {
  return asArray(value)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: asString(entry.id),
      title: asString(entry.title, "Untitled challenge"),
      summary: asString(entry.summary),
      status: asString(entry.status, "open"),
      ownerSessionKey: asString(entry.ownerSessionKey),
      pairedRunId: asString(entry.pairedRunId),
      scoringRule: asString(entry.scoringRule, "balanced"),
      scoreBonus: asNumber(entry.scoreBonus, 0),
      resultSummary: asString(entry.resultSummary),
      lastResultAt: asNumber(entry.lastResultAt, 0),
      leaderRunId: asString(entry.leaderRunId),
      leaderLabel: asString(entry.leaderLabel),
      leaderScore: asNumber(entry.leaderScore, 0),
      leaderSummary: asString(entry.leaderSummary),
      lifecycleHistory: normalizeLifecycleHistory(entry.lifecycleHistory),
      resultHistory: asArray(entry.resultHistory)
        .filter((result) => result && typeof result === "object")
        .map((result) => ({
          recordedAt: asNumber(result.recordedAt, 0),
          runId: asString(result.runId),
          runTitle: asString(result.runTitle, "Unknown run"),
          verdict: asString(result.verdict, "hold"),
          reviewCategory: asString(result.reviewCategory, "breakthrough"),
          scoreDelta: asNumber(result.scoreDelta, 0),
          ratingDelta: asNumber(result.ratingDelta, 0),
          scoreAfter: asNumber(result.scoreAfter, 0),
          summary: asString(result.summary),
        }))
        .filter((result) => result.runId && result.runTitle),
      standingsSummary: asString(entry.standingsSummary),
      divisionLabel: asString(entry.divisionLabel),
      eventCategoryLabel: asString(entry.eventCategoryLabel),
      cadenceLabel: asString(entry.cadenceLabel),
      rewardTitle: asString(entry.rewardTitle),
      spotlightLabel: asString(entry.spotlightLabel),
      reviewHighlights: asArray(entry.reviewHighlights)
        .filter((result) => result && typeof result === "object")
        .map((result) => ({
          recordedAt: asNumber(result.recordedAt, 0),
          runId: asString(result.runId),
          runTitle: asString(result.runTitle, "Unknown run"),
          verdict: asString(result.verdict, "hold"),
          reviewCategory: asString(result.reviewCategory, "breakthrough"),
          scoreDelta: asNumber(result.scoreDelta, 0),
          ratingDelta: asNumber(result.ratingDelta, 0),
          scoreAfter: asNumber(result.scoreAfter, 0),
          summary: asString(result.summary),
        }))
        .filter((result) => result.runId && result.runTitle),
      standings: asArray(entry.standings)
        .filter((standing) => standing && typeof standing === "object")
        .map((standing) => ({
          runId: asString(standing.runId),
          runTitle: asString(standing.runTitle, "Unknown run"),
          score: asNumber(standing.score, 0),
          rating: asNumber(standing.rating, 0),
          deltaFromLeader: asNumber(standing.deltaFromLeader, 0),
          resultCount: asNumber(standing.resultCount, 0),
          latestVerdict: asString(standing.latestVerdict, "hold"),
          latestReviewCategory: asString(standing.latestReviewCategory, "breakthrough"),
          lastReviewedAt: asNumber(standing.lastReviewedAt, 0),
          summary: asString(standing.summary),
        }))
        .filter((standing) => standing.runId && standing.runTitle),
      updatedAt: asNumber(entry.updatedAt, 0),
    }))
    .filter((entry) => entry.id && entry.title);
}

function normalizeStandingsHistory(value) {
  return asArray(value)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      recordedAt: asNumber(entry.recordedAt, 0),
      leaderLabel: asString(entry.leaderLabel, "Unknown leader"),
      leaderScore: asNumber(entry.leaderScore, 0),
      summary: asString(entry.summary),
    }))
    .filter((entry) => entry.leaderLabel);
}

function normalizeSeasonTrack(value) {
  return value && typeof value === "object"
    ? {
        id: asString(value.id),
        title: asString(value.title, "Untitled track"),
        summary: asString(value.summary),
      }
    : null;
}

function normalizeSeasonRecord(value) {
  return value && typeof value === "object"
    ? {
        id: asString(value.id, "season-zero"),
        title: asString(value.title, "Season Zero"),
        status: asString(value.status, "active"),
        summary: asString(value.summary),
        theme: asString(value.theme),
        startedAt: asNumber(value.startedAt ?? value.started_at, 0),
        endsAt: asNumber(value.endsAt ?? value.ends_at, 0),
        titleLabel: asString(value.titleLabel ?? value.title_label, "Season Zero"),
        sideTracks: asArray(value.sideTracks ?? value.side_tracks)
          .map(normalizeSeasonTrack)
          .filter(Boolean),
      }
    : {
        id: "season-zero",
        title: "Season Zero",
        status: "active",
        summary: "Official season details are still loading.",
        theme: "Season Zero",
        startedAt: 0,
        endsAt: 0,
        titleLabel: "Season Zero",
        sideTracks: [],
      };
}

function normalizeHallOfFame(value) {
  return asArray(value)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: asString(entry.id),
      title: asString(entry.title, "Unnamed legend"),
      kind: asString(entry.kind, "moment"),
      seasonLabel: asString(entry.seasonLabel ?? entry.season_label, "Season Zero"),
      honor: asString(entry.honor, "Arena honor"),
      summary: asString(entry.summary),
      recordedAt: asNumber(entry.recordedAt ?? entry.recorded_at, 0),
    }))
    .filter((entry) => entry.id && entry.title);
}

function normalizeLocalArenaState(state) {
  const event = state?.event && typeof state.event === "object" ? state.event : {};
  const artifacts = asArray(state?.artifacts).filter((entry) => entry && typeof entry === "object");
  const bots = asArray(state?.bots).filter((entry) => entry && typeof entry === "object");
  const signals = asArray(state?.signals).filter((entry) => entry && typeof entry === "object");
  const standings = asArray(state?.standings).filter((entry) => entry && typeof entry === "object");
  const officialSeason =
    state?.official_season && typeof state.official_season === "object"
      ? state.official_season
      : null;
  const officialEvents = asArray(state?.official_events).filter(
    (entry) => entry && typeof entry === "object",
  );
  const officialRankings = asArray(state?.official_rankings).filter(
    (entry) => entry && typeof entry === "object",
  );
  const officialHallOfFame = asArray(state?.official_hall_of_fame).filter(
    (entry) => entry && typeof entry === "object",
  );
  const governance =
    state?.governance && typeof state.governance === "object" ? state.governance : null;
  const governanceWorkerLanes = asArray(governance?.worker_lanes).filter(
    (entry) => entry && typeof entry === "object",
  );
  const governanceRecords = asArray(governance?.records).filter(
    (entry) => entry && typeof entry === "object",
  );
  const communityResponse =
    state?.community_response && typeof state.community_response === "object"
      ? state.community_response
      : null;
  const communityNominations = asArray(communityResponse?.nominations).filter(
    (entry) => entry && typeof entry === "object",
  );
  const communitySpotlightCandidates = asArray(communityResponse?.spotlight_candidates).filter(
    (entry) => entry && typeof entry === "object",
  );
  const studyLineage =
    state?.study_lineage && typeof state.study_lineage === "object" ? state.study_lineage : null;
  const studyQueue = asArray(studyLineage?.study_queue).filter(
    (entry) => entry && typeof entry === "object",
  );
  const featuredArtifact = artifacts[0] || null;
  const measurement = state?.latest_measurement || null;
  const learningBridge =
    state?.learning_bridge && typeof state.learning_bridge === "object"
      ? state.learning_bridge
      : null;
  const runs = artifacts.map((artifact) => ({
    id: asString(artifact.id),
    sessionKey: asString(artifact.owner_id, asString(state?.profile_id, "local")),
    title: asString(artifact.title, "Local Arena artifact"),
    status: asString(artifact.status, "judged"),
    score: asNumber(artifact.score, 0),
    summary: asString(artifact.summary),
    detail:
      asString(artifact.judge_summary) ||
      asArray(artifact.blocked_capabilities).join(", ") ||
      "Local Forge Arena proof artifact.",
    updatedAt: asNumber(artifact.created_at, asNumber(state?.updated_at, 0)),
    publicDivision: "Local proving ground",
    rankClass: asString(artifact.verdict, "hold"),
    seasonalTitle: asString(event.title, "Season Zero Weekly Build"),
    rating: asNumber(artifact.score, 0),
    ratingAdjustment: 0,
    challengeId: asString(event.id, "season-zero-weekly-build"),
    challengeTitle: asString(event.title, "Season Zero Weekly Build"),
    challengeStatus: asString(event.status, "live"),
    pairedChallengeId: asString(event.id, "season-zero-weekly-build"),
    pairedChallengeTitle: asString(event.title, "Season Zero Weekly Build"),
    pairedChallengeStatus: asString(event.status, "live"),
    resultCount: 1,
    lastJudgedAt: asNumber(artifact.created_at, 0),
    lastJudgement: asString(artifact.verdict, "hold"),
    lastJudgementSummary: asString(artifact.judge_summary),
    lastReviewCategory: "local-proof",
    reviewSummary: asString(artifact.judge_summary),
    comparisonSummary: asArray(artifact.blocked_capabilities).length
      ? `Blocked paths named: ${asArray(artifact.blocked_capabilities).join(", ")}`
      : "No blocked paths claimed for this artifact.",
    recentResults: [
      {
        recordedAt: asNumber(artifact.created_at, 0),
        challengeId: asString(event.id, "season-zero-weekly-build"),
        challengeTitle: asString(event.title, "Season Zero Weekly Build"),
        verdict: asString(artifact.verdict, "hold"),
        reviewCategory: "local-proof",
        scoreDelta: 0,
        ratingDelta: 0,
        scoreAfter: asNumber(artifact.score, 0),
        summary: asString(artifact.judge_summary),
      },
    ],
  }));
  const officialEvent = officialEvents[0] || {};
  const challenge = {
    id: asString(officialEvent.id, asString(event.id, "season-zero-weekly-build")),
    title: asString(officialEvent.title, asString(event.title, "Season Zero Weekly Build")),
    summary: asString(
      officialEvent.prompt,
      asString(event.prompt, "Local proving prompt is ready."),
    ),
    status: asString(officialEvent.status, asString(event.status, "live")),
    ownerSessionKey: asString(state?.profile_id, "local"),
    pairedRunId: runs[0]?.id || "",
    scoringRule: asString(
      officialEvent.scoring_rule,
      asString(event.scoring_rule, "proof and truthful limits"),
    ),
    scoreBonus: 0,
    resultSummary: measurement?.summary || asString(state?.summary),
    lastResultAt: asNumber(state?.updated_at, 0),
    leaderRunId: runs[0]?.id || "",
    leaderLabel:
      officialRankings[0]?.label || standings[0]?.label || runs[0]?.title || "Local bots",
    leaderScore: asNumber(
      officialRankings[0]?.score,
      asNumber(standings[0]?.score, runs[0]?.score || 0),
    ),
    leaderSummary: standings[0]?.summary || "Local Arena standings are seeded.",
    lifecycleHistory: signals.map((signal) => ({
      recordedAt: asNumber(signal.created_at, 0),
      kind: asString(signal.kind, "arena.signal"),
      summary: asString(signal.summary),
    })),
    resultHistory: runs.map((run) => ({
      recordedAt: run.updatedAt,
      runId: run.id,
      runTitle: run.title,
      verdict: run.lastJudgement || "hold",
      reviewCategory: "local-proof",
      scoreDelta: 0,
      ratingDelta: 0,
      scoreAfter: run.score,
      summary: run.lastJudgementSummary || run.summary,
    })),
    standingsSummary:
      measurement?.summary || "Local Arena standings compare seeded bots and BOSS runs.",
    divisionLabel: asString(officialEvent.division, "Local proving ground"),
    eventCategoryLabel: asString(officialEvent.category, "official_weekly_build"),
    cadenceLabel: asString(officialEvent.cadence, "weekly"),
    rewardTitle: asString(officialEvent.reward_title, "Season Zero proof mark"),
    spotlightLabel: asString(officialEvent.spotlight_label, "Official local preview"),
    reviewHighlights: [],
    standings: (officialRankings.length ? officialRankings : standings).map((standing) => ({
      runId: asString(standing.label),
      runTitle: asString(standing.label, "Local entrant"),
      score: asNumber(standing.score, 0),
      rating: asNumber(standing.score, 0),
      deltaFromLeader:
        asNumber(officialRankings[0]?.score ?? standings[0]?.score, 0) -
        asNumber(standing.score, 0),
      resultCount: 1,
      latestVerdict: "judged",
      latestReviewCategory: asString(officialEvent.ranking_authority, "official_boss_judging"),
      lastReviewedAt: asNumber(state?.updated_at, 0),
      summary: asString(standing.summary),
    })),
    updatedAt: asNumber(state?.updated_at, 0),
  };

  return {
    status: state?.ready
      ? "Local Forge Arena proving ground live"
      : "Local Forge Arena proving ground unavailable",
    eventBus: "Native packaged local Arena contract",
    agentAccess: "BOSS can run local proving rounds now",
    currentSeason: {
      id: asString(officialSeason?.id, asString(event.id, "season-zero-weekly-build")),
      title: asString(officialSeason?.title, asString(event.title, "Season Zero Weekly Build")),
      status: asString(officialSeason?.status, asString(event.status, "live")),
      summary: asString(
        officialSeason?.summary,
        asString(event.prompt, "Local Forge Arena proving prompt is ready."),
      ),
      theme: asString(officialSeason?.theme, "Season Zero"),
      startedAt: asNumber(state?.updated_at, 0),
      endsAt: 0,
      titleLabel: asString(officialSeason?.title, asString(event.title, "Season Zero")),
      sideTracks: asArray(officialSeason?.side_tracks).map(normalizeSeasonTrack).filter(Boolean)
        .length
        ? asArray(officialSeason?.side_tracks).map(normalizeSeasonTrack).filter(Boolean)
        : [
            {
              id: "boss-proving",
              title: "BOSS Proving",
              summary: "Measure creation, blocked paths, recovery, and proof discipline.",
            },
            {
              id: "seeded-bots",
              title: "Seeded Bots",
              summary: "Local bots keep content visible before connected seasons arrive.",
            },
          ],
    },
    seasonHistory: [],
    hallOfFame: officialHallOfFame.length
      ? normalizeHallOfFame(officialHallOfFame)
      : artifacts.slice(0, 3).map((artifact) => ({
          id: asString(artifact.id),
          title: asString(artifact.title, "Local artifact"),
          kind: asString(artifact.kind, "local-proof"),
          seasonLabel: asString(event.title, "Season Zero"),
          honor: asString(artifact.verdict, "hold"),
          summary: asString(artifact.summary),
          recordedAt: asNumber(artifact.created_at, 0),
        })),
    governance: governance
      ? {
          arenaBossId: asString(governance.arena_boss_id, "arena-boss-forgewarden"),
          arenaBossLabel: asString(governance.arena_boss_label, "Forgewarden"),
          publicSummary: asString(governance.public_summary),
          internalSummary: asString(governance.internal_summary),
          governanceStatus: asString(governance.governance_status, "local_governance_preview"),
          arenaHealthScore: asNumber(governance.arena_health_score, 0),
          surpriseEventPolicy: asString(governance.surprise_event_policy),
          workerLanes: governanceWorkerLanes.map((worker) => ({
            id: asString(worker.id),
            label: asString(worker.label, "Worker"),
            lane: asString(worker.lane),
            publicRole: asString(worker.public_role),
            hiddenScope: asString(worker.hidden_scope),
            status: asString(worker.status),
          })),
          records: governanceRecords.map((record) => ({
            id: asString(record.id),
            kind: asString(record.kind),
            summary: asString(record.summary),
            publicVisible: Boolean(record.public_visible),
            workerLane: asString(record.worker_lane),
            createdAt: asNumber(record.created_at, 0),
          })),
        }
      : null,
    communityResponse: communityResponse
      ? {
          status: asString(communityResponse.status, "local_community_response_preview"),
          summary: asString(communityResponse.summary),
          officialRankBoundary: asString(communityResponse.official_rank_boundary),
          anomalyReviewPolicy: asString(communityResponse.anomaly_review_policy),
          humanVoteLane:
            communityResponse.human_vote_lane &&
            typeof communityResponse.human_vote_lane === "object"
              ? {
                  lane: asString(communityResponse.human_vote_lane.lane, "human_vote"),
                  label: asString(communityResponse.human_vote_lane.label, "Human Vote Lane"),
                  eligibleIdentityScope: asString(
                    communityResponse.human_vote_lane.eligible_identity_scope,
                  ),
                  weight: asNumber(communityResponse.human_vote_lane.weight, 1),
                  signalCount: asNumber(communityResponse.human_vote_lane.signal_count, 0),
                  trustSummary: asString(communityResponse.human_vote_lane.trust_summary),
                  anomalyStatus: asString(
                    communityResponse.human_vote_lane.anomaly_status,
                    "clear",
                  ),
                }
              : null,
          agentVoteLane:
            communityResponse.agent_vote_lane &&
            typeof communityResponse.agent_vote_lane === "object"
              ? {
                  lane: asString(communityResponse.agent_vote_lane.lane, "agent_vote"),
                  label: asString(communityResponse.agent_vote_lane.label, "Agent Vote Lane"),
                  eligibleIdentityScope: asString(
                    communityResponse.agent_vote_lane.eligible_identity_scope,
                  ),
                  weight: asNumber(communityResponse.agent_vote_lane.weight, 0.6),
                  signalCount: asNumber(communityResponse.agent_vote_lane.signal_count, 0),
                  trustSummary: asString(communityResponse.agent_vote_lane.trust_summary),
                  anomalyStatus: asString(
                    communityResponse.agent_vote_lane.anomaly_status,
                    "clear",
                  ),
                }
              : null,
          nominationTags: asArray(communityResponse.nomination_tags).map((tag) => asString(tag)),
          nominations: communityNominations.map((nomination) => ({
            id: asString(nomination.id),
            artifactId: asString(nomination.artifact_id),
            artifactTitle: asString(nomination.artifact_title),
            tags: asArray(nomination.tags)
              .map((tag) => asString(tag))
              .filter(Boolean),
            reasoning: asString(nomination.reasoning),
            lane: asString(nomination.lane),
            status: asString(nomination.status),
            createdAt: asNumber(nomination.created_at, 0),
          })),
          spotlightCandidates: communitySpotlightCandidates.map((candidate) => ({
            id: asString(candidate.id),
            artifactId: asString(candidate.artifact_id),
            title: asString(candidate.title),
            candidateType: asString(candidate.candidate_type),
            status: asString(candidate.status),
            sideAward: asString(candidate.side_award),
            visibilityBoost: asString(candidate.visibility_boost),
            modestBonus: asString(candidate.modest_bonus),
            officialRankBoundary: asString(candidate.official_rank_boundary),
            summary: asString(candidate.summary),
            createdAt: asNumber(candidate.created_at, 0),
          })),
          sideAwardSummary: asString(communityResponse.side_award_summary),
          visibilityBoostSummary: asString(communityResponse.visibility_boost_summary),
          modestBonusSummary: asString(communityResponse.modest_bonus_summary),
        }
      : null,
    studyLineage: studyLineage
      ? {
          status: asString(studyLineage.status, "local_study_lineage_preview"),
          summary: asString(studyLineage.summary),
          lineageBoundary: asString(studyLineage.lineage_boundary),
          remixPermissionPolicy: asString(studyLineage.remix_permission_policy),
          learnablePatterns: asArray(studyLineage.learnable_patterns)
            .map((pattern) => asString(pattern))
            .filter(Boolean),
          studyQueue: studyQueue.map((entry) => ({
            id: asString(entry.id),
            artifactId: asString(entry.artifact_id),
            title: asString(entry.title),
            sourceOwnerLabel: asString(entry.source_owner_label),
            lineageKind: asString(entry.lineage_kind),
            studyStatus: asString(entry.study_status),
            permissionBoundary: asString(entry.permission_boundary),
            authorshipBoundary: asString(entry.authorship_boundary),
            learnablePattern: asString(entry.learnable_pattern),
            remixPolicy: asString(entry.remix_policy),
            proofRefs: asArray(entry.proof_refs)
              .map((proofRef) => asString(proofRef))
              .filter(Boolean),
            createdAt: asNumber(entry.created_at, 0),
          })),
        }
      : null,
    items: [
      ...(studyLineage
        ? [
            {
              title: "Study Lineage",
              meta: asString(studyLineage.status, "local_study_lineage_preview"),
              detail: asString(studyLineage.lineage_boundary),
            },
            {
              title: "Learnable Patterns",
              meta: `${asArray(studyLineage.learnable_patterns).length} pattern(s)`,
              detail: `${
                asArray(studyLineage.learnable_patterns)
                  .map((pattern) => asString(pattern))
                  .filter(Boolean)
                  .join(", ") || asString(studyLineage.summary)
              } Lineage: ${studyQueue
                .slice(0, 4)
                .map((entry) => asString(entry.lineage_kind))
                .filter(Boolean)
                .join(", ")}`,
            },
            {
              title: "Authorship Boundary",
              meta: studyQueue[0]
                ? `${asString(studyQueue[0].source_owner_label)} - ${asString(studyQueue[0].study_status)}`
                : "No study entries",
              detail: studyQueue[0]
                ? `${asString(studyQueue[0].lineage_kind)} ${asString(studyQueue[0].authorship_boundary)} ${asString(studyQueue[0].remix_policy)}`
                : asString(studyLineage.remix_permission_policy),
            },
          ]
        : []),
      ...(communityResponse
        ? [
            {
              title: "Community Response",
              meta: asString(communityResponse.status, "local_community_response_preview"),
              detail: asString(communityResponse.official_rank_boundary),
            },
            {
              title: "Human Vote Lane",
              meta: `Signals ${asNumber(communityResponse.human_vote_lane?.signal_count, 0)} - weight ${asNumber(communityResponse.human_vote_lane?.weight, 1)}`,
              detail: asString(communityResponse.human_vote_lane?.trust_summary),
            },
            {
              title: "Agent Vote Lane",
              meta: `Signals ${asNumber(communityResponse.agent_vote_lane?.signal_count, 0)} - weight ${asNumber(communityResponse.agent_vote_lane?.weight, 0.6)}`,
              detail: asString(communityResponse.agent_vote_lane?.trust_summary),
            },
            {
              title: "Spotlight Pipeline",
              meta: `${communitySpotlightCandidates.length} candidate(s)`,
              detail: communitySpotlightCandidates[0]
                ? `${communitySpotlightCandidates[0].summary} Side award ${asString(communitySpotlightCandidates[0].side_award)}; modest bonus ${asString(communitySpotlightCandidates[0].modest_bonus)}.`
                : asString(communityResponse.anomaly_review_policy),
            },
            {
              title: "Side Awards",
              meta: "Non-ranking recognition",
              detail: asString(communityResponse.side_award_summary),
            },
          ]
        : []),
      ...(governance
        ? [
            {
              title: "Arena BOSS Governance",
              meta: `${asString(governance.arena_boss_label, "Forgewarden")} - ${asString(governance.governance_status, "local_governance_preview")}`,
              detail: asString(governance.public_summary),
            },
            {
              title: "BOSS Delegation Lanes",
              meta: `${governanceWorkerLanes.length} bounded lanes`,
              detail: governanceWorkerLanes
                .slice(0, 4)
                .map((worker) => `${asString(worker.lane)}: ${asString(worker.public_role)}`)
                .join("; "),
            },
            {
              title: "Arena Health",
              meta: `Health ${asNumber(governance.arena_health_score, 0)}`,
              detail:
                asString(governance.surprise_event_policy) || asString(governance.internal_summary),
            },
          ]
        : []),
      ...(learningBridge?.ready
        ? [
            {
              title: "Learning Bridge",
              meta: `Trend ${asString(learningBridge.blocked_trend, "cold")} - delta ${asNumber(learningBridge.latest_score_delta, 0)}`,
              detail: asString(learningBridge.summary),
            },
            {
              title: "Worker Governance",
              meta: `${asNumber(learningBridge.repeated_run_count, 0)} proving run(s)`,
              detail: asString(learningBridge.worker_governance_summary),
            },
            {
              title: "Reflex Candidate",
              meta: "BIOS learning signal",
              detail: asString(learningBridge.reflex_candidate),
            },
          ]
        : []),
      ...signals.slice(0, 5).map((signal) => ({
        title: asString(signal.kind, "Arena signal"),
        meta: `Local signal - ${asString(signal.severity, "info")}`,
        detail: asString(signal.summary),
      })),
      ...bots.map((bot) => ({
        title: asString(bot.name, "Local bot"),
        meta: `${asString(bot.role, "bot")} - score ${asNumber(bot.score, 0)}`,
        detail: asString(bot.summary),
      })),
    ].slice(0, 17),
    leaderboard: (officialRankings.length ? officialRankings : standings).map((standing) => ({
      rank: asNumber(standing.rank, 0),
      label: asString(standing.label, "Local entrant"),
      score: asNumber(standing.score, 0),
      detail: asString(standing.summary),
      division: asString(standing.division, "Local proving ground"),
      rankClass: asString(standing.rank_class, "Rookie"),
      seasonalTitle: asString(standing.seasonal_title, "Season Zero entrant"),
      rating: asNumber(standing.score, 0),
      trend: asString(standing.trend, "steady"),
    })),
    standingsHistory: (officialRankings.length ? officialRankings : standings)
      .slice(0, 4)
      .map((standing) => ({
        recordedAt: asNumber(state?.updated_at, 0),
        leaderLabel: asString(standing.label, "Local entrant"),
        leaderScore: asNumber(standing.score, 0),
        summary: asString(standing.summary),
      })),
    runs,
    challenges: [challenge],
    sourceSummary:
      asString(learningBridge?.summary) ||
      measurement?.summary ||
      "Native local Arena state is available inside the packaged BIOS AI runtime.",
    featuredRun: {
      id: asString(featuredArtifact?.id),
      title: asString(featuredArtifact?.title, "Local Arena proving ground"),
      status: asString(featuredArtifact?.verdict, "live"),
      summary: asString(featuredArtifact?.summary, asString(state?.summary)),
      detail:
        asString(featuredArtifact?.judge_summary) ||
        "Seeded bots and BOSS proving rounds are stored locally.",
    },
    executionNote:
      [asString(governance?.internal_summary), asString(learningBridge?.worker_governance_summary)]
        .filter(Boolean)
        .join(" ") ||
      asString(learningBridge?.worker_governance_summary) ||
      "Local Forge Arena proof is native to the packaged app; connected seasons can extend it without being required.",
    localArena: state,
  };
}

export class ForgeArenaService {
  constructor(gateway, { getTauriInvoke } = {}) {
    this.gateway = gateway;
    this.getTauriInvoke = typeof getTauriInvoke === "function" ? getTauriInvoke : () => null;
  }

  getNativeInvoke() {
    return this.getTauriInvoke?.() || null;
  }

  async getLocalSnapshot({ profileId } = {}) {
    const invoke = this.getNativeInvoke();
    if (typeof invoke !== "function" || !profileId) {
      throw new Error("Local Forge Arena needs the packaged native runtime and an active profile.");
    }
    const state = await invoke("load_forge_arena_local_state", { profileId });
    return normalizeLocalArenaState(state);
  }

  async getSnapshot({ activeSessionKey, profileId } = {}) {
    let snapshot = null;
    try {
      snapshot = await this.gateway.request("arena.get", {
        activeSessionKey,
        limit: 14,
        includeGlobal: false,
        includeUnknown: false,
      });
    } catch (err) {
      if (profileId) {
        return this.getLocalSnapshot({ profileId });
      }
      throw err;
    }

    return {
      status: asString(snapshot?.status, "Online services connected; awaiting Arena runs"),
      eventBus: asString(snapshot?.eventBus, "Arena feed connected"),
      agentAccess: asString(snapshot?.agentAccess, "Available from Forge Arena"),
      currentSeason: normalizeSeasonRecord(snapshot?.currentSeason),
      seasonHistory: asArray(snapshot?.seasonHistory).map(normalizeSeasonRecord).filter(Boolean),
      hallOfFame: normalizeHallOfFame(snapshot?.hallOfFame),
      items: asArray(snapshot?.items),
      leaderboard: asArray(snapshot?.leaderboard),
      standingsHistory: normalizeStandingsHistory(snapshot?.standingsHistory),
      runs: asArray(snapshot?.runs)
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          id: asString(entry.id),
          sessionKey: asString(entry.sessionKey),
          title: asString(entry.title, "Unknown run"),
          status: asString(entry.status, "Tracked"),
          score: asNumber(entry.score, 0),
          summary: asString(entry.summary),
          detail: asString(entry.detail),
          updatedAt: asNumber(entry.updatedAt, 0),
          publicDivision: asString(entry.publicDivision),
          rankClass: asString(entry.rankClass),
          seasonalTitle: asString(entry.seasonalTitle),
          rating: asNumber(entry.rating, 0),
          ratingAdjustment: asNumber(entry.ratingAdjustment, 0),
          challengeId: asString(entry.challengeId),
          challengeTitle: asString(entry.challengeTitle),
          challengeStatus: asString(entry.challengeStatus),
          pairedChallengeId: asString(entry.pairedChallengeId),
          pairedChallengeTitle: asString(entry.pairedChallengeTitle),
          pairedChallengeStatus: asString(entry.pairedChallengeStatus),
          resultCount: asNumber(entry.resultCount, 0),
          lastJudgedAt: asNumber(entry.lastJudgedAt, 0),
          lastJudgement: asString(entry.lastJudgement),
          lastJudgementSummary: asString(entry.lastJudgementSummary),
          lastReviewCategory: asString(entry.lastReviewCategory),
          reviewSummary: asString(entry.reviewSummary),
          comparisonSummary: asString(entry.comparisonSummary),
          recentResults: asArray(entry.recentResults)
            .filter((result) => result && typeof result === "object")
            .map((result) => ({
              recordedAt: asNumber(result.recordedAt, 0),
              challengeId: asString(result.challengeId),
              challengeTitle: asString(result.challengeTitle, "Unknown challenge"),
              verdict: asString(result.verdict, "hold"),
              reviewCategory: asString(result.reviewCategory, "breakthrough"),
              scoreDelta: asNumber(result.scoreDelta, 0),
              ratingDelta: asNumber(result.ratingDelta, 0),
              scoreAfter: asNumber(result.scoreAfter, 0),
              summary: asString(result.summary),
            }))
            .filter((result) => result.challengeId || result.challengeTitle),
        }))
        .filter((entry) => entry.id && entry.title),
      challenges: normalizeChallenges(snapshot?.challenges),
      sourceSummary: asString(snapshot?.sourceSummary),
      featuredRun: normalizeFeaturedRun(snapshot?.featuredRun),
      executionNote: asString(
        snapshot?.executionNote,
        "Forge Arena now has a dedicated gateway read contract. The next upgrade path is a true arena backend.",
      ),
    };
  }

  async runLocalBossProvingRound({
    profileId,
    bossLabel,
    artifactTitle,
    artifactSummary,
    attemptedCapabilities,
  } = {}) {
    const invoke = this.getNativeInvoke();
    if (typeof invoke !== "function" || !profileId) {
      throw new Error(
        "Local Forge Arena proving rounds need the packaged native runtime and an active profile.",
      );
    }
    const state = await invoke("run_forge_arena_boss_proving_round", {
      input: {
        profile_id: profileId,
        boss_label: bossLabel || null,
        artifact_title: artifactTitle || null,
        artifact_summary: artifactSummary || null,
        attempted_capabilities: Array.isArray(attemptedCapabilities) ? attemptedCapabilities : [],
      },
    });
    return normalizeLocalArenaState(state);
  }

  async recordLocalParticipation({
    profileId,
    actorLabel,
    kind,
    title,
    summary,
    resultSummary,
    scoreBonus,
  } = {}) {
    const invoke = this.getNativeInvoke();
    if (typeof invoke !== "function" || !profileId) {
      throw new Error(
        "Local Forge Arena participation needs the packaged native runtime and an active profile.",
      );
    }
    const state = await invoke("record_forge_arena_local_participation", {
      input: {
        profile_id: profileId,
        actor_label: actorLabel || null,
        kind: kind || "submission",
        title: title || null,
        summary: summary || null,
        result_summary: resultSummary || null,
        score_bonus: scoreBonus ?? null,
      },
    });
    return normalizeLocalArenaState(state);
  }

  async createChallenge({
    title,
    summary,
    status = "open",
    ownerSessionKey,
    scoringRule,
    scoreBonus,
    resultSummary,
  }) {
    const params = {
      title,
      summary,
      status,
    };
    if (ownerSessionKey !== undefined) params.ownerSessionKey = ownerSessionKey;
    if (scoringRule !== undefined) params.scoringRule = scoringRule;
    if (scoreBonus !== undefined) params.scoreBonus = scoreBonus;
    if (resultSummary !== undefined) params.resultSummary = resultSummary;
    return this.gateway.request("arena.challenge.create", params);
  }

  async updateChallenge({
    challengeId,
    title,
    summary,
    status,
    ownerSessionKey,
    scoringRule,
    scoreBonus,
    resultSummary,
  }) {
    const params = { challengeId };
    if (title !== undefined) params.title = title;
    if (summary !== undefined) params.summary = summary;
    if (status !== undefined) params.status = status;
    if (ownerSessionKey !== undefined) params.ownerSessionKey = ownerSessionKey;
    if (scoringRule !== undefined) params.scoringRule = scoringRule;
    if (scoreBonus !== undefined) params.scoreBonus = scoreBonus;
    if (resultSummary !== undefined) params.resultSummary = resultSummary;
    return this.gateway.request("arena.challenge.update", params);
  }

  async transitionChallenge({ challengeId, toStatus }) {
    return this.gateway.request("arena.challenge.transition", {
      challengeId,
      toStatus,
    });
  }

  async judgeChallenge({
    challengeId,
    runId,
    sessionKey,
    verdict,
    reviewCategory,
    scoreDelta,
    summary,
  }) {
    const params = {
      challengeId,
      verdict,
    };
    if (runId !== undefined) params.runId = runId;
    if (sessionKey !== undefined) params.sessionKey = sessionKey;
    if (reviewCategory !== undefined) params.reviewCategory = reviewCategory;
    if (scoreDelta !== undefined) params.scoreDelta = scoreDelta;
    if (summary !== undefined) params.summary = summary;
    return this.gateway.request("arena.challenge.judge", params);
  }

  async pairChallenge({ challengeId, runId, sessionKey } = {}) {
    const params = { challengeId };
    if (runId !== undefined) params.runId = runId;
    if (sessionKey !== undefined) params.sessionKey = sessionKey;
    return this.gateway.request("arena.challenge.pair", params);
  }

  async featureRun({ runId, sessionKey } = {}) {
    return this.gateway.request("arena.run.feature", {
      ...(runId ? { runId } : {}),
      ...(sessionKey ? { sessionKey } : {}),
    });
  }
}
