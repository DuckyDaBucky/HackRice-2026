"use client";

import { useState } from "react";
import { VOICE_PRESETS } from "@/lib/voice/presets";

const CUSTOM_VALUE = "__custom__";

export function VoicePicker({
  voiceId,
  onChange,
}: {
  voiceId: string;
  onChange: (id: string) => void;
}) {
  const matchesPreset = VOICE_PRESETS.some((preset) => preset.id === voiceId);
  const [showCustomInput, setShowCustomInput] = useState(!matchesPreset);

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <label htmlFor="voice-select" className="text-sm font-medium text-dash-text">
        Interviewer voice
      </label>
      <select
        id="voice-select"
        value={showCustomInput ? CUSTOM_VALUE : voiceId}
        onChange={(event) => {
          if (event.target.value === CUSTOM_VALUE) {
            setShowCustomInput(true);
          } else {
            setShowCustomInput(false);
            onChange(event.target.value);
          }
        }}
        className="h-10 rounded-lg border border-dash-border-strong bg-dash-surface px-3 text-sm text-dash-text outline-none focus:border-accent"
      >
        {VOICE_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Custom voice ID…</option>
      </select>

      {showCustomInput && (
        <input
          type="text"
          value={matchesPreset ? "" : voiceId}
          onChange={(event) => onChange(event.target.value.trim())}
          placeholder="Paste an ElevenLabs voice ID"
          className="h-10 rounded-lg border border-dash-border-strong bg-dash-surface px-3 text-sm text-dash-text outline-none placeholder:text-dash-text-faint focus:border-accent"
        />
      )}
    </div>
  );
}
