import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { verifyBiosAiForgeStudyLineageGate } from "../../scripts/bios-ai-forge-study-lineage-gate.mjs";

async function writeFixture(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

test("Forge Arena study lineage gate requires native, UI, smoke, and test proof", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-forge-study-lineage-gate-"));
  await writeFixture(
    repoRoot,
    "aether-canvas/src-tauri/src/forge_arena_local.rs",
    [
      "ForgeArenaStudyLineageEntry",
      "ForgeArenaStudyLineageState",
      "study_lineage: ForgeArenaStudyLineageState",
      "build_study_lineage_state",
      "local_study_lineage_preview",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
      "published_local_lineage",
      "truthful_blocked_capability_handling",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "aether-canvas/js/forge-arena-service.js",
    [
      "studyLineage",
      "Study Lineage",
      "Learnable Patterns",
      "Authorship Boundary",
      "lineageBoundary",
      "remixPermissionPolicy",
      "studyQueue",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "aether-canvas/js/forge-arena-service.test.js",
    [
      "local_study_lineage_preview",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
      "truthful_blocked_capability_handling",
      "Study Lineage",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "scripts/bios-ai-ux-smoke.mjs",
    [
      "Study Lineage",
      "Learnable Patterns",
      "Authorship Boundary",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
      "published_local_lineage",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "scripts/bios-ai-ux-audit-server.mjs",
    [
      "buildForgeStudyLineage",
      "study_lineage",
      "local_study_lineage_preview",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "test/vitest/vitest.bios-ai.config.ts",
    'aether-canvas/js/**/*.test.js\nenvironment: "jsdom"\nname: "bios-ai"\nisolate: true',
  );

  const result = await verifyBiosAiForgeStudyLineageGate(repoRoot, {
    buildIdentity: {
      productName: "BIOS AI",
      setupExePath: "target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
    },
    packagedState: {
      validatedSurfaces: ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
    },
    uxSmoke: { scenarios: ["forge-arena-local-proving-ground"] },
  });

  assert.equal(result.forgeArenaStudyLineageGate, "complete");
  assert.ok(result.blockedBypassCoverage.some((entry) => entry.includes("authorship_preserved")));
});
