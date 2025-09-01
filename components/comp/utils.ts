export const stableId = (p = "id") =>
  `${p}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(-4)}`;

export const fmt = (n: number) => {
  const m = Math.floor(n / 60).toString().padStart(2, "0");
  const s = Math.floor(n % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export const toSec = (tc?: string) => {
  if (!tc) return 0;
  const parts = tc.split(":");
  const hhmmss = parts.length === 3 ? parts : ["00", ...parts];
  const [hh, mm, ss] = hhmmss;
  const s = parseFloat(ss || "0");
  const m = parseInt(mm || "0");
  const h = parseInt(hh || "0");
  return h * 3600 + m * 60 + s;
};

export const roleOf = (s?: string): "PlayByPlay" | "Color" =>
  (s || "").toLowerCase().includes("color") ? "Color" : "PlayByPlay";

export const getDuration = (url: string) =>
  new Promise<number>((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () =>
      resolve(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
  });

export function parseTranscriptJSON(raw: string): Line[] {
  let parsed: any;
  parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Root must be an array");
  return parsed.map((row, i) => {
    if (!row || typeof row.text !== "string") {
      throw new Error(`Item ${i} is missing required "text" field`);
    }
    return {
      time: typeof row.time === "string" ? row.time : undefined,
      speaker: typeof row.speaker === "string" ? row.speaker : "Speaker",
      text: row.text,
    };
  });
}
