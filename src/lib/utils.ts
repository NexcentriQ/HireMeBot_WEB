import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskPhone(e164: string): string {
  if (!e164) return ''
  const trimmed = e164.replace(/\s+/g, '')
  if (trimmed.length <= 6) return trimmed
  const country = trimmed.startsWith('+') ? trimmed.slice(0, trimmed.length - 10) : ''
  const last4 = trimmed.slice(-4)
  const middle = trimmed.slice(country.length, trimmed.length - 4).replace(/\d/g, '•')
  return `${country} ${middle} ${last4}`.trim()
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
