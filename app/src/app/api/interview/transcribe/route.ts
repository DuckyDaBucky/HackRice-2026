import type { TranscribeResponse } from "@/lib/transcription/types";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

async function transcribeWithDeepgram(
  apiKey: string,
  audio: ArrayBuffer,
  mimeType: string,
): Promise<TranscribeResponse | null> {
  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&utterances=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": mimeType || "audio/webm",
      },
      body: audio,
    },
  );
  if (!response.ok) {
    console.error("Deepgram transcription failed", response.status, await response.text());
    return null;
  }
  const data = await response.json();
  const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
  const transcript =
    typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
  if (!transcript) return null;
  return {
    transcript,
    confidence: typeof alternative?.confidence === "number" ? alternative.confidence : null,
    provider: "deepgram",
  };
}

async function transcribeWithGemini(
  apiKey: string,
  audio: ArrayBuffer,
  mimeType: string,
): Promise<TranscribeResponse | null> {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const base64 = Buffer.from(audio).toString("base64");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: { mimeType: mimeType || "audio/webm", data: base64 },
              },
              {
                text: "Transcribe this interview answer verbatim. Return only the spoken words with punctuation, no summary, no speaker labels, no added commentary.",
              },
            ],
          },
        ],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 128 },
        },
      }),
    },
  );
  if (!response.ok) {
    console.error("Gemini transcription failed", response.status, await response.text());
    return null;
  }
  const data = await response.json();
  const parts: Array<{ text?: string }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const transcript = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  if (!transcript) return null;
  return { transcript, confidence: null, provider: "gemini" };
}

/**
 * Batch-corrects one recorded answer. The client uploads the MediaRecorder
 * blob; the server transcribes the full clip (Deepgram preferred, Gemini
 * audio fallback) and returns a verbatim transcript. Live Web Speech captions
 * stay as the provisional in-call display — this route supplies the durable
 * transcript saved with the answer.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart audio upload" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "audio file is required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio file is empty or too large" }, { status: 413 });
  }

  const audio = await file.arrayBuffer();
  const mimeType = file.type || "audio/webm";

  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (deepgramKey) {
    try {
      const result = await transcribeWithDeepgram(deepgramKey, audio, mimeType);
      if (result) return Response.json(result);
    } catch (error) {
      console.error("Deepgram transcription errored", error);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const result = await transcribeWithGemini(geminiKey, audio, mimeType);
      if (result) return Response.json(result);
    } catch (error) {
      console.error("Gemini transcription errored", error);
    }
  }

  return Response.json(
    { error: "Transcription is not configured (set DEEPGRAM_API_KEY or GEMINI_API_KEY)" },
    { status: 503 },
  );
}
