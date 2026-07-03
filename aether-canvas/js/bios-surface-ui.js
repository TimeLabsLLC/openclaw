function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCard(label, title, summary) {
  return {
    label,
    title: title || "Waiting on BIOS",
    summary: summary || "This subsystem has not hydrated yet.",
  };
}

function titleCaseWords(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function nervousSystemTitle(nervousSystem) {
  if (!nervousSystem) {
    return "No signals yet";
  }
  const state = nervousSystem.coordination_state || "quiet";
  const count = nervousSystem.total_signals || 0;
  if (state === "needs_attention") {
    return `${pluralize(nervousSystem.attention_signal_count || 0, "attention signal")} active`;
  }
  return `${titleCaseWords(state)} | ${pluralize(count, "signal")}`;
}

function nervousSystemSummary(nervousSystem) {
  if (!nervousSystem) {
    return "Subsystem coordination signals will appear here once BIOS starts moving.";
  }
  const latest = nervousSystem.latest_signal
    ? ` Latest signal: ${nervousSystem.latest_signal}${
        nervousSystem.latest_source ? ` from ${nervousSystem.latest_source}` : ""
      }.`
    : "";
  const detail = nervousSystem.latest_detail ? ` ${nervousSystem.latest_detail}` : "";
  return `${nervousSystem.summary || "The BIOS nervous system is reporting subsystem truth."}${latest}${detail}`.trim();
}

function organSupervisorTitle(organSupervisor) {
  if (!organSupervisor) {
    return "Supervisor waiting";
  }
  const state = titleCaseWords(organSupervisor.state || "waiting");
  const count = organSupervisor.organ_count || 0;
  const restarts = organSupervisor.restart_count || 0;
  return `${state} | ${pluralize(count, "organ")} | ${pluralize(restarts, "restart")}`;
}

function organSupervisorSummary(organSupervisor) {
  if (!organSupervisor) {
    return "The organ supervisor has not hydrated yet.";
  }
  const latestEvent = String(organSupervisor.last_event || "").replace(/[.]\s*$/, "");
  const latest = latestEvent ? ` Latest recovery event: ${latestEvent}.` : "";
  const restartable = Number(organSupervisor.restartable_count || 0);
  const manual = Number(organSupervisor.manual_count || 0);
  const processBound = Number(organSupervisor.process_isolation_count || 0);
  const recoveryAction = String(organSupervisor.latest_recovery_action || "").trim();
  const restartTruth =
    restartable || manual
      ? ` ${pluralize(restartable, "organ")} can restart under supervisor control; ${pluralize(
          manual,
          "organ",
        )} ${manual === 1 ? "requires" : "require"} manual setup or substrate.`
      : "";
  const isolationTruth = processBound
    ? ` ${pluralize(processBound, "organ")} are process, body-worker, or boxed-lane boundaries.`
    : "";
  const nextAction = recoveryAction ? ` Next recovery action: ${recoveryAction}.` : "";
  return `${organSupervisor.summary || "BIOS organs are reporting health through one supervisor."}${restartTruth}${isolationTruth}${latest}${nextAction}`.trim();
}

function truthSpineTitle(truthSpine) {
  if (!truthSpine) {
    return "Operating truth not attached";
  }
  const state = titleCaseWords(
    truthSpine.governance_state || truthSpine.governanceState || "clear",
  );
  const count = truthSpine.record_count ?? truthSpine.recordCount ?? 0;
  return `${state} | ${pluralize(count, "truth record")}`;
}

function truthSpineSummary(truthSpine) {
  if (!truthSpine) {
    return "BOSS operating truth has not hydrated from the native runtime yet.";
  }
  const pack = truthSpine.tiny_pack || truthSpine.tinyPack || {};
  const usage = truthSpine.latest_usage || truthSpine.latestUsage || null;
  const staleCount = Number(truthSpine.stale_action_count ?? truthSpine.staleActionCount ?? 0);
  const readinessGapCount = Number(
    truthSpine.readiness_gap_count ?? truthSpine.readinessGapCount ?? 0,
  );
  const proofMomentCount = Number(
    truthSpine.proof_moment_count ?? truthSpine.proofMomentCount ?? 0,
  );
  const advisorySignalCount = Number(
    truthSpine.advisory_signal_count ?? truthSpine.advisorySignalCount ?? 0,
  );
  const brainstorm = Array.isArray(pack.brainstorm) ? pack.brainstorm : [];
  const summary =
    truthSpine.summary ||
    pack.compact_summary ||
    pack.compactSummary ||
    "BOSS operating truth is folded from memory, proof, body, sandbox, and nervous-system inputs.";
  const usageText = usage
    ? ` Usage: ${usage.token_savings_percent ?? usage.tokenSavingsPercent}% token savings with ${
        usage.savings_confidence || usage.savingsConfidence || "unknown"
      } confidence.`
    : "";
  const brainstormText = brainstorm.length
    ? ` Candidate truth is separate from accepted decisions.`
    : "";
  const staleText = staleCount
    ? ` ${pluralize(staleCount, "stale action")} suppressed from live next actions.`
    : "";
  const readinessText = readinessGapCount
    ? ` ${pluralize(readinessGapCount, "readiness gap")} visible before done claims.`
    : "";
  const proofText = proofMomentCount
    ? ` ${pluralize(proofMomentCount, "proof moment")} available.`
    : "";
  const advisoryText = advisorySignalCount
    ? ` ${pluralize(advisorySignalCount, "advisory signal")} active.`
    : "";
  const warnings =
    Array.isArray(pack.warnings) && pack.warnings.length ? ` Warning: ${pack.warnings[0]}` : "";
  return `${summary}${usageText}${brainstormText}${staleText}${readinessText}${proofText}${advisoryText}${warnings}`.trim();
}

function reflexSummary(reflex) {
  if (!reflex) {
    return "Reusable learning and hardened skills will surface here.";
  }
  const base = reflex.summary || "Reflex learning is tracking reusable behavior.";
  const schema = reflex.schema_summary || reflex.schemaSummary || "";
  const tag = reflex.top_tag_label || reflex.topTagLabel || "";
  const evidence = reflex.top_evidence_label || reflex.topEvidenceLabel || "";
  const state = reflex.top_state_label || reflex.topStateLabel || "";
  const schemaText = schema ? ` ${schema}.` : "";
  const tagText = tag ? ` Dominant memory tag: ${tag}.` : "";
  const evidenceText = evidence ? ` Dominant evidence: ${evidence}.` : "";
  const stateText = state ? ` Dominant state: ${state}.` : "";
  return `${base}${schemaText}${tagText}${evidenceText}${stateText}`.trim();
}

function rhythmTitle(circadian, glymphatic) {
  if (!circadian && !glymphatic) {
    return "Rhythm not hydrated";
  }
  const phase = circadian?.phase_label || titleCaseWords(circadian?.current_phase || "waiting");
  const pending = Number(
    glymphatic?.pending_queue_count ?? circadian?.queued_memory_promotions ?? 0,
  );
  const cleanups = Number(glymphatic?.total_compactions || 0);
  return `${phase} | ${pluralize(pending, "queued memory", "queued memories")} | ${pluralize(cleanups, "cleanup")}`;
}

function rhythmSummary(circadian, glymphatic, dream) {
  if (!circadian && !glymphatic) {
    return "Sleep timing, dream consolidation, and cleanup pressure have not hydrated yet.";
  }
  const phaseSummary =
    circadian?.summary ||
    dream?.summary ||
    "BIOS AI is watching whether memory should stay live or move into durable recall.";
  const cleanupSummary =
    glymphatic?.summary || "Cleanup pressure has not reported a separate glymphatic status yet.";
  const nextStep =
    circadian?.next_step || glymphatic?.recommended_action
      ? ` Next: ${circadian?.next_step || glymphatic?.recommended_action}`
      : "";
  return `${phaseSummary} ${cleanupSummary}${nextStep}`.trim();
}

export function buildBiosSurfaceSnapshot({
  memory = null,
  soul = null,
  dream = null,
  brainstem = null,
  circadian = null,
  glymphatic = null,
  reflex = null,
  observation = null,
  nervousSystem = null,
  organSupervisor = null,
  truthSpine = null,
  skillLibrary = null,
  boxedLane = null,
  promotion = null,
  sandboxState = null,
} = {}) {
  return {
    title: "B.I.O.S. Biologically Inspired Operating System",
    copy: "Read the living system by subsystem: brainstem, memory, soul, dreaming, reflexes, body, and boxed safety all report here from one contract truth.",
    stats: {
      durableMemory: memory?.durable_memory_count || 0,
      hardenedSkills: skillLibrary?.hardened_skill_count || reflex?.hardened_skill_count || 0,
      nervousSignals: nervousSystem?.total_signals || 0,
      truthRecords: truthSpine?.record_count ?? truthSpine?.recordCount ?? 0,
      boxedArtifacts: sandboxState?.total_artifacts || 0,
      supervisedOrgans: organSupervisor?.organ_count || 0,
      organRestarts: organSupervisor?.restart_count || 0,
    },
    schemaNote: memory?.schema_summary || "Shared BIOS schema has not hydrated yet.",
    cards: [
      formatCard(
        "Brainstem",
        brainstem?.lifecycle
          ? String(brainstem.lifecycle).replaceAll("_", " ")
          : "Waiting on route",
        brainstem?.summary ||
          "The brainstem runtime owns recovery, approval pauses, and dream timing.",
      ),
      formatCard(
        "Nervous System",
        nervousSystemTitle(nervousSystem),
        nervousSystemSummary(nervousSystem),
      ),
      formatCard(
        "Body",
        observation?.body_mode
          ? String(observation.body_mode).replaceAll("_", " ")
          : "Shell standby",
        observation?.body_summary ||
          observation?.detail ||
          "The BIOS body has not reported a visible or private work surface yet.",
      ),
      formatCard(
        "Organ Supervisor",
        organSupervisorTitle(organSupervisor),
        organSupervisorSummary(organSupervisor),
      ),
      formatCard(
        "BOSS Operating Truth",
        truthSpineTitle(truthSpine),
        truthSpineSummary(truthSpine),
      ),
      formatCard(
        "Memory",
        memory?.immediate_learning_ready
          ? `${pluralize(memory.live_learning_count || 0, "live learning")} active`
          : memory
            ? pluralize(memory.total_events || 0, "event")
            : "No memory yet",
        memory?.immediate_learning_ready
          ? `${memory.live_learning_summary}${memory.latest_live_learning ? ` Latest: ${memory.latest_live_learning}` : ""}`
          : memory?.summary || "Working memory and durable memory are still cold.",
      ),
      formatCard(
        "Dreaming",
        dream
          ? pluralize(dream.durable_memory_count || 0, "durable memory item")
          : "No dream cycle yet",
        dream?.summary || "Dream consolidation has not started yet.",
      ),
      formatCard(
        "Rhythm & Cleanup",
        rhythmTitle(circadian, glymphatic),
        rhythmSummary(circadian, glymphatic, dream),
      ),
      formatCard(
        "Soul",
        soul?.pending_changes ? pluralize(soul.pending_changes, "guarded change") : "Stable",
        soul?.summary || "Core identity governance is waiting on profile truth.",
      ),
      formatCard(
        "Reflexes",
        reflex
          ? `${pluralize(reflex.skill_candidate_count || 0, "skill candidate")} | ${pluralize(reflex.hardened_skill_count || 0, "hardened skill")}`
          : "No reflex growth yet",
        reflexSummary(reflex),
      ),
      formatCard(
        "Boxed Safety",
        boxedLane?.state_label || promotion?.state_label || "Waiting on boxed proof",
        promotion?.summary ||
          sandboxState?.queue_summary ||
          "Sandbox-first validation and promotion proof will appear here.",
      ),
    ],
  };
}
