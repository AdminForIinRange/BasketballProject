export function publishAudioUrl(url: string) {
  window.dispatchEvent(new CustomEvent("audio:url", { detail: { url } }));
}
