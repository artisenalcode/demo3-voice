import { beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  cacheKey,
  clearMemoryCacheForTests,
  getCached,
  normaliseText,
  putCached
} from '@/lib/tts-cache'

describe('tts-cache', () => {
  beforeEach(() => clearMemoryCacheForTests())

  it('ignores whitespace-only changes', async () => {
    expect(normaliseText('  The  quick\nfox ')).toBe('The quick fox')
    expect(await cacheKey('The  quick fox', 'bf_alice')).toBe(
      await cacheKey(' The quick fox ', 'bf_alice')
    )
  })

  it('changes key when the words or the voice change', async () => {
    const base = await cacheKey('The quick fox', 'bf_alice')
    expect(await cacheKey('The quick foxes', 'bf_alice')).not.toBe(base)
    expect(await cacheKey('The quick fox', 'am_onyx')).not.toBe(base)
  })

  it('stores and returns clips, keeping at most 20', async () => {
    for (let i = 0; i < 25; i++) await putCached(`k${i}`, new Blob([String(i)]))
    expect(await getCached('k0')).toBeNull()
    expect(await getCached('k24')).not.toBeNull()
  })
})
