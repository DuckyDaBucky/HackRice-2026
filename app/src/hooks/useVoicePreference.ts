"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";

const STORAGE_KEY = "interview.voiceId";

export interface UseVoicePreference {
  voiceId: string;
  setVoiceId: (id: string) => void;
}

export function useVoicePreference(): UseVoicePreference {
  const [voiceId, setVoiceIdState] = useState(DEFAULT_VOICE_ID);

  // Deliberately deferred to an effect rather than a lazy useState
  // initializer: this component is server-rendered first (window is
  // undefined there), so starting from the same default on both server
  // and initial client render avoids a hydration mismatch on the voice
  // <select>. Reading localStorage during render would produce a
  // different value client-side than what the server sent.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== voiceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe read from localStorage, not a derived-state reset
      setVoiceIdState(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time mount read, must not re-run when voiceId changes
  }, []);

  const setVoiceId = useCallback((id: string) => {
    setVoiceIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { voiceId, setVoiceId };
}
