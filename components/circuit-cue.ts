import { tickFrequency, type CueName } from "@/lib/circuit-cues";

export type CuePrefs = { enabled: boolean; volume: number };

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let prefs: CuePrefs = { enabled: true, volume: 0.7 };

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function setCuePrefs(next: CuePrefs) {
  prefs = {
    enabled: next.enabled,
    volume: Math.min(1, Math.max(0, next.volume)),
  };
  if (master && audio) {
    master.gain.setValueAtTime(prefs.enabled ? prefs.volume : 0, audio.currentTime);
  }
}

/** Ambient mix keeps short cues from taking over music that is already playing. */
function primeAmbient() {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session) session.type = "ambient";
  } catch {
    /* Older browsers have no audio session. */
  }
}

function audioContext() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  primeAmbient();
  if (!audio) audio = new Ctx();
  return audio;
}

function output(ctx: AudioContext) {
  if (!master || master.context !== ctx) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  master.gain.setValueAtTime(prefs.enabled ? prefs.volume : 0, ctx.currentTime);
  return master;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  frequency: number,
  when: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + Math.min(0.03, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function vibrate(kind: CueName) {
  try {
    if (kind === "tick") navigator.vibrate?.(18);
    else if (kind === "finish") navigator.vibrate?.(40);
    else navigator.vibrate?.([24, 40, 24, 40, 70]);
  } catch {
    /* iOS Safari has no vibration API. */
  }
}

/** Call from a tap, including Start, so later cues can play on iOS. */
export function unlockCue() {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(output(ctx));
    src.start();
  } catch {
    /* Safari can refuse audio until a later gesture. */
  }
}

export function playCue(kind: CueName, secondsLeft = 1) {
  vibrate(kind);
  try {
    if (!prefs.enabled || prefs.volume <= 0) return;
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const dest = output(ctx);
    const now = ctx.currentTime;
    if (kind === "tick") {
      const last = secondsLeft <= 1;
      tone(ctx, dest, tickFrequency(secondsLeft), now, last ? 0.16 : 0.09, last ? 0.2 : 0.12, "triangle");
      return;
    }
    if (kind === "finish") {
      tone(ctx, dest, 523.25, now, 0.42, 0.16);
      tone(ctx, dest, 659.25, now + 0.1, 0.4, 0.14);
      tone(ctx, dest, 783.99, now + 0.2, 0.5, 0.16);
      tone(ctx, dest, 1567.98, now + 0.2, 0.35, 0.04, "triangle");
      return;
    }
    tone(ctx, dest, 196, now, 1.05, 0.05, "triangle");
    tone(ctx, dest, 392, now, 0.4, 0.12);
    tone(ctx, dest, 523.25, now + 0.12, 0.42, 0.13);
    tone(ctx, dest, 659.25, now + 0.24, 0.48, 0.14);
    tone(ctx, dest, 783.99, now + 0.36, 0.55, 0.15);
    tone(ctx, dest, 1046.5, now + 0.5, 0.85, 0.16);
    tone(ctx, dest, 1567.98, now + 0.5, 0.7, 0.04, "triangle");
  } catch {
    /* No audio output. */
  }
}
