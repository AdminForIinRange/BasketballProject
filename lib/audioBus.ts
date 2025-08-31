// lib/audioBus.ts

/** Single-track event (you already have this) */
export function publishAudioUrl(url: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("audio:url", { detail: { url } }));
}

/** NEW: dual-track event for overlap mode */
export function publishDualAudioUrls(
  playUrl: string | null,
  colorUrl: string | null
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("audio:dual", { detail: { playUrl, colorUrl } })
  );
}
