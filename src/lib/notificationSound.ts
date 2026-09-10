const SOUND_PREF_KEY = 'pkl_mini_mart_order_sound'

export function isOrderSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_PREF_KEY) !== 'off'
}

export function setOrderSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_PREF_KEY, enabled ? 'on' : 'off')
}

let audioContext: AudioContext | null = null

/** Must be called from a user gesture (e.g. toggling the sound switch on) to
 *  satisfy browser autoplay restrictions — later programmatic beeps (from a
 *  realtime event, with no user gesture) then work within the same session. */
export function unlockNotificationSound() {
  if (audioContext) return
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  audioContext = new Ctor()
}

/** Plays a short synthesized beep — no audio file/asset needed. Silently
 *  does nothing if the browser hasn't granted audio playback yet. */
export function playNotificationBeep() {
  if (!isOrderSoundEnabled() || !audioContext) return
  try {
    const ctx = audioContext
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Autoplay/other audio restriction — fail silently, the visual toast still shows.
  }
}
