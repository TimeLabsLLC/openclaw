import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS,
  createCorepackSpawnSpec,
  createDependencyCapsuleInstallArgs,
  createDependencyCapsulePackageJson,
  prepareBiosAiDesktopShellDependencyCapsule,
  resolveDependencyCapsuleDir,
} from "../../scripts/bios-ai-desktop-shell-dependency-capsule.mjs";

describe("BIOS AI desktop shell dependency capsule", () => {
  it("pins the minimal dependency set required for desktop-shell proof", () => {
    assert.deepEqual(createDependencyCapsulePackageJson(), {
      name: "bios-ai-desktop-shell-dependency-capsule",
      private: true,
      type: "module",
      dependencies: BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS,
    });
    assert.equal(BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS.tsdown, "0.21.10");
    assert.equal(BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS.electron, "42.2.0");
    assert.equal(BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS["electron-builder"], "26.8.1");
    assert.equal(BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS["playwright-core"], "1.59.1");
    assert.equal(BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS.esbuild, "~0.27.0");
    assert.equal(BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS.typescript, "^6.0.3");
  });

  it("installs outside the parent workspace by default", () => {
    const capsuleDir = path.join("D:", "capsule");

    assert.deepEqual(createDependencyCapsuleInstallArgs(capsuleDir), [
      "pnpm",
      "install",
      "--dir",
      capsuleDir,
      "--ignore-workspace",
      "--ignore-scripts",
      "--config.confirmModulesPurge=false",
      "--child-concurrency=1",
      "--network-concurrency=4",
    ]);
  });

  it("resolves the default capsule under desktop-shell artifacts", () => {
    const repoRoot = path.join("D:", "AgentOSProject");

    assert.equal(
      resolveDependencyCapsuleDir(repoRoot, {}),
      path.resolve(repoRoot, ".artifacts", "desktop-shell", "dependency-capsule"),
    );
  });

  it("honors an explicit dependency root override", () => {
    const repoRoot = path.join("D:", "AgentOSProject");
    const dependencyRoot = path.join("E:", "deps");

    assert.equal(
      resolveDependencyCapsuleDir(repoRoot, {
        AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT: dependencyRoot,
      }),
      path.resolve(dependencyRoot),
    );
  });

  it("launches corepack through cmd.exe on Windows so .cmd shims do not fail spawn", () => {
    const spec = createCorepackSpawnSpec(["pnpm", "--version"], "win32");

    assert.equal(spec.command, "cmd.exe");
    assert.deepEqual(spec.args, ["/d", "/s", "/c", "corepack", "pnpm", "--version"]);
  });

  it("launches corepack directly on non-Windows hosts", () => {
    const spec = createCorepackSpawnSpec(["pnpm", "--version"], "linux");

    assert.equal(spec.command, "corepack");
    assert.deepEqual(spec.args, ["pnpm", "--version"]);
  });

  it("writes package.json and delegates to corepack install", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-capsule-repo-"));
    const capsuleDir = await mkdtemp(path.join(os.tmpdir(), "bios-ai-capsule-deps-"));
    const calls = [];

    const result = await prepareBiosAiDesktopShellDependencyCapsule(repoRoot, {
      capsuleDir,
      async runCorepack(args, options) {
        calls.push({ args, cwd: options.cwd });
      },
    });

    const packageJson = JSON.parse(await readFile(result.packageJsonPath, "utf8"));
    assert.deepEqual(packageJson.dependencies, BIOS_AI_DESKTOP_SHELL_DEPENDENCY_CAPSULE_DEPS);
    assert.deepEqual(calls, [
      {
        args: createDependencyCapsuleInstallArgs(capsuleDir),
        cwd: path.resolve(repoRoot),
      },
    ]);
  });
});
