// Pure request-guarding logic for the TTS proxy: input validation, per-IP rate
// limiting and a daily spend cap. Kept free of I/O so it can be unit tested.

export const MAX_CHARS = 500

// English Kokoro voices, confirmed against OpenRouter's hexgrad/kokoro-82m listing.
export const VOICES = new Set(['af_alloy', 'am_onyx', 'bf_alice', 'bm_daniel'])

export type TtsRequest = { text: string; voice: string }
export type Validation = { ok: true; value: TtsRequest } | { ok: false; error: string }

// Boundary validation: nothing unvalidated reaches the upstream call.
export function validateRequest(body: unknown): Validation {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Send a JSON object with "text" and "voice".' }
  }
  const { text, voice } = body as Record<string, unknown>
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'Type some text to speak.' }
  }
  const trimmed = text.trim()
  if (trimmed.length > MAX_CHARS) {
    return { ok: false, error: `Keep it to ${MAX_CHARS} characters or fewer.` }
  }
  if (typeof voice !== 'string' || !VOICES.has(voice)) {
    return { ok: false, error: 'Choose one of the listed voices.' }
  }
  return { ok: true, value: { text: trimmed, voice } }
}

// Fixed-window limiter with a hard cap on tracked clients, so memory stays
// bounded even under a flood of distinct IPs.
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxClients: number
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key)
    if (entry && entry.resetAt > now) {
      if (entry.count >= this.limit) return false
      entry.count++
      return true
    }
    if (entry) this.hits.delete(key)
    if (this.hits.size >= this.maxClients) this.evict(now)
    this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
    return true
  }

  get size(): number {
    return this.hits.size
  }

  private evict(now: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key)
    }
    // Still full: drop the oldest entries (Map keeps insertion order).
    for (const key of this.hits.keys()) {
      if (this.hits.size < this.maxClients) break
      this.hits.delete(key)
    }
  }
}

// Caps characters sent upstream per UTC day. Kokoro 82M is billed per character,
// so this caps the daily spend.
export class DailyBudget {
  private day = ''
  private used = 0

  constructor(private readonly maxChars: number) {}

  reserve(chars: number, now = new Date()): boolean {
    const today = now.toISOString().slice(0, 10)
    if (today !== this.day) {
      this.day = today
      this.used = 0
    }
    if (this.used + chars > this.maxChars) return false
    this.used += chars
    return true
  }
}
