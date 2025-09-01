import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
fal.config({ credentials: process.env.FAL_KEY! });

type VoiceDef = { voice: string; turn_prefix: string };

const VOICE_POOL: Record<string, VoiceDef> = {
  PlayByPlay: { voice: "Jennifer (English (US)/American)", turn_prefix: "PlayByPlay: " },
  Color: { voice: "Furio (English (IT)/Italian)", turn_prefix: "Color: " },
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "Missing FAL_KEY" }, { status: 500 });
    }

    // the UI sends { text, speaker, time }
    const body = await req.json().catch(() => ({} as any));
    const text: string = body?.text ?? "";
    const speaker: string = body?.speaker ?? "PlayByPlay";

    if (!text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // pick a voice by role
    const role = speaker.toLowerCase().includes("color") ? "Color" : "PlayByPlay";
    const voiceDef = VOICE_POOL[role];

    // Build a single-line dialog input so the voice selector is honored
    const inputLine = `${role}: ${text}`;

    const sub = await fal.subscribe("fal-ai/playai/tts/dialog", {
      input: {
        input: inputLine,
        voices: [voiceDef],          // single voice for this line
        response_format: "url",
        seed: null,
      },
      logs: true,
    });

    const data = sub?.data ?? sub ?? {};
    const url =
      data?.audio?.url ??
      data?.url ??
      data?.output?.audio?.url ??
      data?.result?.audio?.url ??
      null;

    if (!url) {
      return NextResponse.json({ error: "No audio URL in FAL response", raw: data }, { status: 502 });
    }

    return NextResponse.json({ audio: { url } }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to synthesize audio", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
