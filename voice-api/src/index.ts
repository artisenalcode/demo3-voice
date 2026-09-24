// Text-to-speech proxy for demo3.starandstream.com. Holds the OpenRouter key
// server-side, validates input, rate-limits, caps daily spend, and streams the
// MP3 straight through to the browser.
import { DailyBudget, RateLimiter, validateRequest } from './lib'

const PORT = Number(process.env.PORT ?? 3000)
const API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = process.env.TTS_MODEL ?? 'hexgrad/kokoro-82m'
const UPSTREAM_URL = 'https://openrouter.ai/api/v1/audio/speech'
const UPSTREAM_TIMEOUT_MS = 20_000

// 200,000 chars/day ≈ US$0.12/day at Kokoro 82M's US$0.62 per million characters.
const budget = new DailyBudget(Number(process.env.DAILY_CHAR_BUDGET ?? 200_000))
// 10 requests per visitor per 10 minutes; at most 5,000 visitors tracked at once.
const limiter = new RateLimiter(10, 10 * 60_000, 5_000)

if (!API_KEY) {
  console.error('OPENROUTER_API_KEY is not set')
  process.exit(1)
}

function json(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } })
}

async function handleTts(req: Request): Promise<Response> {
  // nginx is the only caller (loopback-bound port) and sets X-Real-IP.
  const ip = req.headers.get('x-real-ip') ?? 'unknown'
  if (!limiter.allow(ip)) return json(429, 'Too many requests. Try again in a few minutes.')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, 'Send a JSON object with "text" and "voice".')
  }
  const result = validateRequest(body)
  if (!result.ok) return json(400, result.error)

  const { text, voice } = result.value
  if (!budget.reserve(text.length)) {
    return json(503, "Today's demo budget is used up. Try again tomorrow.")
  }

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'demo3.starandstream.com'
      },
      body: JSON.stringify({ model: MODEL, input: text, voice, response_format: 'mp3' }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    })
  } catch (err) {
    console.error('upstream request failed', err)
    return json(502, 'The voice service did not respond. Try again.')
  }

  if (!upstream.ok || !upstream.body) {
    console.error('upstream error', upstream.status, await upstream.text().catch(() => ''))
    return json(502, 'The voice service returned an error. Try again.')
  }

  // Stream the audio through without buffering it in memory.
  return new Response(upstream.body, {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' }
  })
}

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: 4 * 1024,
  fetch(req) {
    const { pathname } = new URL(req.url)
    if (pathname === '/health') return new Response('ok')
    if (pathname === '/tts') {
      if (req.method !== 'POST') return json(405, 'Use POST.')
      return handleTts(req)
    }
    return json(404, 'Not found.')
  }
})

console.log(`voice-api listening on :${PORT} using ${MODEL}`)

// Bun runs as PID 1 in the container, so handle stop signals explicitly;
// otherwise `podman stop` waits 10 seconds and then kills it.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void server.stop().finally(() => process.exit(0))
  })
}
