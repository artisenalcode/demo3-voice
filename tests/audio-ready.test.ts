import { describe, expect, it } from 'vite-plus/test'

import { LEAD_IN_S, whenOutputLive } from '@/lib/audio-ready'

// A fake context whose clock advances a set amount per 20 ms tick.
function fakeCtx(stepS: number, start = 0, outputLatency = 0) {
  let t = start
  const ctx = {
    get currentTime() {
      t += stepS
      return t
    },
    outputLatency,
    baseLatency: 0
  }
  return ctx as unknown as BaseAudioContext
}

describe('whenOutputLive', () => {
  it('returns at once when the output has been running a while (replays)', async () => {
    const t0 = performance.now()
    await whenOutputLive(fakeCtx(0, 5))
    expect(performance.now() - t0).toBeLessThan(15)
  })

  it('waits for the clock to pass the lead-in plus output latency (cold phone)', async () => {
    const ctx = fakeCtx(0.02, 0, 0.1)
    await whenOutputLive(ctx)
    expect((ctx as unknown as { currentTime: number }).currentTime).toBeGreaterThanOrEqual(
      LEAD_IN_S + 0.1
    )
  })

  it('gives up after the cap if the clock never moves', async () => {
    const t0 = performance.now()
    await whenOutputLive(fakeCtx(0, 0), 200)
    const waited = performance.now() - t0
    expect(waited).toBeGreaterThanOrEqual(190)
    expect(waited).toBeLessThan(400)
  })
})
