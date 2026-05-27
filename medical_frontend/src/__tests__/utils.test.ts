/**
 * Unit-тести для утилітних функцій (src/lib/utils.ts).
 * Не потребують DOM — чиста логіка.
 */
import { describe, it, expect } from 'vitest'
import { cn, fmtDate, fmtTime, esc } from '@/lib/utils'

// ──────────────────────────────────────────────────────────────────────────────
// cn() — об'єднання класів Tailwind
// ──────────────────────────────────────────────────────────────────────────────
describe('cn()', () => {
  it('об\'єднує рядки', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('ігнорує false / undefined / null', () => {
    expect(cn('foo', false && 'bar', undefined, null as unknown as string)).toBe('foo')
  })

  it('merges conflicting Tailwind classes (остання виграє)', () => {
    const result = cn('p-4', 'p-6')
    expect(result).toBe('p-6')
  })

  it('підтримує умовні об\'єкти', () => {
    const active = true
    expect(cn('base', { 'text-blue-500': active, 'text-gray-500': !active }))
      .toContain('text-blue-500')
  })

  it('повертає порожній рядок якщо немає аргументів', () => {
    expect(cn()).toBe('')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// fmtDate() — форматування дати
// ──────────────────────────────────────────────────────────────────────────────
describe('fmtDate()', () => {
  it('форматує ISO-дату у вигляді дд.мм.рррр', () => {
    // 2024-03-15 → "15.03.2024" (uk locale)
    const result = fmtDate('2024-03-15T00:00:00Z')
    expect(result).toMatch(/15/)
    expect(result).toMatch(/03/)
    expect(result).toMatch(/2024/)
  })

  it('повертає рядок (не кидає виключення)', () => {
    expect(typeof fmtDate('2023-01-01T12:00:00Z')).toBe('string')
  })

  it('різні дати дають різні рядки', () => {
    const d1 = fmtDate('2024-01-01T00:00:00Z')
    const d2 = fmtDate('2024-12-31T00:00:00Z')
    expect(d1).not.toBe(d2)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// fmtTime() — форматування часу
// ──────────────────────────────────────────────────────────────────────────────
describe('fmtTime()', () => {
  it('повертає рядок', () => {
    expect(typeof fmtTime('2024-06-10T14:30:00Z')).toBe('string')
  })

  it('різний час → різні рядки', () => {
    const t1 = fmtTime('2024-06-10T08:00:00Z')
    const t2 = fmtTime('2024-06-10T20:00:00Z')
    expect(t1).not.toBe(t2)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// esc() — HTML-escaping
// ──────────────────────────────────────────────────────────────────────────────
describe('esc()', () => {
  it('екранує <', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;')
  })

  it('екранує &', () => {
    expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('екранує < і >', () => {
    expect(esc('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('не змінює звичайний текст', () => {
    expect(esc('Привіт, світ!')).toBe('Привіт, світ!')
  })

  it('повертає порожній рядок для null', () => {
    expect(esc(null)).toBe('')
  })

  it('повертає порожній рядок для undefined', () => {
    expect(esc(undefined)).toBe('')
  })

  it('не подвійно екранує', () => {
    // Перший виклик екранує, другий не повинен зламати вже екранований текст
    const once   = esc('<b>')
    const twice  = esc(once)
    expect(once).toBe('&lt;b&gt;')
    expect(twice).toBe('&amp;lt;b&amp;gt;')
  })
})
