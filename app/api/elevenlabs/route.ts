import { NextRequest } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- tiny in-memory cache ----------
type CacheEntry = { buf: Buffer; at: number; size: number };
const CACHE_MAX_BYTES = 32 * 1024 * 1024; // ~32MB per instance
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

function cacheKey(text: string, voiceId: string, modelId: string, outputFormat: string) {
  const h = crypto.createHash("sha1");
  h.update(voiceId + "|" + modelId + "|" + outputFormat + "|" + text);
  return h.digest("hex");
}

function cacheGet(key: string): Buffer | null {
  const hit = cache.get(key);
  if (!hit) return null;
  hit.at = Date.now();
  return hit.buf;
}

function cacheSet(key: string, buf: Buffer) {
  const entry: CacheEntry = { buf, at: Date.now(), size: buf.byteLength };
  cache.set(key, entry);
  cacheBytes += entry.size;
  if (cacheBytes > CACHE_MAX_BYTES) {
    const items = [...cache.entries()].sort((a, b) => a[1].at - b[1].at); // oldest first
    for (const [k, v] of items) {
      if (cacheBytes <= CACHE_MAX_BYTES) break;
      cache.delete(k);
      cacheBytes -= v.size;
    }
  }
}

function getClient() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Missing ELEVENLABS_API_KEY. Add it to .env.local and restart.");
  return new ElevenLabsClient({ apiKey: key });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      text?: string;
      voiceId?: string;
      modelId?: string;
      outputFormat?: string;
    };

    const rawText = (body?.text ?? "").toString();
    if (!rawText.trim()) {
      return new Response(JSON.stringify({ error: 'Missing "text"' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // safe length guard (tune per plan)
    const MAX_CHARS = 2800;
    const text = rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;

    const voiceId = (body?.voiceId || "JBFqnCBsd6RMkjVDRZzb").toString();
    const modelId = (body?.modelId || "eleven_multilingual_v2").toString();

    // DEFAULT TO WAV for WebAudio decoding
    const outputFormat = (body?.outputFormat || "wav").toString(); // << key change

    // cache
    const key = cacheKey(text, voiceId, modelId, outputFormat);
    const cached = cacheGet(key);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      });
    }

    const client = getClient();
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat,
    });

    // coerce to Buffer
    const buf = Buffer.isBuffer(audio)
      ? audio
      : Buffer.from(await (audio as any).arrayBuffer?.() ?? []);

    cacheSet(key, buf);

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const detail =
      err?.response?.data ? JSON.stringify(err.response.data) :
      err?.message ?? "Unknown server error";
    console.error("TTS route error:", detail);
    return new Response(JSON.stringify({ error: "TTS failed", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
