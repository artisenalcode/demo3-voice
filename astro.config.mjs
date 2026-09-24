import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://demo3.starandstream.com',
  integrations: [react()],
  devToolbar: { enabled: false },
  // Keep CSS in external files so the CSP needs no style hashes.
  build: { inlineStylesheets: 'never' },
  vite: {
    plugins: [tailwindcss()],
    // Proxy the API in dev so the page talks to a local voice-api on :3013.
    server: { proxy: { '/api/tts': { target: 'http://127.0.0.1:3013', rewrite: () => '/tts' } } }
  }
})
