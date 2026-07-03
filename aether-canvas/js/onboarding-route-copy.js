import {
  buildLocalWorkerOptions,
  chooseRecommendedLocalWorker,
} from "./onboarding-local-runtime.js";

function titleCase(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "a cloud provider";
  }
  return text
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function chooseRecommendedLocalBoss(machineProfile, modelChoice, workerCatalog) {
  return chooseRecommendedLocalWorker(
    buildLocalWorkerOptions(machineProfile, workerCatalog),
    modelChoice,
  );
}

export function buildOnboardingRouteChoiceSnapshot({
  machineProfile = null,
  hasCloudKey = false,
  cloudProvider = null,
  hasSelectedLocalModels = false,
  hasInstalledWorkerModels = false,
  preferredLocalBackend = null,
  defaultModel = "commercial",
  workerCatalog = null,
} = {}) {
  const recommendedLocalBoss = chooseRecommendedLocalBoss(machineProfile, "local", workerCatalog);
  const recommendedHybridBoss = chooseRecommendedLocalBoss(
    machineProfile,
    "hybrid",
    workerCatalog,
  );
  const notices = [];

  if (preferredLocalBackend) {
    notices.push("A working local lane is already known, so Local only starts selected.");
  }
  if (hasSelectedLocalModels) {
    notices.push("BIOS AI found local model inventory on this machine, so a local route can make sense here.");
  }
  if (!hasSelectedLocalModels && hasInstalledWorkerModels) {
    notices.push("A BIOS AI managed local brain is already installed, so Local only can finish immediately.");
  }
  if (!hasCloudKey) {
    notices.push("Cloud BOSS is shown for comparison, but it stays locked until a usable cloud key exists.");
  }

  return {
    intro:
      "Choose where this BOSS is allowed to think. BIOS AI will stay inside that rule and handle the matching route for you.",
    helper:
      "This does not lock one model forever. You are setting the rule BIOS AI must follow when it chooses between local and cloud brains.",
    notices,
    options: [
      {
        value: "commercial",
        label: "Cloud BOSS",
        recommended: defaultModel === "commercial",
        enabled: hasCloudKey,
        description: hasCloudKey
          ? `Starts on your best imported cloud route, currently led by ${titleCase(cloudProvider)}.`
          : "Needs a usable cloud key before BIOS AI can choose this route.",
      },
      {
        value: "local",
        label: "Local only",
        recommended: defaultModel === "local",
        enabled: true,
        description: recommendedLocalBoss
          ? `Keeps the BOSS on this machine. Next, BIOS AI will help you start with a local brain such as ${recommendedLocalBoss.label}, which matches this machine well.`
          : "Keeps the BOSS on this machine. Next, BIOS AI will prepare a managed local brain that fits this machine.",
      },
      {
        value: "hybrid",
        label: "Hybrid",
        recommended: defaultModel === "hybrid",
        enabled: true,
        description: recommendedHybridBoss
          ? `Keeps a local brain ready for private work and still allows cloud help later. BIOS AI will usually start with ${recommendedHybridBoss.label} on this machine.`
          : "Keeps a local brain ready for private work and still allows cloud help later.",
      },
    ],
  };
}
