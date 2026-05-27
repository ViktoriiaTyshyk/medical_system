/**
 * Тести для Zustand auth store.
 *
 * Перевіряємо:
 * - setAuth зберігає token / user / role
 * - primaryRole правильно визначає роль за пріоритетом
 * - clearAuth очищає store і localStorage
 * - ізоляція між тестами (localStorage очищається в beforeEach)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from '@/store/auth'
import type { User } from '@/types'

// ──────────────────────────────────────────────────────────────────────────────
// Хелпер: будує мінімальний об'єкт User
// ──────────────────────────────────────────────────────────────────────────────
function makeUser(roles: string[]): User {
  return {
    id: 1,
    email: 'test@test.com',
    first_name: 'Тест',
    last_name: 'Юзер',
    roles: roles.map(name => ({ id: 1, name } as { id: number; name: string })),
  } as unknown as User
}

// ──────────────────────────────────────────────────────────────────────────────
// Очищаємо localStorage і скидаємо store перед кожним тестом
// ──────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear()
  useAuth.getState().clearAuth()
})

// ──────────────────────────────────────────────────────────────────────────────
describe('useAuth — setAuth()', () => {
  it('зберігає token у store', () => {
    const user = makeUser(['PATIENT'])
    useAuth.getState().setAuth('my-jwt-token', user)
    expect(useAuth.getState().token).toBe('my-jwt-token')
  })

  it('зберігає user у store', () => {
    const user = makeUser(['PATIENT'])
    useAuth.getState().setAuth('tok', user)
    expect(useAuth.getState().user?.email).toBe('test@test.com')
  })

  it('записує token у localStorage', () => {
    useAuth.getState().setAuth('abc123', makeUser(['PATIENT']))
    expect(localStorage.getItem('access_token')).toBe('abc123')
  })

  it('записує user у localStorage як JSON', () => {
    const user = makeUser(['PATIENT'])
    useAuth.getState().setAuth('tok', user)
    const stored = JSON.parse(localStorage.getItem('user') || 'null')
    expect(stored?.email).toBe('test@test.com')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('useAuth — визначення role за пріоритетом', () => {
  it('PATIENT → role = PATIENT', () => {
    useAuth.getState().setAuth('t', makeUser(['PATIENT']))
    expect(useAuth.getState().role).toBe('PATIENT')
  })

  it('RADIOLOGIST → role = RADIOLOGIST', () => {
    useAuth.getState().setAuth('t', makeUser(['RADIOLOGIST']))
    expect(useAuth.getState().role).toBe('RADIOLOGIST')
  })

  it('ADMIN має найвищий пріоритет', () => {
    useAuth.getState().setAuth('t', makeUser(['PATIENT', 'ADMIN']))
    expect(useAuth.getState().role).toBe('ADMIN')
  })

  it('RADIOLOGIST має пріоритет над FAMILY_DOCTOR', () => {
    useAuth.getState().setAuth('t', makeUser(['FAMILY_DOCTOR', 'RADIOLOGIST']))
    expect(useAuth.getState().role).toBe('RADIOLOGIST')
  })

  it('без ролей → role = null', () => {
    useAuth.getState().setAuth('t', makeUser([]))
    expect(useAuth.getState().role).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('useAuth — clearAuth()', () => {
  it('очищає store', () => {
    useAuth.getState().setAuth('tok', makeUser(['PATIENT']))
    useAuth.getState().clearAuth()

    const s = useAuth.getState()
    expect(s.token).toBeNull()
    expect(s.user).toBeNull()
    expect(s.role).toBeNull()
  })

  it('видаляє дані з localStorage', () => {
    useAuth.getState().setAuth('tok', makeUser(['PATIENT']))
    localStorage.setItem('refresh_token', 'rt')
    useAuth.getState().clearAuth()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })
})
