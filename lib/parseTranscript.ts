export type TranscriptItem = { time?: string; speaker?: string; text: string };

export function parseTranscriptJSON(raw: string): TranscriptItem[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }
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
