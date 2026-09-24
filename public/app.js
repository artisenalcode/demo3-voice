// Sends text to /api/tts and plays the MP3 it returns. One request at a time;
// the previous audio URL is revoked so blobs don't pile up in memory.
const MAX_CHARS = 500

const form = document.getElementById('tts-form')
const text = document.getElementById('text')
const voice = document.getElementById('voice')
const button = document.getElementById('speak')
const count = document.getElementById('count')
const status = document.getElementById('status')
const result = document.getElementById('result')
const player = document.getElementById('player')
const download = document.getElementById('download')

let audioUrl = null
let inFlight = null

function updateCount() {
  const n = text.value.trim().length
  count.textContent = `${n} / ${MAX_CHARS} characters`
}

function setStatus(message, isError = false) {
  status.textContent = message
  status.classList.toggle('error', isError)
  text.setAttribute('aria-invalid', String(isError && text.value.trim().length === 0))
}

function setBusy(busy) {
  button.disabled = busy
  button.setAttribute('aria-busy', String(busy))
  form.setAttribute('aria-busy', String(busy))
}

async function speak(event) {
  event.preventDefault()
  const value = text.value.trim()
  if (value.length === 0) return setStatus('Type some text to speak.', true)
  if (value.length > MAX_CHARS) return setStatus(`Keep it to ${MAX_CHARS} characters or fewer.`, true)

  inFlight?.abort()
  inFlight = new AbortController()
  setBusy(true)
  setStatus('Generating audio…')

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: value, voice: voice.value }),
      signal: inFlight.signal
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return setStatus(body.error ?? 'Something went wrong. Try again.', true)
    }
    const blob = await res.blob()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    audioUrl = URL.createObjectURL(blob)
    player.src = audioUrl
    download.href = audioUrl
    result.hidden = false
    setStatus('Ready. Playing now.')
    await player.play().catch(() => setStatus('Ready. Press play to listen.'))
  } catch (err) {
    if (err.name !== 'AbortError') setStatus('Could not reach the server. Try again.', true)
  } finally {
    setBusy(false)
  }
}

text.addEventListener('input', updateCount)
form.addEventListener('submit', speak)
updateCount()
