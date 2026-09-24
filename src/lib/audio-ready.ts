// Helpers that hold playback until the device can actually produce sound.
// Phones (and Bluetooth outputs) can report an AudioContext as "running" before
// audio really reaches the speaker, which clips the first word of a clip.

/** Extra lead-in after the output is live, in seconds. */
export const LEAD_IN_S = 0.15
/** Never wait longer than this, so playback can't hang. */
export const MAX_WAIT_MS = 800

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Resolves once the element has buffered enough to play through. */
export function whenBuffered(audio: HTMLMediaElement, maxMs = 1500): Promise<void> {
  // 4 = HAVE_ENOUGH_DATA (literal: some DOM implementations omit the constant).
  if (audio.readyState >= 4) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      audio.removeEventListener('canplaythrough', done)
      resolve()
    }
    const timer = setTimeout(done, maxMs)
    audio.addEventListener('canplaythrough', done, { once: true })
  })
}

/**
 * Resolves once the context clock has advanced past the lead-in plus the
 * device's reported output latency. The clock only advances while the audio
 * hardware is rendering, so this is a real signal, not a fixed guess. After the
 * first play the clock is already far ahead, so this returns immediately.
 */
export async function whenOutputLive(
  ctx: BaseAudioContext & { outputLatency?: number; baseLatency?: number },
  maxMs = MAX_WAIT_MS
): Promise<void> {
  const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
  const target = LEAD_IN_S + latency
  const deadline = performance.now() + maxMs
  while (ctx.currentTime < target && performance.now() < deadline) await sleep(20)
}

/** Plays a few ms of silence so the device starts its output now (call in a click). */
export function primeOutput(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
  } catch {
    // Priming is best effort.
  }
}
