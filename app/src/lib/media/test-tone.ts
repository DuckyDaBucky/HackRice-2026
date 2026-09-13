type SinkableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> };

export interface TestToneResult {
  played: boolean;
  /** True when a specific output was requested but the browser couldn't route to it. */
  usedFallbackOutput: boolean;
}

/** Plays a short 660Hz tone, routed to the chosen output where supported. */
export async function playTestTone(outputDeviceId: string | null): Promise<TestToneResult> {
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return { played: false, usedFallbackOutput: false };
    const context = new Context();
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 660;
    const gain = context.createGain();
    gain.gain.value = 0.12;
    oscillator.connect(gain);
    const destination = context.createMediaStreamDestination();
    gain.connect(destination);
    const audio: SinkableAudio = new Audio();
    audio.srcObject = destination.stream;
    let usedFallbackOutput = false;
    if (outputDeviceId) {
      if (typeof audio.setSinkId === "function") {
        await audio.setSinkId(outputDeviceId);
      } else {
        usedFallbackOutput = true;
      }
    }
    await audio.play().catch(() => undefined);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 900);
    return { played: true, usedFallbackOutput };
  } catch {
    return { played: false, usedFallbackOutput: false };
  }
}
