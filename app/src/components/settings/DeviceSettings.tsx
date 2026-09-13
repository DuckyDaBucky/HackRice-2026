"use client";

import { useState } from "react";
import Link from "next/link";
import { useMediaDeviceList } from "@/hooks/useMediaDeviceList";
import { playTestTone } from "@/lib/media/test-tone";
import {
  AUDIO_DEVICE_KEY,
  OUTPUT_DEVICE_KEY,
  VIDEO_DEVICE_KEY,
  friendlyDeviceLabel,
  readDeviceId,
  storeDeviceId,
} from "@/lib/media/devices";

const selectClass =
  "h-10 w-full rounded-lg border border-dash-border-strong bg-dash-surface px-3 text-sm text-dash-text outline-none focus:border-accent";

/** Input & output section: same device choices as the pre-call lobby, without needing a call. */
export function DeviceSettings() {
  const { devices, detect } = useMediaDeviceList();
  const [videoId, setVideoId] = useState<string | null>(() => readDeviceId(VIDEO_DEVICE_KEY));
  const [audioId, setAudioId] = useState<string | null>(() => readDeviceId(AUDIO_DEVICE_KEY));
  const [outputId, setOutputId] = useState<string | null>(() => readDeviceId(OUTPUT_DEVICE_KEY));
  const [detecting, setDetecting] = useState(false);
  const [toneNote, setToneNote] = useState<string | null>(null);

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");
  const labeled = devices.some((d) => d.label);

  const pick = (key: string, set: (v: string | null) => void) => (value: string) => {
    const next = value || null;
    set(next);
    storeDeviceId(key, next);
  };

  return (
    <section aria-labelledby="settings-devices" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="settings-devices" className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
          Input & output
        </h2>
        {!labeled && (
          <button
            type="button"
            onClick={() => {
              setDetecting(true);
              void detect().finally(() => setDetecting(false));
            }}
            disabled={detecting}
            className="text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent disabled:opacity-50"
          >
            {detecting ? "Detecting…" : "Detect my devices"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dash-text">
          Camera
          <select aria-label="Camera" value={videoId ?? ""} onChange={(e) => pick(VIDEO_DEVICE_KEY, setVideoId)(e.target.value)} className={selectClass}>
            <option value="">Default camera</option>
            {cameras.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>{friendlyDeviceLabel(d, i)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dash-text">
          Microphone
          <select aria-label="Microphone" value={audioId ?? ""} onChange={(e) => pick(AUDIO_DEVICE_KEY, setAudioId)(e.target.value)} className={selectClass}>
            <option value="">Default microphone</option>
            {microphones.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>{friendlyDeviceLabel(d, i)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dash-text">
          Speaker
          <select aria-label="Speaker" value={outputId ?? ""} onChange={(e) => pick(OUTPUT_DEVICE_KEY, setOutputId)(e.target.value)} className={selectClass}>
            <option value="">Default speaker</option>
            {speakers.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>{friendlyDeviceLabel(d, i)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            void playTestTone(outputId).then((result) => {
              if (!result.played) setToneNote("Could not play the test sound.");
              else if (result.usedFallbackOutput) setToneNote("Played on your default speaker — this browser can't switch outputs.");
              else setToneNote(null);
            })
          }
          className="inline-flex h-9 items-center rounded-md border border-dash-border-strong px-4 text-sm font-medium text-dash-text transition-colors duration-150 hover:bg-dash-surface-hover"
        >
          Play test sound
        </button>
        <Link href="/interview/setup" className="text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent">
          Full mic & camera check before a call
        </Link>
      </div>
      {toneNote && <p role="status" className="text-xs text-dash-text-muted">{toneNote}</p>}
      {!labeled && (
        <p className="text-xs leading-relaxed text-dash-text-faint">
          Device names appear after detection — browsers hide them until you grant microphone or camera access.
        </p>
      )}
    </section>
  );
}
