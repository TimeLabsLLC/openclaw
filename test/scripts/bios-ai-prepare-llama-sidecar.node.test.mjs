import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  archiveExtractionCommand,
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

  it("uses native Windows archive extraction so Git Bash tar does not parse drive letters", () => {
    const extraction = archiveExtractionCommand(
      "C:\\Temp\\llama.zip",
      "C:\\Temp\\extract",
      "win32",
    );

    assert.equal(extraction.command, "powershell.exe");
    assert.ok(
      extraction.args.includes(
        "Expand-Archive -LiteralPath $env:BIOS_AI_LLAMA_ARCHIVE_PATH -DestinationPath $env:BIOS_AI_LLAMA_EXTRACT_ROOT -Force",
      ),
    );
    assert.equal(extraction.env.BIOS_AI_LLAMA_ARCHIVE_PATH, "C:\\Temp\\llama.zip");
    assert.equal(extraction.env.BIOS_AI_LLAMA_EXTRACT_ROOT, "C:\\Temp\\extract");
  });

  it("uses tar extraction for hosted macOS and Linux archives", () => {
    assert.deepEqual(archiveExtractionCommand("/tmp/llama.tar.gz", "/tmp/extract", "linux"), {
      command: "tar",
      args: ["-xf", "/tmp/llama.tar.gz", "-C", "/tmp/extract"],
    });
  });
});
