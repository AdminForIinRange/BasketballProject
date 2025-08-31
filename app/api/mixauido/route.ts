// import { NextRequest, NextResponse } from "next/server";
// import { fal } from "@fal-ai/client";
// import { randomUUID } from "crypto";
// import fs from "fs/promises";
// import path from "path";
// import { tmpdir } from "os";
// import { spawn } from "child_process";

// export const runtime = "nodejs";

// fal.config({ credentials: process.env.FAL_KEY! });
// const ffmpegPath = (ffmpegPathPkg as any).path as string;

// type Line = { time?: string; speaker?: string; text: string };
// type VoiceDef = { voice: string; turn_prefix: string };

// // Map the two speakers you want to distinct voices
// const VOICE_MAP: Record<string, VoiceDef> = {
//   PlayByPlay: { voice: "Jennifer (English (US)/American)", turn_prefix: "PlayByPlay: " },
//   Color:      { voice: "Furio (English (IT)/Italian)",     turn_prefix: "Color: " },
// };

// function parseHHMMSSmmm(s?: string): number {
//   if (!s) return 0;
//   // "HH:MM:SS.mmm" or "MM:SS.mmm" or "SS.mmm"
//   const parts = s.split(":").map(Number);
//   let h = 0, m = 0, sec = 0;
//   if (parts.length === 3) [h, m, sec] = parts;
//   else if (parts.length === 2) [m, sec] = parts;
//   else if (parts.length === 1) [sec] = parts;
//   const ms = Math.round(sec * 1000);
//   return (h * 3600000) + (m * 60000) + ms;
// }

// async function downloadToFile(url: string, outPath: string) {
//   const res = await fetch(url);
//   if (!res.ok) throw new Error(`Download failed: ${res.status}`);
//   const buf = Buffer.from(await res.arrayBuffer());
//   await fs.writeFile(outPath, buf);
// }

// async function ttsSingleLine(line: Line, v: VoiceDef): Promise<string> {
//   // Use dialog with a single voice; input must match turn_prefix
//   const inputText = `${v.turn_prefix}${line.text}`;
//   const sub = await fal.subscribe("fal-ai/playai/tts/dialog", {
//     input: {
//       input: inputText,
//       voices: [v],
//       response_format: "url",
//       seed: null,
//     },
//     logs: false,
//   });

//   const data = (sub as any)?.data ?? sub ?? {};
//   const url =
//     data?.audio?.url ??
//     data?.url ??
//     data?.output?.audio?.url ??
//     data?.result?.audio?.url ??
//     null;

//   if (!url) throw new Error("No audio URL from TTS");
//   return url;
// }

// function ffmpeg(args: string[]): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const p = spawn(ffmpegPath, args, { stdio: "inherit" });
//     p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
//   });
// }

// export async function POST(req: NextRequest) {
//   try {
//     if (!process.env.FAL_KEY) {
//       return NextResponse.json({ error: "Missing FAL_KEY" }, { status: 500 });
//     }

//     const { lines }: { lines: Line[] } = await req.json();
//     if (!Array.isArray(lines) || lines.length === 0) {
//       return NextResponse.json({ error: "Provide non-empty `lines`" }, { status: 400 });
//     }

//     // Normalize speaker labels to choose a voice (only two supported tracks)
//     const pickVoice = (speaker?: string): VoiceDef => {
//       const s = (speaker ?? "PlayByPlay").toLowerCase();
//       if (s.includes("color")) return VOICE_MAP.Color;
//       return VOICE_MAP.PlayByPlay;
//     };

//     // Generate clips per line
//     const tmp = path.join(tmpdir(), `mix-${randomUUID()}`);
//     await fs.mkdir(tmp, { recursive: true });

//     const inputSpecs: { file: string; delayMs: number }[] = [];

//     for (let i = 0; i < lines.length; i++) {
//       const L = lines[i];
//       if (!L?.text) continue;

//       const v = pickVoice(L.speaker);
//       const url = await ttsSingleLine(L, v);

//       const clipPath = path.join(tmp, `clip_${i}.wav`);
//       await downloadToFile(url, clipPath);

//       const delayMs = parseHHMMSSmmm(L.time);
//       inputSpecs.push({ file: clipPath, delayMs });
//     }

//     if (inputSpecs.length === 0) {
//       return NextResponse.json({ error: "No clips generated" }, { status: 500 });
//     }

//     // Build ffmpeg graph: adelay on every input, then amix
//     // Note: adelay needs a value per channel; we use stereo => "ms|ms"
//     const inputArgs: string[] = [];
//     const filterParts: string[] = [];
//     let labelIdx = 0;

//     inputSpecs.forEach((spec, i) => {
//       inputArgs.push("-i", spec.file);
//       const inLabel = `[${i}:a]`;
//       const outLabel = `[d${labelIdx}]`;
//       filterParts.push(`${inLabel}adelay=${spec.delayMs}|${spec.delayMs}${outLabel}`);
//       labelIdx++;
//     });

//     const mixedOut = "[mixout]";
//     const amix = `${Array.from({ length: labelIdx }, (_, k) => `[d${k}]`).join("")}amix=inputs=${labelIdx}:normalize=0${mixedOut}`;

//     const filters = [...filterParts, amix].join(";");

//     const outWav = path.join(tmp, "final.wav");
//     const outMp3 = path.join(tmp, "final.mp3");

//     // Mix to WAV (no re-encoding loss during mixing)
//     await ffmpeg([
//       ...inputArgs,
//       "-filter_complex", filters,
//       "-ac", "2",
//       "-ar", "48000",
//       "-y", outWav,
//     ]);

//     // Optionally transcode to MP3 (smaller)
//     await ffmpeg([
//       "-i", outWav,
//       "-b:a", "192k",
//       "-y", outMp3,
//     ]);

//     // Expose file: simplest is to return a data URL or stream.
//     // In Next.js, we can stream the MP3 file directly in this response:
//     const mp3Buf = await fs.readFile(outMp3);
//     // (You can also persist to S3 and return a signed URL instead.)
//     return new NextResponse(mp3Buf, {
//       status: 200,
//       headers: {
//         "Content-Type": "audio/mpeg",
//         "Content-Disposition": `inline; filename="mix.mp3"`,
//         "Cache-Control": "no-store",
//       },
//     });
//   } catch (err: any) {
//     console.error(err);
//     return NextResponse.json({ error: "Mix failed", detail: err?.message ?? String(err) }, { status: 500 });
//   }
// }
