// app/api/elevenlabs/route.ts
import { NextRequest } from 'next/server';
import { ElevenLabsClient } from 'elevenlabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// lazy / safe client getter so import doesn't crash
function getClient() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      'Missing ELEVENLABS_API_KEY. Add it to .env.local and restart the dev server.'
    );
  }
  return new ElevenLabsClient({ apiKey: key });
}

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing "text"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = getClient();

    const voiceId = 'JBFqnCBsd6RMkjVDRZzb';
    const modelId = 'eleven_multilingual_v2';

    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: 'mp3_44100_128',
    });

    return new Response(audio as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    // return JSON so the client can show the message, not the dev HTML page
    const message =
      err?.message ??
      'Unknown error (check server console). Ensure ELEVENLABS_API_KEY is set.';
    console.error('TTS route error:', err);
    return new Response(JSON.stringify({ error: 'TTS failed', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
