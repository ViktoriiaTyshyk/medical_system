import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })
}

export function esc(s: string | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
