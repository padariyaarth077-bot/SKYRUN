// Original synthesized tones; no third-party audio or autoplay bypass.
let audio: AudioContext | undefined;
let unlocked = false;
export async function unlockNotificationAudio() {
  try {
    audio ??= new AudioContext();
    await audio.resume();
    unlocked = audio.state === "running";
    return unlocked;
  } catch {
    unlocked = false;
    return false;
  }
}
export function playNotificationSound(severity: "NORMAL" | "IMPORTANT" | "URGENT", volume: number) {
  if (!unlocked || !audio || audio.state !== "running" || volume <= 0) return false;
  try {
    const frequencies =
      severity === "URGENT" ? [660, 440, 660] : severity === "IMPORTANT" ? [587, 784] : [660, 880];
    frequencies.forEach((frequency, index) => {
      const oscillator = audio!.createOscillator(),
        gain = audio!.createGain(),
        start = audio!.currentTime + index * 0.13;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(Math.max(volume, 0), 1) * 0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain);
      gain.connect(audio!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
    return true;
  } catch {
    unlocked = false;
    return false;
  }
}
export function closeNotificationAudio() {
  void audio?.close().catch(() => {});
  audio = undefined;
  unlocked = false;
}
