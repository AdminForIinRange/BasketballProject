import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";

fal.config({ credentials: process.env.FAL_KEY! });

type Line = { time?: string; speaker?: string; text: string };
type VoiceDef = { voice: string; turn_prefix: string };

// Default “pool” of voices you like. You can swap any of these.
const VOICE_POOL: Record<string, VoiceDef> = {
  PlayByPlay: {
    voice: "Jennifer (English (US)/American)",
    turn_prefix: "PlayByPlay: ",
  },
  Color: { voice: "Furio (English (IT)/Italian)", turn_prefix: "Color: " },
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "Missing FAL_KEY on server." },
        { status: 500 },
      );
    }

    const {
      lines,
      voices, // optional override from client
      seed,
    }: { lines: Line[]; voices?: VoiceDef[]; seed?: number | null } =
      await req.json();

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: "Body must include non-empty `lines` array." },
        { status: 400 },
      );
    }

    // Build dialog text
    const input = lines
      .map((l) => `${(l.speaker ?? "Speaker").trim()}: ${l.text}`)
      .join("\n");

    // Collect speakers (in appearance order)
    const speakersInOrder = Array.from(
      new Set(
        lines.map((l) => (l.speaker ?? "Speaker").trim()).filter(Boolean),
      ),
    );

    // If client supplies voices, trust them (but cap at 2)
    let voiceDefs: VoiceDef[] | undefined =
      Array.isArray(voices) && voices.length ? voices.slice(0, 2) : undefined;

    // Otherwise, auto-pick up to two voices that match speakers
    if (!voiceDefs) {
      const auto: VoiceDef[] = [];
      for (const sp of speakersInOrder) {
        // Try to match well-known speakers first
        const key = sp.toLowerCase().includes("play")
          ? "PlayByPlay"
          : sp.toLowerCase().includes("color")
            ? "Color"
            : null;

        if (key && auto.length < 2) {
          auto.push(VOICE_POOL[key]);
        }
        if (auto.length >= 2) break;
      }

      // Fallbacks: if we still have fewer than 1–2, fill from pool in stable order
      if (auto.length === 0) auto.push(VOICE_POOL.PlayByPlay);
      if (speakersInOrder.length > 1 && auto.length === 1)
        auto.push(VOICE_POOL.Color);

      voiceDefs = auto.slice(0, 2);
    }

    // Safety: ensure turn_prefix ends with ": "
    voiceDefs = voiceDefs.map((v) => ({
      ...v,
      turn_prefix: v.turn_prefix.endsWith(": ")
        ? v.turn_prefix
        : `${v.turn_prefix.replace(/:?\s*$/, "")}: `,
    }));

    // If there are >2 distinct speakers, warn (dialog supports max 2 in one shot)
    const distinct = new Set(speakersInOrder).size;
    if (distinct > 2) {
      // You can either 1) warn or 2) remap extras to Color or PlayByPlay.
      // Here we just let it pass; extra speakers will be read in whichever voice matches the prefix.
      // If you prefer to block, return 400 with a helpful message.
      // return NextResponse.json(
      //   { error: "Dialog TTS supports at most 2 voices. Consider stitching multiple calls." },
      //   { status: 400 }
      // );
    }

    // Call FAL
    let sub;
    try {
      sub = await fal.subscribe("fal-ai/playai/tts/dialog", {
        input: {
          input,
          voices: voiceDefs, // <= one or two voices
          response_format: "url",
          seed: seed ?? null,
        },
        logs: true,
      });
    } catch (sdkErr: any) {
      const detail =
        sdkErr?.response?.data ??
        sdkErr?.data ??
        sdkErr?.message ??
        "Unknown FAL error";
      return NextResponse.json(
        { error: "FAL subscribe failed", detail },
        { status: 502 },
      );
    }

    const data = sub?.data ?? sub ?? {};
    const url =
      data?.audio?.url ??
      data?.url ??
      data?.output?.audio?.url ??
      data?.result?.audio?.url ??
      null;

    if (!url) {
      return NextResponse.json(
        { error: "No audio URL in FAL response.", raw: data },
        { status: 502 },
      );
    }

    return NextResponse.json({ audio: { url } }, { status: 200 });
  } catch (err: any) {
    console.error("TTS error:", err);
    return NextResponse.json(
      {
        error: "Failed to synthesize audio.",
        detail: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}