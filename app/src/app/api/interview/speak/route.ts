import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";
import { isInterviewMood, type InterviewMood } from "@/lib/interview-config";

// ElevenLabs voice IDs are opaque alphanumeric identifiers. This isn't
// their real format spec, just a sanity check before it goes into a URL.
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;

// stability: lower = more expressive/variable delivery. style: higher =
// more exaggerated delivery style. Real ElevenLabs voice_settings, not
// cosmetic — this is the actual lever "mood" has on the interviewer's voice.
const MOOD_VOICE_SETTINGS: Record<InterviewMood, { stability: number; style: number }> = {
  supportive: { stability: 0.75, style: 0.15 },
  neutral: { stability: 0.5, style: 0 },
  challenging: { stability: 0.3, style: 0.5 },
};

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY is not configured");
    return Response.json({ error: "Text-to-speech is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, voiceId: requestedVoiceId, mood } = (body ?? {}) as {
    text?: unknown;
    voiceId?: unknown;
    mood?: unknown;
  };
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }
  if (requestedVoiceId !== undefined && typeof requestedVoiceId !== "string") {
    return Response.json({ error: "voiceId must be a string" }, { status: 400 });
  }
  const voiceSettings = MOOD_VOICE_SETTINGS[isInterviewMood(mood) ? mood : "neutral"];

  // Chosen in-app on the lobby screen (see useVoicePreference) takes
  // precedence over the server-side default, so voice choice never needs
  // a redeploy.
  const voiceId =
    typeof requestedVoiceId === "string" && VOICE_ID_PATTERN.test(requestedVoiceId)
      ? requestedVoiceId
      : process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok || !response.body) {
      console.error("ElevenLabs TTS request failed", response.status, await response.text());
      return Response.json({ error: "Text-to-speech request failed" }, { status: 502 });
    }

    return new Response(response.body, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    console.error("ElevenLabs TTS request errored", error);
    return Response.json({ error: "Text-to-speech request errored" }, { status: 502 });
  }
}
