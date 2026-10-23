declare global {
  interface Window {
    __KINTA_ARTIFACT_ASSETS__?: Record<string, string>;
  }
}

/** Embedded assets let the exported HTML run directly from disk. */
export function artifactAsset(source: string): string {
  const key = source.replace(/^\.?\//, "");
  return window.__KINTA_ARTIFACT_ASSETS__?.[key] ?? source;
}
