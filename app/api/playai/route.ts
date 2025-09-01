// App Router version: app/api/playai/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
fal.config({ credentials: process.env.FAL_KEY! });

type VoiceDef = { voice: string };

const VOICE_POOL: Record<string, VoiceDef> = {
  PlayByPlay: { voice: "Jennifer (English (US)/American)" },
  Color: { voice: "Furio (English (IT)/Italian)" },
  Analyst: { voice: "Will (English (GB)/British)" },
  Speaker: { voice: "Jennifer (English (US)/American)" },
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "Missing FAL_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const text: string = body?.text ?? "";
    const speaker: string = body?.speaker ?? "Speaker";
    if (!text.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

    // pick a voice by speaker label, fallback to PlayByPlay/Speaker
    const key =
      speaker.toLowerCase().includes("color") ? "Color" :
      speaker.toLowerCase().includes("play") ? "PlayByPlay" :
      speaker.toLowerCase().includes("analyst") ? "Analyst" : "Speaker";
    const voiceDef = VOICE_POOL[key];

    // Speak the text as-is (no prefixes)
    const sub = await fal.subscribe("fal-ai/playai/tts/dialog", {
      input: {
        input: text,               // <— no "PlayByPlay: " prefix
        voices: [ { voice: voiceDef.voice } ],
        response_format: "url",
        seed: null,
        // You can experiment with any optional prosody controls if Play.ai supports them:
        // speed: 1.02, pitch: 0, energy: "balanced"
      },
      logs: true,
    });

    const data = (sub as any)?.data ?? sub ?? {};
    const url =
      data?.audio?.url ?? data?.url ?? data?.output?.audio?.url ?? data?.result?.audio?.url ?? null;

    if (!url) return NextResponse.json({ error: "No audio URL in response", raw: data }, { status: 502 });

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
