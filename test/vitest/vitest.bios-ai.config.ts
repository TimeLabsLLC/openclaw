import { createScopedVitestConfig } from "./vitest.scoped-config.ts";
import { jsdomOptimizedDeps } from "./vitest.shared.config.ts";

export function createBiosAiVitestConfig(env?: Record<string, string | undefined>) {
  return createScopedVitestConfig(
    ["aether-canvas/js/**/*.test.js"],
    {
      deps: jsdomOptimizedDeps,
      environment: "jsdom",
      env,
      excludeUnitFastTests: false,
      includeAgentOSRuntimeSetup: false,
      isolate: true,
      name: "bios-ai",
      passWithNoTests: true,
    },
  );
}

export default createBiosAiVitestConfig();
