import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import Speaker from '@/components/Speaker'
import { clearMemoryCacheForTests } from '@/lib/tts-cache'

const mp3 = () => new Response(new Blob(['ID3'], { type: 'audio/mpeg' }), { status: 200 })

describe('Speaker', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let playMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearMemoryCacheForTests()
    fetchMock = vi.fn(async () => mp3())
    vi.stubGlobal('fetch', fetchMock)
    playMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('prefills the sample sentence with a default voice', () => {
    render(<Speaker />)
    expect(screen.getByLabelText('Text to speak')).toHaveValue(
      'The quick brown fox jumps over the lazy dog.'
    )
    expect(screen.getByRole('combobox', { name: 'Voice' })).toHaveTextContent('Alice')
  })

  it('requests audio once, plays it, then replays from the local cache', async () => {
    const user = userEvent.setup()
    render(<Speaker />)

    await user.click(screen.getByRole('button', { name: 'Speak' }))
    await screen.findByText('Playing now.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/tts')
    expect(JSON.parse(init.body as string)).toEqual({
      text: 'The quick brown fox jumps over the lazy dog.',
      voice: 'bf_alice'
    })
    await waitFor(() => expect(playMock).toHaveBeenCalled())

    await user.click(await screen.findByRole('button', { name: 'Replay' }))
    await screen.findByText('Playing from your device. No new request.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats extra spaces as no change, but new words as a new request', async () => {
    const user = userEvent.setup()
    render(<Speaker />)
    const box = screen.getByLabelText('Text to speak')

    await user.click(screen.getByRole('button', { name: 'Speak' }))
    await screen.findByText('Playing now.')

    await user.type(box, '   ')
    await user.click(await screen.findByRole('button', { name: 'Replay' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await user.type(box, ' Again')
    await user.click(await screen.findByRole('button', { name: 'Speak' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('shows the server error message', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 })
    )
    const user = userEvent.setup()
    render(<Speaker />)
    await user.click(screen.getByRole('button', { name: 'Speak' }))
    expect(await screen.findByText('Too many requests. Try again in a few minutes.')).toBeVisible()
  })

  it('validates empty text without calling the API', async () => {
    const user = userEvent.setup()
    render(<Speaker />)
    await user.clear(screen.getByLabelText('Text to speak'))
    await user.click(screen.getByRole('button', { name: 'Speak' }))
    expect(await screen.findByText('Type some text to speak.')).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
