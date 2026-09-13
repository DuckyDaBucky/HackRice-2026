"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared device enumeration for the lobby and settings. Labels stay empty
 * until permission is granted — `detect()` opens a momentary stream purely
 * to reveal them, then releases it.
 */
export function useMediaDeviceList() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  const refresh = useCallback(async () => {
    try {
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      // Leave the last-known list in place.
    }
  }, []);

  const detect = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      await refresh();
      return true;
    } catch {
      setPermission("denied");
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  return { devices, permission, refresh, detect };
}
