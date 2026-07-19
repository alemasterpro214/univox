"use client";

let audioCtx: AudioContext | null = null;
let ringInterval: NodeJS.Timeout | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function playRingTone() {
  const ctx = ensureContext();
  if (!ctx) return;

  // Ensure the AudioContext is running; browsers suspend it until user interaction.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.setValueAtTime(880, now + 0.2);
  oscillator.frequency.setValueAtTime(698, now + 0.25);
  oscillator.frequency.setValueAtTime(698, now + 0.45);

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
  gainNode.gain.setValueAtTime(0.15, now + 0.2);
  gainNode.gain.linearRampToValueAtTime(0, now + 0.45);

  oscillator.start(now);
  oscillator.stop(now + 0.5);
}

export function startRingtone() {
  stopRingtone();
  playRingTone();
  ringInterval = setInterval(() => {
    playRingTone();
  }, 1500);
}

export function isRinging() {
  return ringInterval !== null;
}

export function stopRingtone() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}
