import { describe, expect, it } from 'vitest'
import { escapeHtml, formatPrice, formatRelativeTime } from '../src/utils.js'

describe('formatPrice', () => {
  it('formats integer and decimal prices', () => {
    expect(formatPrice(12)).toBe('¥12')
    expect(formatPrice(12.5)).toBe('¥12.5')
  })
})

describe('escapeHtml', () => {
  it('escapes user-generated content', () => {
    expect(escapeHtml('<img onerror="x">')).toBe(
      '&lt;img onerror=&quot;x&quot;&gt;',
    )
  })
})

describe('formatRelativeTime', () => {
  it('formats recent timestamps', () => {
    const now = new Date('2026-06-12T12:00:00Z').getTime()
    expect(formatRelativeTime('2026-06-12T11:30:00Z', now)).toBe('30分钟前')
    expect(formatRelativeTime('2026-06-12T09:00:00Z', now)).toBe('3小时前')
  })
})
