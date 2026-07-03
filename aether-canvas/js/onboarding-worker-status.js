export function buildWorkerInstallOutcomeSnapshot({
  finalDownload,
  selectedStorageLabel,
  workerLabel,
  probeError,
}) {
  if (finalDownload?.state === "completed" && !probeError) {
    return {
      status: "ready",
      progressText: "Download complete. Local worker is ready and onboarding can continue.",
      bubbleHtml: `<p style="font-size: 12px; color: hsl(160,100%,60%); margin: 0;">Local worker installed: <strong>${workerLabel}</strong> in <strong>${selectedStorageLabel}</strong>.</p>`,
    };
  }

  if (finalDownload?.state === "completed") {
    return {
      status: "probe_failed",
      progressText: probeError || "Local worker installed but the runtime probe failed.",
      bubbleHtml: `<p style="font-size: 12px; color: #feb2b2; margin: 0;">Local worker installed but could not be verified yet: ${probeError || "unknown error"}</p>`,
    };
  }

  if (finalDownload?.state === "failed" && finalDownload?.resumable) {
    const downloadedMb = finalDownload.downloaded_bytes
      ? ` ${Math.floor(finalDownload.downloaded_bytes / (1024 * 1024))} MB is saved in the partial file.`
      : "";
    const message = `${finalDownload?.error || "Local worker download was interrupted."}${downloadedMb} Retry will resume instead of starting over.`;
    return {
      status: "download_resumable",
      progressText: message,
      bubbleHtml: `<p style="font-size: 12px; color: #f6d365; margin: 0;">Local worker download was interrupted, but BIOS AI kept the partial file. Retry will resume this ${workerLabel} download in <strong>${selectedStorageLabel}</strong>.</p>`,
    };
  }

  return {
    status: "download_failed",
    progressText: finalDownload?.error || "Local worker download failed.",
    bubbleHtml: `<p style="font-size: 12px; color: #feb2b2; margin: 0;">Local worker download needs attention: ${finalDownload?.error || "unknown error"}</p>`,
  };
}
