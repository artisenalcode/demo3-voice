import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vite-plus/test'

// Globals are off, so Testing Library can't register its own cleanup.
afterEach(() => cleanup())

// jsdom has no media playback or object URLs.
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined)
})
vi.stubGlobal(
  'URL',
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mock-audio'),
    revokeObjectURL: vi.fn()
  })
)

// Radix Select measures and scrolls elements jsdom doesn't implement.
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()
