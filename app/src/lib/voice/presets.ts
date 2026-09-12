export interface VoicePreset {
  id: string;
  label: string;
}

/**
 * ElevenLabs' long-standing "premade" voices, available on every account.
 * IDs are historically stable but not verified against a live account in
 * this repo (no API key available yet — see docs/21-live-interview-voice.md).
 * The UI always allows pasting a custom voice ID too, so a stale preset
 * here doesn't block the feature.
 */
export const VOICE_PRESETS: VoicePreset[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold" },
];

export const DEFAULT_VOICE_ID = VOICE_PRESETS[0].id;
