import { getCountries, getCountryCallingCode } from 'libphonenumber-js'

export type CountryEntry = {
  code: string
  name: string
  dialCode: string
}

const DISPLAY_NAMES =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

const PRIORITY = ['US', 'IN', 'GB', 'CA', 'AU']

export function listCountries(): CountryEntry[] {
  const raw = getCountries()
    .map((c) => {
      try {
        return {
          code: c,
          name: DISPLAY_NAMES?.of(c) ?? c,
          dialCode: `+${getCountryCallingCode(c)}`
        } as CountryEntry
      } catch {
        return null
      }
    })
    .filter((v): v is CountryEntry => v !== null)

  raw.sort((a, b) => a.name.localeCompare(b.name))
  const prioritized = PRIORITY.map((p) => raw.find((r) => r.code === p)).filter(
    (v): v is CountryEntry => v !== undefined
  )
  const rest = raw.filter((r) => !PRIORITY.includes(r.code))
  return [...prioritized, ...rest]
}
