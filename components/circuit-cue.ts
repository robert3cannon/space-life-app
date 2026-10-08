let audio: AudioContext | null = null;

function audioContext() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  return audio;
}

/** Call from a tap so later cues can play on iOS. Missing audio or vibration is ignored. */
export function unlockCue() {
  try {
    const ctx = audioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    /* Safari can refuse audio until a later gesture. */
  }
}

export function playCue() {
  try {
    const ctx = audioContext();
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    }
  } catch {
    /* No audio output. */
  }
  try {
    navigator.vibrate?.(70);
  } catch {
    /* iOS Safari has no vibration API. */
  }
}
