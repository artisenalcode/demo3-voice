// Must match VOICES in voice-api/src/lib.ts; the API rejects anything else.
export const VOICES = [
  { id: 'af_alloy', label: 'Alloy', accent: 'American English', gender: 'female' },
  { id: 'am_onyx', label: 'Onyx', accent: 'American English', gender: 'male' },
  { id: 'bf_alice', label: 'Alice', accent: 'British English', gender: 'female' },
  { id: 'bm_daniel', label: 'Daniel', accent: 'British English', gender: 'male' }
] as const

export type VoiceId = (typeof VOICES)[number]['id']

export const DEFAULT_VOICE: VoiceId = 'bf_alice'
export const MAX_CHARS = 500
export const SAMPLE_TEXT = 'The quick brown fox jumps over the lazy dog.'
