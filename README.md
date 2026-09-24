# demo3-voice

A quick text-to-voice demo for [demo3.starandstream.com](https://demo3.starandstream.com): type text, pick a voice, hear it spoken.

- **Model:** [Kokoro 82M](https://openrouter.ai/hexgrad/kokoro-82m) through OpenRouter's `/api/v1/audio/speech` endpoint, about US$0.62 per million characters.
- **Front end:** static HTML, CSS and one script in `public/`. No framework, no build step.
- **Back end:** `voice-api/`, a small Bun service in an Alpine container (~88 MB). It holds the OpenRouter key server-side and streams the MP3 back to the browser.

## Guardrails

The demo is public, so the API protects the key and the bill:

- Input validated at the boundary: 1–500 characters, voice from a fixed list, 4 KB body limit.
- 10 requests per visitor per 10 minutes, with a bounded client table.
- A daily character budget (default 200,000 characters, about US$0.12 a day).
- Strict CSP: no inline scripts or styles; audio plays from a `blob:` URL.

## Run locally

```sh
cd voice-api
bun test
OPENROUTER_API_KEY=... PORT=3013 bun run src/index.ts
curl -H 'content-type: application/json' \
  -d '{"text":"The quick brown fox jumps over the lazy dog.","voice":"bf_alice"}' \
  localhost:3013/tts --output fox.mp3
```

Voices: `af_alloy`, `am_onyx`, `bf_alice`, `bm_daniel`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which follows the same pattern as the other Star and Stream sites: sync `public/` to nginx, install the nginx config, build and run the container on loopback port 3013, and reload nginx. On the first deploy it bootstraps the TLS certificate before installing the HTTPS config.

**Required GitHub Actions secrets:** `VPS_IP`, `VPS_USERNAME`, `VPS_SSH_KEY`, `OPENROUTER_API_KEY`.

**Before the first deploy:** point a DNS A record for `demo3.starandstream.com` at the VPS.

Unlike the other sites, the OpenRouter key comes from GitHub Secrets rather than the encrypted `/data/secrets` store. The workflow writes it to a file only the deploy user can read and passes it to the container with `--env-file`.
