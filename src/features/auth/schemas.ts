import { z } from 'zod'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/**
 * Mirrors `POST /api/v1/students/register` (STUDENT_AUTH_API.md §4):
 * trimmed, 1–100 characters, letters of any language plus spaces, ' ’ - .,
 * and must start with a letter. The backend re-validates everything.
 */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}'’\-. ]*$/u
const NAME_MESSAGE = 'Use letters, spaces, apostrophes, hyphens, or periods, starting with a letter'

function nameField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} is too long`)
    .regex(NAME_PATTERN, NAME_MESSAGE)
}

export const signupSchema = z
  .object({
    firstName: nameField('First name'),
    lastName: nameField('Last name'),
    countryCode: z.string().min(2),
    phoneNumber: z.string().trim().min(1, 'Phone number is required'),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms and Privacy Policy' })
    })
  })
  .superRefine((val, ctx) => {
    const phone = parsePhoneNumberFromString(val.phoneNumber, val.countryCode as CountryCode)
    if (!phone || !phone.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid phone number',
        path: ['phoneNumber']
      })
    }
  })

export type SignupFormValues = z.infer<typeof signupSchema>

export function toE164(countryCode: string, phoneNumber: string): string | null {
  const phone = parsePhoneNumberFromString(phoneNumber, countryCode as CountryCode)
  return phone && phone.isValid() ? phone.number : null
}

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code')
})

export type OtpFormValues = z.infer<typeof otpSchema>
