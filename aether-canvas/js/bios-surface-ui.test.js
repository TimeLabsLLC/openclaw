import { describe, expect, it } from "vitest";
import { buildBiosSurfaceSnapshot } from "./bios-surface-ui.js";

describe("buildBiosSurfaceSnapshot", () => {
  it("builds a unified biomimicry dashboard snapshot from BIOS contracts", () => {
    const snapshot = buildBiosSurfaceSnapshot({
      memory: {
        durable_memory_count: 12,
        total_events: 34,
        summary: "Memory is consolidating daily events into durable knowledge.",
        immediate_learning_ready: true,
        live_learning_count: 6,
        live_learning_summary:
          "6 live learning item(s) are usable now; 2 item(s) are queued for dream consolidation into durable memory.",
        latest_live_learning: "User prefers phase-complete updates.",
        schema_summary: "Schema online with timestamped memory classes.",
      },
      soul: {
        pending_changes: 2,
        summary: "Two guarded core-identity edits still need approval.",
      },
      dream: {
        durable_memory_count: 7,
        summary: "Dreaming completed a nightly consolidation pass.",
      },
      brainstem: {
        lifecycle: "route_ready",
        summary: "Brainstem is keeping route, recovery, and sleep timing aligned.",
      },
      circadian: {
        current_phase: "dreaming",
        phase_label: "Dreaming",
        summary: "Brainstem is allowing dream consolidation now.",
        queued_memory_promotions: 2,
        next_step: "Let BIOS AI finish its dream consolidation.",
      },
      glymphatic: {
        total_compactions: 3,
        pending_queue_count: 2,
        durable_memory_count: 7,
        cleanup_needed: true,
        summary: "BIOS has 2 queued memory promotion candidates waiting for glymphatic cleanup.",
        recommended_action: "Run the next dream cycle so queued memory can be consolidated.",
      },
      reflex: {
        skill_candidate_count: 3,
        hardened_skill_count: 4,
        summary: "Reflex learning has three candidates and four hardened skills.",
        schema_summary: "bios-shared-v1 reflex labels active",
        top_tag_label: "Skill candidate",
        top_evidence_label: "User approved",
        top_state_label: "Validating",
      },
      observation: {
        body_mode: "private_desktop_active",
        body_summary: "The private desktop is handling work without touching the user surface.",
      },
      nervousSystem: {
        total_signals: 9,
        coordination_state: "needs_attention",
        attention_signal_count: 2,
        latest_signal: "approval.requested",
        latest_source: "connector",
        latest_detail: "Waiting for operator approval before Telegram delivery.",
        summary: "Nervous system needs attention: 2 attention signals are active.",
      },
      organSupervisor: {
        state: "partially_blocked",
        summary: "Five supervised organs are healthy; one organ is blocked by substrate setup.",
        organ_count: 6,
        restartable_count: 5,
        manual_count: 1,
        process_isolation_count: 3,
        restart_count: 1,
        latest_recovery_action: "Manual setup required before Sandbox Validator can run",
        last_event:
          "memory_dream | organ.restarted | Memory And Dreaming recovered under supervision without restarting the BIOS shell.",
      },
      truthSpine: {
        governance_state: "clear",
        summary: "BOSS operating truth has folded proof and body inputs.",
        record_count: 5,
        latest_usage: {
          token_savings_percent: 88.83,
          savings_confidence: "measured",
        },
        stale_action_count: 1,
        readiness_gap_count: 1,
        proof_moment_count: 2,
        advisory_signal_count: 1,
        tiny_pack: {
          brainstorm: ["C? Consider optional detached truth import."],
          readiness_gaps: ["Needs proof before done: package proof pending."],
          proof_moments: ["PROOF: Package smoke passed."],
          advisory_signals: ["needs_proof: 1 proof gap should block completion claims"],
          warnings: [],
        },
      },
      skillLibrary: {
        hardened_skill_count: 4,
      },
      boxedLane: {
        state_label: "Boxed lane ready",
      },
      promotion: {
        summary: "Promotion stays approval-bound until boxed proof passes.",
      },
      sandboxState: {
        total_artifacts: 5,
      },
    });

    expect(snapshot.title).toBe("B.I.O.S. Biologically Inspired Operating System");
    expect(snapshot.stats).toEqual({
      durableMemory: 12,
      hardenedSkills: 4,
      nervousSignals: 9,
      truthRecords: 5,
      boxedArtifacts: 5,
      supervisedOrgans: 6,
      organRestarts: 1,
    });
    expect(snapshot.schemaNote).toBe("Schema online with timestamped memory classes.");
    expect(snapshot.cards).toHaveLength(11);
    expect(snapshot.cards[0]).toEqual({
      label: "Brainstem",
      title: "route ready",
      summary: "Brainstem is keeping route, recovery, and sleep timing aligned.",
    });
    expect(snapshot.cards[1]).toEqual({
      label: "Nervous System",
      title: "2 attention signals active",
      summary:
        "Nervous system needs attention: 2 attention signals are active. Latest signal: approval.requested from connector. Waiting for operator approval before Telegram delivery.",
    });
    expect(snapshot.cards[2]).toEqual({
      label: "Body",
      title: "private desktop active",
      summary: "The private desktop is handling work without touching the user surface.",
    });
    expect(snapshot.cards[3]).toEqual({
      label: "Organ Supervisor",
      title: "Partially Blocked | 6 organs | 1 restart",
      summary:
        "Five supervised organs are healthy; one organ is blocked by substrate setup. 5 organs can restart under supervisor control; 1 organ requires manual setup or substrate. 3 organs are process, body-worker, or boxed-lane boundaries. Latest recovery event: memory_dream | organ.restarted | Memory And Dreaming recovered under supervision without restarting the BIOS shell. Next recovery action: Manual setup required before Sandbox Validator can run.",
    });
    expect(snapshot.cards[4]).toEqual({
      label: "BOSS Operating Truth",
      title: "Clear | 5 truth records",
      summary:
        "BOSS operating truth has folded proof and body inputs. Usage: 88.83% token savings with measured confidence. Candidate truth is separate from accepted decisions. 1 stale action suppressed from live next actions. 1 readiness gap visible before done claims. 2 proof moments available. 1 advisory signal active.",
    });
    expect(snapshot.cards[5]).toEqual({
      label: "Memory",
      title: "6 live learnings active",
      summary:
        "6 live learning item(s) are usable now; 2 item(s) are queued for dream consolidation into durable memory. Latest: User prefers phase-complete updates.",
    });
    expect(snapshot.cards[7]).toEqual({
      label: "Rhythm & Cleanup",
      title: "Dreaming | 2 queued memories | 3 cleanups",
      summary:
        "Brainstem is allowing dream consolidation now. BIOS has 2 queued memory promotion candidates waiting for glymphatic cleanup. Next: Let BIOS AI finish its dream consolidation.",
    });
    expect(snapshot.cards[9]).toEqual({
      label: "Reflexes",
      title: "3 skill candidates | 4 hardened skills",
      summary:
        "Reflex learning has three candidates and four hardened skills. bios-shared-v1 reflex labels active. Dominant memory tag: Skill candidate. Dominant evidence: User approved. Dominant state: Validating.",
    });
    expect(snapshot.cards[10]).toEqual({
      label: "Boxed Safety",
      title: "Boxed lane ready",
      summary: "Promotion stays approval-bound until boxed proof passes.",
    });
  });
});
