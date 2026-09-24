import { describe, expect, test } from 'bun:test'
import { DailyBudget, MAX_CHARS, RateLimiter, validateRequest } from './lib'

describe('validateRequest', () => {
  test('accepts valid input and trims text', () => {
    const r = validateRequest({ text: '  hello  ', voice: 'af_alloy' })
    expect(r).toEqual({ ok: true, value: { text: 'hello', voice: 'af_alloy' } })
  })
  test('rejects non-objects, empty text, long text and unknown voices', () => {
    expect(validateRequest(null).ok).toBe(false)
    expect(validateRequest('hi').ok).toBe(false)
    expect(validateRequest({ text: '   ', voice: 'af_alloy' }).ok).toBe(false)
    expect(validateRequest({ text: 'x'.repeat(MAX_CHARS + 1), voice: 'af_alloy' }).ok).toBe(false)
    expect(validateRequest({ text: 'hi', voice: '../etc' }).ok).toBe(false)
    expect(validateRequest({ text: 42, voice: 'af_alloy' }).ok).toBe(false)
  })
})

describe('RateLimiter', () => {
  test('blocks after the limit and resets after the window', () => {
    const rl = new RateLimiter(2, 1000, 10)
    expect(rl.allow('a', 0)).toBe(true)
    expect(rl.allow('a', 1)).toBe(true)
    expect(rl.allow('a', 2)).toBe(false)
    expect(rl.allow('a', 1001)).toBe(true)
  })
  test('never tracks more than maxClients', () => {
    const rl = new RateLimiter(1, 60_000, 3)
    for (let i = 0; i < 100; i++) rl.allow(`ip${i}`, 0)
    expect(rl.size).toBeLessThanOrEqual(3)
  })
})

describe('DailyBudget', () => {
  test('caps characters per day and resets at the next UTC day', () => {
    const b = new DailyBudget(10)
    const day1 = new Date('2026-09-24T10:00:00Z')
    expect(b.reserve(6, day1)).toBe(true)
    expect(b.reserve(5, day1)).toBe(false)
    expect(b.reserve(4, day1)).toBe(true)
    expect(b.reserve(1, new Date('2026-09-25T00:00:01Z'))).toBe(true)
  })
})
