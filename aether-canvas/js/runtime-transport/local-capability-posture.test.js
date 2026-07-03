import { describe, expect, it } from "vitest";
import {
  buildBiosAnswerGuard,
  buildLocalCapabilityPosture,
  buildLocalCapabilitySupportLabel,
  buildLocalCapabilitySystemPrompt,
  buildLocalToolInventorySummary,
} from "./local-capability-posture.js";

describe("local capability posture", () => {
  it("describes the local lane with real BIOS context while keeping missing powers explicit", () => {
    const posture = buildLocalCapabilityPosture({
      runtimeStatus: {
        route_ready: true,
        worker_ready: true,
        preferred_local_backend: "bios-managed",
        next_step: "You can start chatting now.",
      },
      onboardingState: {
        modelPref: "local",
      },
      providerConfig: {
        conversation_history: [{ role: "user", text: "Remember the build doctrine." }],
      },
      memorySurface: {
        totalEvents: 2,
        standingOrders: [{ text: "Never fake BIOS powers." }],
        userPreferences: [],
        missionFacts: [{ text: "Local BIOS runtime is active." }],
        consolidatedMemory: [{ text: "Use sandbox first." }],
      },
      observation: {
        label: "BIOS Home",
        bodySummary: "BIOS AI is working from the visible local shell surface.",
      },
      skillLibrary: {
        hardenedSkillCount: 1,
        strongestSkill: "Use sandbox first.",
        artifacts: [{ text: "Use sandbox first." }],
      },
      reflex: {
        ready: true,
        skill_candidate_count: 2,
        hardened_skill_count: 1,
        synapse_event_count: 5,
        top_skill_candidate: "Patch in sandbox first.",
        strongest_hardened_skill: "Validate before promotion.",
        schema_summary: "bios-shared-v1 reflex labels active",
        top_tag_label: "Skill candidate",
        top_evidence_label: "User approved",
        top_state_label: "Validating",
      },
      connectorStatus: {
        connectors: [
          {
            connector: "telegram",
            ready: true,
            label: "Telegram connector ready",
            detail: "Telegram is live through BIOS AI.",
          },
        ],
      },
      toolRegistry: {
        tools: [
          {
            name: "machine.inspect",
            label: "Inspect machine profile",
            execution_class: "safe_local_read",
          },
          {
            name: "runtime.model.select_managed",
            label: "Select BIOS managed model",
            execution_class: "approval_required_host_action",
          },
          {
            name: "profile.memory.append_note",
            label: "Append BIOS memory note",
            execution_class: "boxed_first_risky_action",
          },
        ],
      },
      machineProfile: {
        os: "windows",
        arch: "x86_64",
        logicalCores: 20,
        totalMemoryGb: 32,
        gpuName: "RTX 4080",
        gpuVendor: "NVIDIA",
        gpuVramGb: null,
        truthNotes: ["BIOS AI could not verify dedicated GPU VRAM."],
      },
      truthSpine: {
        ready: true,
        tiny_pack: {
          readiness: "ready",
          governance_state: "clear",
          compact_summary: "Use proof and memory before acting.",
          body_inputs: ["proof: 4 record(s)", "memory: 2 event(s), 1 durable item(s)"],
          active_decisions: ["BOSS chooses the best worker model."],
          dead_ends: ["Do not claim tools that are not registered."],
          next_actions: ["Keep local mode honest."],
          brainstorm: ["C? Consider using the detached app as an optional source."],
          answer_guard: ["Done and readiness answers must use BOSS operating truth."],
          truth_nudges: ["Do not treat candidate truth as accepted."],
          readiness_gaps: ["Needs proof before done: package proof is pending."],
          proof_moments: ["PROOF: Packaged BOSS operating truth smoke passed."],
          advisory_signals: ["needs_proof: 1 proof gap should block completion claims"],
          warnings: [],
        },
        latest_usage: {
          context_profile: "tiny",
          baseline_tokens: 1459,
          truthspine_context_tokens: 163,
          token_savings_percent: 88.83,
          savings_confidence: "measured",
        },
        stale_action_count: 1,
        readiness_gap_count: 1,
        advisory_signal_count: 1,
      },
    });

    expect(posture.chat.ready).toBe(true);
    expect(posture.savedHistory.ready).toBe(true);
    expect(posture.biosMemory.ready).toBe(true);
    expect(posture.observation.ready).toBe(true);
    expect(posture.tools.ready).toBe(true);
    expect(posture.tools.inventory.toolCount).toBe(3);
    expect(posture.tools.inventory.classCounts.safe_local_read).toBe(1);
    expect(posture.tools.inventory.classCounts.approval_required_host_action).toBe(1);
    expect(posture.tools.inventory.classCounts.boxed_first_risky_action).toBe(1);
    expect(posture.skills.ready).toBe(true);
    expect(posture.reflexes.ready).toBe(true);
    expect(posture.reflexSummary.topCandidate).toBe("Patch in sandbox first.");
    expect(posture.connectors.ready).toBe(true);
    expect(posture.truthSpine.ready).toBe(true);
    expect(posture.connectors.label).toContain("1 local connector ready");
    expect(posture.tools.label).toContain("BIOS-owned local tools ready");
    expect(buildLocalCapabilitySupportLabel(posture)).toContain("saved shell history attached");
    expect(buildLocalCapabilitySupportLabel(posture)).toContain("compact BOSS operating truth");
    expect(buildLocalCapabilitySupportLabel(posture)).toContain("learned BIOS reflexes visible");
    expect(buildLocalCapabilitySupportLabel(posture)).not.toContain("TruthSpine");
  });

  it("builds a system prompt that forbids fake memory, system, and connector claims", () => {
    const posture = buildLocalCapabilityPosture({
      runtimeStatus: {
        route_ready: true,
        worker_ready: true,
        preferred_local_backend: "bios-managed",
      },
      onboardingState: {
        modelPref: "local",
      },
      providerConfig: {
        conversation_history: [{ role: "user", text: "Remember the build doctrine." }],
      },
      memorySurface: {
        totalEvents: 2,
        standingOrders: [{ text: "Never fake BIOS powers." }],
        userPreferences: [{ text: "Keep the shell calm." }],
        missionFacts: [{ text: "Local BIOS runtime is active." }],
        consolidatedMemory: [{ text: "Use sandbox first." }],
      },
      observation: {
        label: "BIOS Home",
        activeSurface: "local_shell",
        bodySummary: "BIOS AI is working from the visible local shell surface.",
      },
      skillLibrary: {
        hardenedSkillCount: 1,
        strongestSkill: "Use sandbox first.",
        artifacts: [{ text: "Use sandbox first." }],
      },
      reflex: {
        ready: true,
        skill_candidate_count: 2,
        hardened_skill_count: 1,
        synapse_event_count: 5,
        top_skill_candidate: "Patch in sandbox first.",
        strongest_hardened_skill: "Validate before promotion.",
        schema_summary: "bios-shared-v1 reflex labels active",
        top_tag_label: "Skill candidate",
        top_evidence_label: "User approved",
        top_state_label: "Validating",
      },
      machineProfile: {
        os: "windows",
        arch: "x86_64",
        logicalCores: 20,
        totalMemoryGb: 32,
        gpuName: "RTX 4080",
        gpuVendor: "NVIDIA",
        gpuVramGb: null,
        truthNotes: ["BIOS AI could not verify dedicated GPU VRAM."],
      },
      truthSpine: {
        ready: true,
        tiny_pack: {
          readiness: "ready",
          governance_state: "clear",
          compact_summary: "Use proof and memory before acting.",
          body_inputs: ["proof: 4 record(s)", "memory: 2 event(s), 1 durable item(s)"],
          active_decisions: ["BOSS chooses the best worker model."],
          dead_ends: ["Do not claim tools that are not registered."],
          next_actions: ["Keep local mode honest."],
          brainstorm: ["C? Consider using the detached app as an optional source."],
          answer_guard: ["Done and readiness answers must use BOSS operating truth."],
          truth_nudges: ["Do not treat candidate truth as accepted."],
          readiness_gaps: ["Needs proof before done: package proof is pending."],
          proof_moments: ["PROOF: Packaged BOSS operating truth smoke passed."],
          advisory_signals: ["needs_proof: 1 proof gap should block completion claims"],
          warnings: [],
        },
        latest_usage: {
          context_profile: "tiny",
          baseline_tokens: 1459,
          truthspine_context_tokens: 163,
          token_savings_percent: 88.83,
          savings_confidence: "measured",
        },
        stale_action_count: 1,
        readiness_gap_count: 1,
        advisory_signal_count: 1,
      },
    });

    const prompt = buildLocalCapabilitySystemPrompt({
      agentName: "Claw",
      capabilityPosture: posture,
      identityText: "## Soul\nStay direct.",
      currentUserPrompt: "Are we done and ready to ship?",
    });

    expect(prompt).toContain("Do not say you checked saved history");
    expect(prompt).toContain("Do not say you checked BIOS memory");
    expect(prompt).toContain("Do not say you inspected the machine");
    expect(prompt).toContain("Do not say you used Telegram");
    expect(prompt).toContain("Live BIOS memory surface for this profile");
    expect(prompt).toContain("Compact BOSS operating truth for this profile");
    expect(prompt).toContain("Use proof and memory before acting.");
    expect(prompt).toContain("BOSS chooses the best worker model.");
    expect(prompt).toContain("Candidate/question/exploration truth");
    expect(prompt).toContain("Answer guard rules");
    expect(prompt).toContain("Done and readiness answers must use BOSS operating truth.");
    expect(prompt).toContain("Truth nudges");
    expect(prompt).toContain("Readiness gaps");
    expect(prompt).toContain("Needs proof before done: package proof is pending.");
    expect(prompt).toContain("Proof moments");
    expect(prompt).toContain("Advisory signals");
    expect(prompt).toContain("BOSS pre-answer operating-truth guard");
    expect(prompt).toContain("Matched areas: readiness-gap-proof");
    expect(prompt).toContain("Consider using the detached app as an optional source.");
    expect(prompt).toContain("Stale action suppression: 1 stale item");
    expect(prompt).toContain("88.83% savings, measured confidence");
    expect(prompt).not.toContain("TruthSpine");
    expect(prompt).toContain("Never fake BIOS powers.");
    expect(prompt).toContain("Live BIOS hardened skill context for this profile");
    expect(prompt).toContain("Live BIOS reflex and synapse context for this profile");
    expect(prompt).toContain("Patch in sandbox first.");
    expect(prompt).toContain("Validate before promotion.");
    expect(prompt).toContain("Skill candidate | User approved | Validating");
    expect(prompt).toContain("Live BIOS machine profile for this system");
    expect(prompt).toContain("Logical cores: 20");
    expect(prompt).toContain("GPU VRAM: unknown GB");
    expect(prompt).toContain("Hardware truth notes");
    expect(prompt).toContain("could not verify dedicated GPU VRAM");
    expect(prompt).toContain("Live BIOS local action inventory");
    expect(prompt).toContain("Loaded BIOS identity context follows");
  });

  it("routes done, prior-plan, and Forge questions through the BOSS answer guard", () => {
    const guard = buildBiosAnswerGuard({
      prompt: "Are we done with the Forge Arena plan or what is still missing?",
      truthSpine: {
        governance_state: "clear",
        tiny_pack: {
          answer_guard: ["Completion claims require proof refs."],
          truth_nudges: ["Check accepted Forge direction before answering."],
          readiness_gaps: ["Needs proof before done: packaged Arena proof is pending."],
          proof_moments: ["PROOF: Windows package smoke passed."],
          advisory_signals: ["needs_proof: 1 proof gap should block completion claims"],
        },
      },
    });

    expect(guard.requiresTruthCheck).toBe(true);
    expect(guard.riskLevel).toBe("high");
    expect(guard.matchedAreas).toContain("readiness-gap-proof");
    expect(guard.matchedAreas).toContain("product-direction");
    expect(guard.readinessGaps[0]).toContain("Needs proof before done");
    expect(guard.instruction).toContain("Use BOSS operating truth");
  });

  it("summarizes local tool execution classes and ready connectors as capability inventory", () => {
    const inventory = buildLocalToolInventorySummary(
      {
        tools: [
          { name: "machine.inspect", execution_class: "safe_local_read" },
          {
            name: "runtime.model.select_managed",
            execution_class: "approval_required_host_action",
          },
          { name: "profile.memory.append_note", execution_class: "boxed_first_risky_action" },
        ],
      },
      {
        connectors: [
          { connector: "telegram", ready: true, allowed_actions: ["send_message"] },
          { connector: "discord", ready: false, allowed_actions: ["send_message"] },
        ],
      },
    );

    expect(inventory.toolCount).toBe(3);
    expect(inventory.readyConnectorCount).toBe(1);
    expect(inventory.classSummary).toContain("1 safe reads");
    expect(inventory.classSummary).toContain("1 approval-required host actions");
    expect(inventory.classSummary).toContain("1 boxed-first risky actions");
    expect(inventory.detail).toContain("1 connector ready");
    expect(inventory.truthRule).toContain("only claim or run local actions");
  });

  it("does not mark chat ready from stale backend hints without a route-ready contract", () => {
    const posture = buildLocalCapabilityPosture({
      runtimeStatus: {
        route_ready: false,
        worker_ready: true,
        local_backend_reachable: true,
        preferred_local_backend: "bios-managed",
        next_step: "Select and verify a BOSS brain before chat.",
      },
      onboardingState: {
        modelPref: "local",
        preferredLocalBackend: "bios-managed",
      },
      providerConfig: {
        active_provider: "lmstudio",
      },
    });

    expect(posture.chat.ready).toBe(false);
    expect(posture.chat.label).toBe("Local chat not ready");
    expect(posture.chat.detail).toBe("Select and verify a BOSS brain before chat.");
    expect(posture.summary).toContain("Local chat is not ready yet");
  });
});
