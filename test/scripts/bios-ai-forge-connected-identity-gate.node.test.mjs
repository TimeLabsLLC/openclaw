import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBiosAiForgeConnectedIdentityGate } from "../../scripts/bios-ai-forge-connected-identity-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("BIOS AI Forge Arena connected identity release gate", () => {
  it("accepts connected identity only with packaged profile-entry proof inputs", async () => {
    const result = await verifyBiosAiForgeConnectedIdentityGate(repoRoot, {
      buildIdentity: {
        productName: "BIOS AI",
        setupExePath: "aether-canvas/src-tauri/target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
      },
      packagedState: {
        validatedSurfaces: ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
      },
      uxSmoke: {
        scenarios: ["forge-arena-profile-entry"],
      },
    });

    assert.equal(result.forgeArenaConnectedIdentityGate, "complete");
    assert.ok(
      result.packagedUxCoverage.includes(
        "UI names the connected backend as not attached instead of pretending public network sync exists",
      ),
    );
    assert.ok(
      result.blockedBypassCoverage.includes(
        "Private BIOS truth cannot silently become Forge Arena public truth",
      ),
    );
  });
});
