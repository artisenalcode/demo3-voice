# Chatterbox

Type text, pick a voice, hear it spoken. A text-to-voice demo at [demo3.starandstream.com](https://demo3.starandstream.com).

![Chatterbox logo](public/chatterbox-192.png)

## Stack

| Layer | Choice |
|---|---|
| Front end | Astro 7, React 19 island, shadcn/ui (Radix), Tailwind CSS 4 |
| Design | Proportional Humanism tokens: warm paper (#F6F4EF), ink (#1F2430), burnt orange (#C2410C); WCAG 2.2 AA |
| Voice | [Kokoro 82M](https://openrouter.ai/hexgrad/kokoro-82m) via OpenRouter's `/api/v1/audio/speech`, about US$0.62 per million characters |
| API | `voice-api/`: Bun running TypeScript directly, in an Alpine container (~88 MB) |
| Toolchain | Bun, Vite+ (`vp`) for lint, format and tests |
| Hosting | nginx on the VPS, Podman, Let's Encrypt; GitHub Actions deploy |

The logo was generated with Meta's Muse Image through OpenRouter (US$0.01 per image), then trimmed and resized with ImageMagick.

## How it works

1. **Speak:** the React island posts `{ text, voice }` to `/api/tts`. nginx proxies it to the `voice-api` container, which calls OpenRouter and streams the MP3 back. Playback starts as soon as it arrives.
2. **Replay:** each clip is cached in the browser (Cache Storage, falling back to memory), keyed by a SHA-256 hash of the voice plus the text with whitespace normalised. Unchanged words replay instantly with no new request, even after a reload. The cache keeps the 20 most recent clips.

## Guardrails

The demo is public, so the API protects the key and the bill:

- Input validated at the boundary: 1–500 characters, voice from a fixed list, 4 KB body limit.
- 10 requests per visitor per 10 minutes, with a bounded client table.
- A daily character budget (default 200,000 characters, about US$0.12 a day).
- The OpenRouter key never reaches the browser.
- Strict CSP: Astro's inline island scripts are hashed at deploy time; fonts are self-hosted.

## Develop

```sh
bun install
bun run test          # front-end tests (Vite+ / Vitest, happy-dom)
bun run test:api      # API tests (bun test)

# Terminal 1: the API
cd voice-api && OPENROUTER_API_KEY=... PORT=3013 bun run src/index.ts
# Terminal 2: the site (dev server proxies /api/tts to :3013)
bun run dev
```

Voices: `af_alloy`, `am_onyx`, `bf_alice` (default), `bm_daniel`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, following the other Star and Stream sites: build with Bun, sync `dist/` to nginx, hash inline scripts into the CSP, build and run the API container on loopback port 3013, reload nginx. The first deploy bootstraps the TLS certificate before installing the HTTPS config.

**Required GitHub Actions secrets:** `VPS_IP`, `VPS_USERNAME`, `VPS_SSH_KEY`.

**Before the first deploy:**

1. Point a DNS A record for `demo3.starandstream.com` at the VPS.
2. Add `OPENROUTER_API_KEY` for `demo3` to the encrypted `/data/secrets` store. The deploy renders it to `/data/env/demo3.env` and passes it to the container with `--env-file`, so GitHub Actions never handles the key. The deploy stops with a clear error if the key is missing.
