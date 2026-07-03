/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import {
  formatArenaRunRatingAdjustment,
  renderArenaRunReviewDetail,
  renderArenaRunReviewList,
  resolveArenaRunChallengeContext,
  summarizeArenaRunForReview,
  summarizeArenaRunReviewDetail,
} from "./forge-arena-review.js";

describe("forge-arena-review", () => {
  it("prefers paired challenge context when available", () => {
    expect(
      resolveArenaRunChallengeContext({
        challengeId: "challenge-linked",
        challengeTitle: "Linked challenge",
        challengeStatus: "live",
        pairedChallengeId: "challenge-paired",
        pairedChallengeTitle: "Paired challenge",
        pairedChallengeStatus: "judging",
      }),
    ).toEqual({
      id: "challenge-paired",
      title: "Paired challenge",
      status: "judging",
      kind: "paired",
    });
  });

  it("summarizes run review context with rating and result metrics", () => {
    const summary = summarizeArenaRunForReview({
      id: "run-1",
      title: "Forge lane",
      status: "Live",
      score: 18,
      rating: 1042,
      ratingAdjustment: 12,
      resultCount: 3,
      lastJudgement: "promote",
      lastReviewCategory: "quality",
      reviewSummary: "Promoted after stable challenge results.",
      pairedChallengeId: "challenge-1",
      pairedChallengeTitle: "Build sprint",
      pairedChallengeStatus: "judging",
      updatedAt: 1710000000000,
      lastJudgedAt: 1710000005000,
    });

    expect(summary.challenge).toMatchObject({
      id: "challenge-1",
      title: "Build sprint",
      kind: "paired",
    });
    expect(summary.metrics).toEqual(["Score 18", "Rating 1042", "Adj +12", "3 results"]);
    expect(summary.reviewSummary).toContain("Promoted");
  });

  it("builds run detail summaries with challenge standings and recent results", () => {
    const detail = summarizeArenaRunReviewDetail(
      {
        id: "run-1",
        sessionKey: "agent:main:alpha",
        title: "Alpha lane",
        status: "Live",
        score: 97,
        rating: 2050,
        ratingAdjustment: 11,
        resultCount: 2,
        lastJudgement: "promote",
        lastReviewCategory: "quality",
        reviewSummary: "Promoted after strong BIOS AI delivery.",
        comparisonSummary: "Alpha lane currently leads Dual Lane Ladder.",
        pairedChallengeId: "challenge-1",
        pairedChallengeTitle: "Dual Lane Ladder",
        pairedChallengeStatus: "judging",
        updatedAt: 1710000000000,
        lastJudgedAt: 1710000001000,
        recentResults: [
          {
            recordedAt: 1710000001000,
            challengeId: "challenge-1",
            challengeTitle: "Dual Lane Ladder",
            verdict: "promote",
            reviewCategory: "quality",
            scoreDelta: 11,
            ratingDelta: 11,
            scoreAfter: 97,
            summary: "Alpha lane landed the stronger BIOS AI delivery.",
          },
        ],
      },
      {
        challenges: [
          {
            id: "challenge-1",
            title: "Dual Lane Ladder",
            status: "judging",
            leaderSummary: "Alpha lane leads Dual Lane Ladder at 97 points after 2 reviewed outcomes.",
            standingsSummary: "Alpha lane leads Beta lane by 6 points.",
            pairedRunId: "run-1",
            standings: [
              {
                runId: "run-1",
                runTitle: "Alpha lane",
                score: 97,
                rating: 2050,
                deltaFromLeader: 0,
                resultCount: 2,
                latestVerdict: "promote",
                latestReviewCategory: "quality",
                lastReviewedAt: 1710000001000,
                summary: "Alpha lane promote +11 (quality).",
              },
              {
                runId: "run-2",
                runTitle: "Beta lane",
                score: 91,
                rating: 1988,
                deltaFromLeader: 6,
                resultCount: 2,
                latestVerdict: "hold",
                latestReviewCategory: "consistency",
                lastReviewedAt: 1710000000000,
                summary: "Beta lane hold +4 (consistency).",
              },
            ],
          },
        ],
      },
    );

    expect(detail.challengeMeta).toEqual(
      expect.objectContaining({
        id: "challenge-1",
        title: "Dual Lane Ladder",
        leaderSummary: expect.stringContaining("Alpha lane leads"),
        standingsSummary: expect.stringContaining("Beta lane"),
      }),
    );
    expect(detail.standings).toHaveLength(2);
    expect(detail.recentResults[0]).toEqual(
      expect.objectContaining({
        challengeTitle: "Dual Lane Ladder",
        verdict: "promote",
        scoreDelta: 11,
      }),
    );
  });

  it("renders run review rows and wires select/inspect actions", () => {
    document.body.innerHTML = '<ul id="runs"></ul>';
    const container = document.getElementById("runs");
    const onSelectRun = vi.fn();
    const onInspectChallenge = vi.fn();

    renderArenaRunReviewList(container, {
      selectedRunId: "run-1",
      onSelectRun,
      onInspectChallenge,
      runs: [
        {
          id: "run-1",
          title: "Arena champion",
          status: "Live",
          score: 21,
          rating: 1105,
          ratingAdjustment: -3,
          resultCount: 2,
          lastJudgement: "hold",
          lastReviewCategory: "consistency",
          reviewSummary: "Holding after second review pass.",
          pairedChallengeId: "challenge-1",
          pairedChallengeTitle: "Challenge one",
          pairedChallengeStatus: "judging",
          updatedAt: 1710000000000,
          lastJudgedAt: 1710000001000,
        },
      ],
    });

    expect(container?.textContent).toContain("Arena champion");
    expect(container?.textContent).toContain("PAIRED · Challenge one · JUDGING");
    expect(container?.textContent).toContain("Adj -3");
    expect(container?.querySelector(".forge-arena-run-review-item")?.classList.contains("is-selected")).toBe(true);

    const [selectButton, inspectButton] = Array.from(container?.querySelectorAll("button") || []);
    selectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    inspectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onSelectRun).toHaveBeenCalledWith("run-1");
    expect(onInspectChallenge).toHaveBeenCalledWith("challenge-1");
  });

  it("renders a page-native run detail review surface", () => {
    document.body.innerHTML = '<div id="detail"></div>';
    const container = document.getElementById("detail");
    const onSelectRun = vi.fn();
    const onInspectChallenge = vi.fn();

    renderArenaRunReviewDetail(container, {
      onSelectRun,
      onInspectChallenge,
      run: {
        id: "run-1",
        sessionKey: "agent:main:alpha",
        title: "Alpha lane",
        status: "Live",
        score: 97,
        rating: 2050,
        ratingAdjustment: 11,
        resultCount: 2,
        lastJudgement: "promote",
        lastReviewCategory: "quality",
        reviewSummary: "Promoted after strong BIOS AI delivery.",
        comparisonSummary: "Alpha lane currently leads Dual Lane Ladder.",
        pairedChallengeId: "challenge-1",
        pairedChallengeTitle: "Dual Lane Ladder",
        pairedChallengeStatus: "judging",
        updatedAt: 1710000000000,
        lastJudgedAt: 1710000001000,
        recentResults: [
          {
            recordedAt: 1710000001000,
            challengeId: "challenge-1",
            challengeTitle: "Dual Lane Ladder",
            verdict: "promote",
            reviewCategory: "quality",
            scoreDelta: 11,
            ratingDelta: 11,
            scoreAfter: 97,
            summary: "Alpha lane landed the stronger BIOS AI delivery.",
          },
        ],
      },
      challenges: [
        {
          id: "challenge-1",
          title: "Dual Lane Ladder",
          status: "judging",
          leaderSummary: "Alpha lane leads Dual Lane Ladder at 97 points after 2 reviewed outcomes.",
          standingsSummary: "Alpha lane leads Beta lane by 6 points.",
          pairedRunId: "run-1",
          standings: [
            {
              runId: "run-1",
              runTitle: "Alpha lane",
              score: 97,
              rating: 2050,
              deltaFromLeader: 0,
              resultCount: 2,
              latestVerdict: "promote",
              latestReviewCategory: "quality",
              lastReviewedAt: 1710000001000,
              summary: "Alpha lane promote +11 (quality).",
            },
          ],
        },
      ],
    });

    expect(container?.textContent).toContain("Alpha lane currently leads Dual Lane Ladder.");
    expect(container?.textContent).toContain("Challenge review context");
    expect(container?.textContent).toContain("Recent judged results");
    expect(container?.textContent).toContain("Dual Lane Ladder · PROMOTE +11 · QUALITY");

    const [reuseButton, inspectButton] = Array.from(container?.querySelectorAll("button") || []);
    reuseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    inspectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onSelectRun).toHaveBeenCalledWith("run-1");
    expect(onInspectChallenge).toHaveBeenCalledWith("challenge-1");
  });

  it("formats rating adjustments with explicit sign", () => {
    expect(formatArenaRunRatingAdjustment(0)).toBe("0");
    expect(formatArenaRunRatingAdjustment(9)).toBe("+9");
    expect(formatArenaRunRatingAdjustment(-4)).toBe("-4");
  });
});
