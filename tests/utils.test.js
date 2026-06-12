import { describe, expect, it } from 'vitest'
import { getTargetSize } from '../src/image.js'
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

describe('getTargetSize', () => {
  it('keeps small images unchanged', () => {
    expect(getTargetSize(1200, 900)).toEqual({ width: 1200, height: 900 })
  })

  it('limits the longest edge to 1600px', () => {
    expect(getTargetSize(4032, 3024)).toEqual({ width: 1600, height: 1200 })
    expect(getTargetSize(2000, 4000)).toEqual({ width: 800, height: 1600 })
  })
})
