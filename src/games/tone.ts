let ctx: AudioContext | null = null;
let muted = false;

export function setToneMuted(next: boolean) {
  muted = next;
  if (muted && ctx) {
    void ctx.suspend();
  }
}

export function unlockTone() {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
}

function envGain(at: number, peak: number, attack: number, release: number) {
  if (!ctx) return null;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  gain.connect(ctx.destination);
  return gain;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, slide = freq) {
  if (!ctx || muted) return;
  const at = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = envGain(at, peak, 0.008, dur);
  if (!gain) return;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), at + dur);
  osc.connect(gain);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export type Cue =
  | "ui"
  | "hit"
  | "sweet"
  | "bounce"
  | "score"
  | "fault"
  | "pocket"
  | "slide";

export function playCue(cue: Cue) {
  if (muted) return;
  unlockTone();
  if (!ctx) return;
  if (cue === "ui") tone(520, 0.05, "sine", 0.04, 740);
  if (cue === "hit") {
    tone(210, 0.07, "triangle", 0.07, 90);
    tone(640, 0.04, "square", 0.02, 240);
  }
  if (cue === "sweet") {
    tone(523, 0.08, "sine", 0.05, 660);
    tone(784, 0.1, "sine", 0.04, 880);
  }
  if (cue === "bounce") tone(160, 0.05, "sine", 0.05, 70);
  if (cue === "score") {
    tone(392, 0.09, "triangle", 0.06, 392);
    tone(523, 0.12, "triangle", 0.05, 784);
  }
  if (cue === "fault") tone(140, 0.16, "sine", 0.06, 70);
  if (cue === "pocket") tone(330, 0.12, "sine", 0.05, 180);
  if (cue === "slide") tone(240, 0.08, "triangle", 0.04, 120);
  if (typeof navigator !== "undefined" && cue === "hit") {
    navigator.vibrate?.(12);
  }
  if (typeof navigator !== "undefined" && cue === "score") {
    navigator.vibrate?.([16, 30, 20]);
  }
}
