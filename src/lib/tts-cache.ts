// Local cache of generated audio, so replaying unchanged text never costs a
// second request. Uses Cache Storage (survives reloads) when available, and an
// in-memory map otherwise. Both are bounded to MAX_ENTRIES, oldest out first.

const CACHE_NAME = 'chatterbox-tts-v1'
const MAX_ENTRIES = 20

const memory = new Map<string, Blob>()

// "No word changes" means the same words in the same order: extra spaces and
// line breaks don't count as a change.
export function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export async function cacheKey(text: string, voice: string): Promise<string> {
  const input = `${voice}\n${normaliseText(text)}`
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input))
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    return `/__tts-cache/${hex}`
  }
  // Fallback for non-secure contexts: FNV-1a, fine for a local cache key.
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `/__tts-cache/fnv-${(h >>> 0).toString(16)}-${input.length}`
}

async function openCache(): Promise<Cache | null> {
  try {
    return 'caches' in globalThis ? await caches.open(CACHE_NAME) : null
  } catch {
    return null // e.g. storage blocked in a private window
  }
}

export async function getCached(key: string): Promise<Blob | null> {
  const hit = memory.get(key)
  if (hit) return hit
  const cache = await openCache()
  const res = await cache?.match(key).catch(() => undefined)
  if (!res) return null
  const blob = await res.blob()
  remember(key, blob)
  return blob
}

export async function putCached(key: string, blob: Blob): Promise<void> {
  remember(key, blob)
  const cache = await openCache()
  if (!cache) return
  try {
    await cache.put(key, new Response(blob, { headers: { 'content-type': blob.type } }))
    const keys = await cache.keys()
    for (const request of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) {
      await cache.delete(request)
    }
  } catch {
    // Quota or storage errors: the in-memory copy still serves this session.
  }
}

function remember(key: string, blob: Blob): void {
  memory.delete(key)
  memory.set(key, blob)
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value
    if (oldest === undefined) break
    memory.delete(oldest)
  }
}

export function clearMemoryCacheForTests(): void {
  memory.clear()
}
