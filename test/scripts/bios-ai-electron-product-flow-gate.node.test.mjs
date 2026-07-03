import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiElectronProductFlowGate } from "../../scripts/bios-ai-electron-product-flow-gate.mjs";

describe("BIOS AI Electron product-flow gate", () => {
  it("passes when packaged Electron returns visible product-flow screenshots", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-product-flow-test-"));
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");
    const report = await verifyBiosAiElectronProductFlowGate(tempRoot, {
      executablePath: exe,
      proofRoot,
      returningUserModel: {
        variant: "gemma-3-1b",
        model_id: "gemma-3-1b-it-Q4_K_M",
        file_name: "gemma-3-1b-it-Q4_K_M.gguf",
        path: modelPath,
      },
      runProcess: async (_command, _args, options) => {
        await mkdir(proofRoot, { recursive: true });
        assert.equal(options.env.BIOS_AI_MODELS_DIR, path.dirname(modelPath));
        assert.ok(options.env.BIOS_AI_HOME_OVERRIDE);
        assert.equal(options.env.BIOS_AI_ELECTRON_PROOF_PROFILE_ID, "proof-boss");
        assert.equal(options.env.BIOS_AI_ELECTRON_PROOF_PROFILE_NAME, "Proof BOSS");
        const surfaces = [
          "profile-or-home",
          "selected-boss-profile",
          "settings",
          "forge-arena",
          "chat",
        ].map((label) => ({
          label,
          screenshotPath: path.join(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, `${label}.png`),
          hasProfileChooser: label === "profile-or-home",
          hasLoadedBossProfile: label === "selected-boss-profile",
          hasBossOnlyChatPlaceholder: label === "chat",
          hasSettings: label === "settings",
          hasForgeArena: label === "forge-arena",
          hasModelManagement: label === "settings",
          hasChatComposer: label === "chat",
          bodyText: label,
        }));
        for (const surface of surfaces) {
          await mkdir(path.dirname(surface.screenshotPath), { recursive: true });
          await writeFile(surface.screenshotPath, "png");
        }
        const isFirstRun = options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO === "first-run";
        await writeFile(
          options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
          `${JSON.stringify({
            status: "pass",
            productFlow: isFirstRun
              ? {
                  status: "pass",
                  surfaces: [
                    {
                      label: "first-run-onboarding",
                      screenshotPath: path.join(
                        options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                        "first-run-onboarding.png",
                      ),
                      hasFirstRunOnboarding: true,
                      hasProfileChooser: false,
                      activeBiosProfileId: "",
                      bodyText:
                        "Before I can start helping you, we'll get set up through conversation.",
                    },
                  ],
                  firstRunProof: {
                    onboardingStarted: true,
                    noSavedProfileRequired: true,
                  },
                }
              : {
                  status: "pass",
                  surfaces,
                  returningUserProof: {
                    profileClicked: true,
                    loadedBossProfile: true,
                    bossOnlyChatPlaceholder: true,
                  },
                },
          })}\n`,
        );
        if (isFirstRun) {
          await writeFile(
            path.join(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, "first-run-onboarding.png"),
            "png",
          );
        }
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
      },
    });

    assert.equal(report.status, "pass");
    assert.equal(report.checks.at(-2).productFlow.status, "pass");
    assert.equal(report.checks.at(-1).productFlow.status, "pass");
    assert.equal(report.checks.at(1).status, "pass");
  });

  it("uses a generic proof profile and separately proves first-run onboarding", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "bios-ai-electron-product-flow-generic-"),
    );
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");
    const seenScenarios = [];

    const report = await verifyBiosAiElectronProductFlowGate(tempRoot, {
      executablePath: exe,
      proofRoot,
      returningUserModel: {
        variant: "gemma-3-1b",
        model_id: "gemma-3-1b-it-Q4_K_M",
        file_name: "gemma-3-1b-it-Q4_K_M.gguf",
        path: modelPath,
      },
      runProcess: async (_command, _args, options) => {
        const scenario = options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO;
        seenScenarios.push(scenario);
        assert.notEqual(options.env.BIOS_AI_ELECTRON_PROOF_PROFILE_ID, "babs");
        assert.notEqual(options.env.BIOS_AI_ELECTRON_PROOF_PROFILE_NAME, "B.A.Bs");
        await mkdir(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, { recursive: true });
        if (scenario === "first-run") {
          const screenshotPath = path.join(
            options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
            "first-run-onboarding.png",
          );
          await writeFile(screenshotPath, "png");
          await writeFile(
            options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
            `${JSON.stringify({
              status: "pass",
              productFlow: {
                status: "pass",
                surfaces: [
                  {
                    label: "first-run-onboarding",
                    screenshotPath,
                    hasFirstRunOnboarding: true,
                    hasProfileChooser: false,
                    activeBiosProfileId: "",
                    bodyText: "Before I can start helping you.",
                  },
                ],
                firstRunProof: {
                  onboardingStarted: true,
                  noSavedProfileRequired: true,
                },
              },
            })}\n`,
          );
          return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }
        const surfaces = [
          "profile-or-home",
          "selected-boss-profile",
          "settings",
          "forge-arena",
          "chat",
        ].map((label) => ({
          label,
          screenshotPath: path.join(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, `${label}.png`),
          hasProfileChooser: label === "profile-or-home",
          hasLoadedBossProfile: label === "selected-boss-profile",
          hasBossOnlyChatPlaceholder: label === "chat",
          hasSettings: label === "settings",
          hasForgeArena: label === "forge-arena",
          hasModelManagement: label === "settings",
          hasChatComposer: label === "chat",
          bodyText: label,
        }));
        for (const surface of surfaces) {
          await writeFile(surface.screenshotPath, "png");
        }
        await writeFile(
          options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
          `${JSON.stringify({
            status: "pass",
            productFlow: {
              status: "pass",
              surfaces,
              returningUserProof: {
                profileClicked: true,
                loadedBossProfile: true,
                bossOnlyChatPlaceholder: true,
              },
            },
          })}\n`,
        );
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
      },
    });

    assert.equal(report.status, "pass");
    assert.deepEqual(seenScenarios, ["returning-user", "first-run"]);
    assert.equal(
      report.checks.at(-2).name,
      "Packaged Electron renderer exposes visible returning-user product surfaces",
    );
    assert.equal(
      report.checks.at(-1).name,
      "Packaged Electron renderer exposes first-run onboarding without requiring a saved profile",
    );
  });

  it("discovers the returning-user model from the injected proof environment", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "bios-ai-electron-product-flow-env-model-"),
    );
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    const modelsDir = path.join(tempRoot, "proof-models");
    const modelPath = path.join(modelsDir, "gemma-3-1b-it-Q4_K_M.gguf");
    await writeFile(exe, "");
    await mkdir(modelsDir, { recursive: true });
    await writeFile(modelPath, "gguf");
    const seenArgs = [];

    const report = await verifyBiosAiElectronProductFlowGate(tempRoot, {
      executablePath: exe,
      proofRoot,
      platform: "linux",
      env: {
        BIOS_AI_MODELS_DIR: modelsDir,
      },
      runProcess: async (_command, args, options) => {
        seenArgs.push(args);
        await mkdir(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, { recursive: true });
        assert.equal(options.env.BIOS_AI_MODELS_DIR, modelsDir);
        const isFirstRun = options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO === "first-run";
        const surfaces = isFirstRun
          ? [
              {
                label: "first-run-onboarding",
                screenshotPath: path.join(
                  options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                  "first-run-onboarding.png",
                ),
                hasFirstRunOnboarding: true,
                activeBiosProfileId: "",
                bodyText: "Before I can start helping you.",
              },
            ]
          : ["profile-or-home", "selected-boss-profile", "settings", "forge-arena", "chat"].map(
              (label) => ({
                label,
                screenshotPath: path.join(
                  options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                  `${label}.png`,
                ),
                hasProfileChooser: label === "profile-or-home",
                hasLoadedBossProfile: label === "selected-boss-profile",
                hasBossOnlyChatPlaceholder: label === "chat",
                hasSettings: label === "settings",
                hasForgeArena: label === "forge-arena",
                hasModelManagement: label === "settings",
                hasChatComposer: label === "chat",
                bodyText: label,
              }),
            );
        for (const surface of surfaces) {
          await writeFile(surface.screenshotPath, "png");
        }
        await writeFile(
          options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
          `${JSON.stringify({
            status: "pass",
            productFlow: isFirstRun
              ? {
                  status: "pass",
                  surfaces,
                  firstRunProof: {
                    onboardingStarted: true,
                    noSavedProfileRequired: true,
                  },
                }
              : {
                  status: "pass",
                  surfaces,
                  returningUserProof: {
                    profileClicked: true,
                    loadedBossProfile: true,
                    bossOnlyChatPlaceholder: true,
                  },
                },
          })}\n`,
        );
        return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
      },
    });

    assert.equal(report.status, "pass");
    assert.equal(report.checks[1].model.path, modelPath);
    assert.deepEqual(seenArgs, [["--no-sandbox"], ["--no-sandbox"]]);
  });

  it("fails when a packaged screen exposes an internal Electron bridge error", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-electron-product-flow-error-"));
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");

    await assert.rejects(
      () =>
        verifyBiosAiElectronProductFlowGate(tempRoot, {
          executablePath: exe,
          proofRoot,
          returningUserModel: {
            variant: "gemma-3-1b",
            model_id: "gemma-3-1b-it-Q4_K_M",
            file_name: "gemma-3-1b-it-Q4_K_M.gguf",
            path: modelPath,
          },
          runProcess: async (_command, _args, options) => {
            await mkdir(proofRoot, { recursive: true });
            const surfaces = [
              "profile-or-home",
              "selected-boss-profile",
              "settings",
              "forge-arena",
              "chat",
            ].map((label) => ({
              label,
              screenshotPath: path.join(proofRoot, `${label}.png`),
              hasProfileChooser: label === "profile-or-home",
              hasLoadedBossProfile: label === "selected-boss-profile",
              hasBossOnlyChatPlaceholder: label === "chat",
              hasSettings: label === "settings",
              hasForgeArena: label === "forge-arena",
              hasModelManagement: label === "settings",
              hasChatComposer: label === "chat",
              bodyText:
                label === "settings"
                  ? "Error invoking remote method 'bios-ai:invoke': Electron shell spike does not expose BIOS AI command: bios_shell_contract"
                  : label,
            }));
            for (const surface of surfaces) {
              await writeFile(surface.screenshotPath, "png");
            }
            await writeFile(
              options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
              `${JSON.stringify({
                status: "pass",
                productFlow: {
                  status: "pass",
                  surfaces,
                  returningUserProof: {
                    profileClicked: true,
                    loadedBossProfile: true,
                    bossOnlyChatPlaceholder: true,
                  },
                },
              })}\n`,
            );
            return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
          },
        }),
      /without visible internal errors/,
    );
  });

  it("fails when a packaged screen exposes debug log paths on a primary product surface", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "bios-ai-electron-product-flow-debug-path-"),
    );
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");

    await assert.rejects(
      () =>
        verifyBiosAiElectronProductFlowGate(tempRoot, {
          executablePath: exe,
          proofRoot,
          returningUserModel: {
            variant: "gemma-3-1b",
            model_id: "gemma-3-1b-it-Q4_K_M",
            file_name: "gemma-3-1b-it-Q4_K_M.gguf",
            path: modelPath,
          },
          runProcess: async (_command, _args, options) => {
            await mkdir(proofRoot, { recursive: true });
            const surfaces = [
              "profile-or-home",
              "selected-boss-profile",
              "settings",
              "forge-arena",
              "chat",
            ].map((label) => ({
              label,
              screenshotPath: path.join(proofRoot, `${label}.png`),
              hasProfileChooser: label === "profile-or-home",
              hasLoadedBossProfile: label === "selected-boss-profile",
              hasBossOnlyChatPlaceholder: label === "chat",
              hasSettings: label === "settings",
              hasForgeArena: label === "forge-arena",
              hasModelManagement: label === "settings",
              hasChatComposer: label === "chat",
              bodyText:
                label === "settings"
                  ? "BIOS AI: route ready. Debug log: C:\\Users\\midni\\.agentos\\bios-ai\\logs\\runtime-debug.log."
                  : label,
            }));
            for (const surface of surfaces) {
              await writeFile(surface.screenshotPath, "png");
            }
            await writeFile(
              options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
              `${JSON.stringify({
                status: "pass",
                productFlow: {
                  status: "pass",
                  surfaces,
                  returningUserProof: {
                    profileClicked: true,
                    loadedBossProfile: true,
                    bossOnlyChatPlaceholder: true,
                  },
                },
              })}\n`,
            );
            return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
          },
        }),
      /without visible internal errors/,
    );
  });

  it("fails when Settings claims the cloud route is the BOSS", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "bios-ai-electron-product-flow-cloud-boss-"),
    );
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");

    await assert.rejects(
      () =>
        verifyBiosAiElectronProductFlowGate(tempRoot, {
          executablePath: exe,
          proofRoot,
          returningUserModel: {
            variant: "gemma-3-1b",
            model_id: "gemma-3-1b-it-Q4_K_M",
            file_name: "gemma-3-1b-it-Q4_K_M.gguf",
            path: modelPath,
          },
          runProcess: async (_command, _args, options) => {
            await mkdir(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, { recursive: true });
            const isFirstRun = options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO === "first-run";
            const surfaces = isFirstRun
              ? [
                  {
                    label: "first-run-onboarding",
                    screenshotPath: path.join(
                      options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                      "first-run-onboarding.png",
                    ),
                    hasFirstRunOnboarding: true,
                    activeBiosProfileId: "",
                    bodyText: "Before I can start helping you.",
                  },
                ]
              : ["profile-or-home", "selected-boss-profile", "settings", "forge-arena", "chat"].map(
                  (label) => ({
                    label,
                    screenshotPath: path.join(
                      options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                      `${label}.png`,
                    ),
                    hasProfileChooser: label === "profile-or-home",
                    hasLoadedBossProfile: label === "selected-boss-profile",
                    hasBossOnlyChatPlaceholder: label === "chat",
                    hasSettings: label === "settings",
                    hasForgeArena: label === "forge-arena",
                    hasModelManagement: label === "settings",
                    hasChatComposer: label === "chat",
                    bodyText:
                      label === "settings" ? "Route Posture Cloud BOSS Local only Hybrid" : label,
                  }),
                );
            for (const surface of surfaces) {
              await writeFile(surface.screenshotPath, "png");
            }
            await writeFile(
              options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
              `${JSON.stringify({
                status: "pass",
                productFlow: isFirstRun
                  ? {
                      status: "pass",
                      surfaces,
                      firstRunProof: {
                        onboardingStarted: true,
                        noSavedProfileRequired: true,
                      },
                    }
                  : {
                      status: "pass",
                      surfaces,
                      returningUserProof: {
                        profileClicked: true,
                        loadedBossProfile: true,
                        bossOnlyChatPlaceholder: true,
                      },
                    },
              })}\n`,
            );
            return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
          },
        }),
      /without visible internal errors/,
    );
  });

  it("fails when Settings exposes internal platform language to users", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "bios-ai-electron-product-flow-settings-copy-"),
    );
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");

    await assert.rejects(
      () =>
        verifyBiosAiElectronProductFlowGate(tempRoot, {
          executablePath: exe,
          proofRoot,
          returningUserModel: {
            variant: "gemma-3-1b",
            model_id: "gemma-3-1b-it-Q4_K_M",
            file_name: "gemma-3-1b-it-Q4_K_M.gguf",
            path: modelPath,
          },
          runProcess: async (_command, _args, options) => {
            await mkdir(options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR, { recursive: true });
            const isFirstRun = options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO === "first-run";
            const surfaces = isFirstRun
              ? [
                  {
                    label: "first-run-onboarding",
                    screenshotPath: path.join(
                      options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                      "first-run-onboarding.png",
                    ),
                    hasFirstRunOnboarding: true,
                    activeBiosProfileId: "",
                    bodyText: "Before I can start helping you.",
                  },
                ]
              : ["profile-or-home", "selected-boss-profile", "settings", "forge-arena", "chat"].map(
                  (label) => ({
                    label,
                    screenshotPath: path.join(
                      options.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR,
                      `${label}.png`,
                    ),
                    hasProfileChooser: label === "profile-or-home",
                    hasLoadedBossProfile: label === "selected-boss-profile",
                    hasBossOnlyChatPlaceholder: label === "chat",
                    hasSettings: label === "settings",
                    hasForgeArena: label === "forge-arena",
                    hasModelManagement: label === "settings",
                    hasChatComposer: label === "chat",
                    bodyText:
                      label === "settings"
                        ? "Safety Posture Sandbox Backend Boxed Lane Promotion Gate Use Your Own GGUF Diagnostics And Recovery"
                        : label,
                  }),
                );
            for (const surface of surfaces) {
              await writeFile(surface.screenshotPath, "png");
            }
            await writeFile(
              options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
              `${JSON.stringify({
                status: "pass",
                productFlow: isFirstRun
                  ? {
                      status: "pass",
                      surfaces,
                      firstRunProof: {
                        onboardingStarted: true,
                        noSavedProfileRequired: true,
                      },
                    }
                  : {
                      status: "pass",
                      surfaces,
                      returningUserProof: {
                        profileClicked: true,
                        loadedBossProfile: true,
                        bossOnlyChatPlaceholder: true,
                      },
                    },
              })}\n`,
            );
            return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
          },
        }),
      /without visible internal errors/,
    );
  });

  it("fails when the packaged flow never selects and loads the saved BOSS profile", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "bios-ai-electron-product-flow-no-selection-"),
    );
    const exe = path.join(tempRoot, "BIOS AI.exe");
    const proofRoot = path.join(tempRoot, "proof");
    await writeFile(exe, "");
    const modelPath = path.join(tempRoot, "models", "gemma-3-1b-it-Q4_K_M.gguf");
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "gguf");

    await assert.rejects(
      () =>
        verifyBiosAiElectronProductFlowGate(tempRoot, {
          executablePath: exe,
          proofRoot,
          returningUserModel: {
            variant: "gemma-3-1b",
            model_id: "gemma-3-1b-it-Q4_K_M",
            file_name: "gemma-3-1b-it-Q4_K_M.gguf",
            path: modelPath,
          },
          runProcess: async (_command, _args, options) => {
            await mkdir(proofRoot, { recursive: true });
            const surfaces = ["profile-or-home", "settings", "forge-arena", "chat"].map(
              (label) => ({
                label,
                screenshotPath: path.join(proofRoot, `${label}.png`),
                hasProfileChooser: label === "profile-or-home",
                hasSettings: label === "settings",
                hasForgeArena: label === "forge-arena",
                hasModelManagement: label === "settings",
                hasChatComposer: label === "chat",
                bodyText: label,
              }),
            );
            for (const surface of surfaces) {
              await writeFile(surface.screenshotPath, "png");
            }
            await writeFile(
              options.env.BIOS_AI_ELECTRON_SMOKE_REPORT,
              `${JSON.stringify({
                status: "pass",
                productFlow: {
                  status: "pass",
                  surfaces,
                  returningUserProof: {
                    profileClicked: false,
                    loadedBossProfile: false,
                    bossOnlyChatPlaceholder: false,
                  },
                },
              })}\n`,
            );
            return { status: "pass", exitCode: 0, timedOut: false, stdout: "", stderr: "" };
          },
        }),
      /selected BOSS profile/,
    );
  });
});
