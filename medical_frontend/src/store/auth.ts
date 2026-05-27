import { create } from 'zustand'
import type { User, Role } from '@/types'

interface AuthStore {
  token:   string | null
  user:    User | null
  role:    Role | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
}

function primaryRole(user: User): Role | null {
  const priority: Role[] = ['ADMIN', 'RADIOLOGIST', 'FAMILY_DOCTOR', 'PATIENT']
  for (const r of priority)
    if (user.roles.some(x => x.name === r)) return r
  return null
}

export const useAuth = create<AuthStore>((set) => ({
  token: localStorage.getItem('access_token'),
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  role:  (() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null') as User | null
    return u ? primaryRole(u) : null
  })(),

  setAuth: (token, user) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user, role: primaryRole(user) })
  },
  clearAuth: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    set({ token: null, user: null, role: null })
  },
}))
