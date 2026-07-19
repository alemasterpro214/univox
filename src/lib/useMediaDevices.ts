"use client";

import { useEffect, useState, useCallback } from "react";

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: "audioinput" | "videoinput" | "audiooutput";
}

export type MediaPermissionState = "prompt" | "granted" | "denied" | "unknown";

export function useMediaDevices(requireVideo = false) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = useState<MediaPermissionState>("prompt");

  const enumerateDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const mapped: MediaDeviceInfo[] = all
        .filter((d) => d.kind !== "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label:
            d.label ||
            `${d.kind === "audioinput" ? "Microfono" : "Telecamera"} ${d.deviceId.slice(0, 4)}`,
          kind: d.kind as "audioinput" | "videoinput" | "audiooutput",
        }));
      setDevices(mapped);
    } catch {
      setDevices([]);
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: requireVideo,
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      await enumerateDevices();
      return true;
    } catch (err) {
      // Distinguish between a real denial and a NotAllowedError caused by
      // missing user gesture / prompt cancellation.
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermission("denied");
        } else {
          setPermission("unknown");
        }
      } else {
        setPermission("unknown");
      }
      return false;
    }
  }, [requireVideo, enumerateDevices]);

  useEffect(() => {
    let mounted = true;

    async function loadDevices() {
      // Try to enumerate without forcing a permission prompt first.
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!mounted) return;

        // If labels are present, permissions have already been granted.
        const hasLabels = all.some((d) => d.label && d.kind !== "audiooutput");
        if (hasLabels) {
          setPermission("granted");
        }

        const mapped: MediaDeviceInfo[] = all
          .filter((d) => d.kind !== "audiooutput")
          .map((d) => ({
            deviceId: d.deviceId,
            label:
              d.label ||
              `${d.kind === "audioinput" ? "Microfono" : "Telecamera"} ${d.deviceId.slice(0, 4)}`,
            kind: d.kind as "audioinput" | "videoinput" | "audiooutput",
          }));

        setDevices(mapped);
      } catch {
        setDevices([]);
      }
    }

    loadDevices();

    const handler = () => {
      loadDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handler);

    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, []);

  return { devices, permission, requestPermissions, enumerateDevices };
}
