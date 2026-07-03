import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expectedLlamaAssetPattern,
  selectLlamaAsset,
} from "../../scripts/bios-ai-prepare-llama-sidecar.mjs";

describe("bios-ai-prepare-llama-sidecar", () => {
  it("selects hosted-runner llama.cpp assets by platform", () => {
    const release = {
      tag_name: "b9999",
      assets: [
        {
          name: "llama-b9999-bin-macos-x64.tar.gz",
          browser_download_url: "https://example.invalid/macos",
        },
        {
          name: "llama-b9999-bin-ubuntu-x64.tar.gz",
          browser_download_url: "https://example.invalid/linux",
        },
        {
          name: "llama-b9999-bin-win-cpu-x64.zip",
          browser_download_url: "https://example.invalid/windows",
        },
      ],
    };

    assert.equal(
      selectLlamaAsset(release, "darwin", "x64").name,
      "llama-b9999-bin-macos-x64.tar.gz",
    );
    assert.equal(
      selectLlamaAsset(release, "linux", "x64").name,
      "llama-b9999-bin-ubuntu-x64.tar.gz",
    );
    assert.equal(selectLlamaAsset(release, "win32", "x64").name, "llama-b9999-bin-win-cpu-x64.zip");
  });

  it("rejects unsupported sidecar platforms", () => {
    assert.throws(
      () => expectedLlamaAssetPattern("freebsd", "x64"),
      /Unsupported llama\.cpp sidecar platform/,
    );
  });
});
