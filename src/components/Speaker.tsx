import { Download, Loader2, RotateCcw, Volume2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cacheKey, getCached, normaliseText, putCached } from '@/lib/tts-cache'
import { DEFAULT_VOICE, MAX_CHARS, SAMPLE_TEXT, VOICES, type VoiceId } from '@/lib/voices'

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing'; fromCache: boolean }
  | { kind: 'error'; message: string }

export default function Speaker() {
  const [text, setText] = useState(SAMPLE_TEXT)
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const inFlight = useRef<AbortController | null>(null)
  const loadedKey = useRef<string | null>(null)
  const ids = { text: useId(), voice: useId(), hint: useId(), count: useId() }

  const chars = normaliseText(text).length
  const tooLong = chars > MAX_CHARS
  const empty = chars === 0

  // Tell the user when the current words and voice are already cached.
  useEffect(() => {
    let cancelled = false
    cacheKey(text, voice)
      .then((key) => (key === loadedKey.current ? true : getCached(key).then(Boolean)))
      .then((hit) => !cancelled && setIsCached(hit))
      .catch(() => !cancelled && setIsCached(false))
    return () => {
      cancelled = true
    }
  }, [text, voice])

  // One object URL at a time; revoke the old one so blobs don't accumulate.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  useEffect(() => () => inFlight.current?.abort(), [])

  function play(blob: Blob, key: string, fromCache: boolean) {
    setAudioUrl(URL.createObjectURL(blob))
    loadedKey.current = key
    setIsCached(true)
    setStatus({ kind: 'playing', fromCache })
  }

  // Start playback once React has attached the new source.
  useEffect(() => {
    if (status.kind !== 'playing' || !audioRef.current) return
    const audio = audioRef.current
    audio.currentTime = 0
    audio.play().catch(() => {
      // Autoplay can be blocked; the controls stay available.
    })
  }, [status, audioUrl])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (empty) return setStatus({ kind: 'error', message: 'Type some text to speak.' })
    if (tooLong) {
      return setStatus({ kind: 'error', message: `Keep it to ${MAX_CHARS} characters or fewer.` })
    }

    const key = await cacheKey(text, voice)
    // Same words and voice as the clip already loaded: just replay it.
    if (key === loadedKey.current) return setStatus({ kind: 'playing', fromCache: true })
    const cached = await getCached(key)
    if (cached) return play(cached, key, true)

    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setStatus({ kind: 'loading' })

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: normaliseText(text), voice }),
        signal: controller.signal
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        return setStatus({
          kind: 'error',
          message: body.error ?? 'Something went wrong. Try again.'
        })
      }
      const blob = await res.blob()
      play(blob, key, false)
      await putCached(key, blob)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStatus({ kind: 'error', message: 'Could not reach the server. Try again.' })
      }
    }
  }

  const loading = status.kind === 'loading'

  return (
    <Card className="rounded-[20px] shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-xl">Say something</CardTitle>
        <CardDescription className="text-base">
          Replace the sample sentence, choose a voice and press Speak.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor={ids.text} className="text-base font-semibold">
              Text to speak
            </Label>
            <Textarea
              id={ids.text}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={MAX_CHARS + 50}
              aria-describedby={`${ids.count}`}
              aria-invalid={status.kind === 'error' && (empty || tooLong)}
              className="min-h-32 rounded-lg border-input bg-background text-base"
            />
            <p
              id={ids.count}
              className={
                tooLong ? 'text-sm font-semibold text-destructive' : 'text-sm text-muted-foreground'
              }
            >
              {chars} / {MAX_CHARS} characters
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={ids.voice} className="text-base font-semibold">
              Voice
            </Label>
            <Select value={voice} onValueChange={(v) => setVoice(v as VoiceId)}>
              <SelectTrigger
                id={ids.voice}
                className="h-11 w-full rounded-lg border-input bg-background text-base sm:w-80"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-base">
                    {v.label} · {v.accent}, {v.gender}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              aria-busy={loading}
              disabled={loading}
              className="h-11 min-w-32 rounded-xl px-6 text-base font-semibold hover:bg-action-hover"
            >
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : isCached ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Volume2 aria-hidden="true" />
              )}
              {isCached ? 'Replay' : 'Speak'}
            </Button>
            {isCached && !loading && (
              <Badge variant="secondary" className="rounded-full text-sm font-medium">
                Cached on this device
              </Badge>
            )}
          </div>

          <p role="status" aria-live="polite" className="min-h-6 text-base">
            {status.kind === 'loading' && (
              <span className="text-muted-foreground">Generating audio…</span>
            )}
            {status.kind === 'playing' && (
              <span className="text-success">
                {status.fromCache ? 'Playing from your device. No new request.' : 'Playing now.'}
              </span>
            )}
            {status.kind === 'error' && (
              <span className="font-semibold text-destructive">{status.message}</span>
            )}
          </p>
        </form>

        {audioUrl && (
          <div className="mt-2 grid gap-3 border-t pt-6">
            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
            <a
              href={audioUrl}
              download="chatterbox.mp3"
              className="inline-flex items-center gap-2 self-start text-base font-medium text-primary underline-offset-4 hover:underline"
            >
              <Download className="size-4" aria-hidden="true" />
              Download MP3
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
