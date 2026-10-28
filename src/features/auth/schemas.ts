import { z } from 'zod'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

export const signupSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required')
      .max(50, 'First name is too long')
      .regex(/^[\p{L}\p{M}'’\- ]+$/u, 'Only letters, spaces, hyphens, and apostrophes'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required')
      .max(50, 'Last name is too long')
      .regex(/^[\p{L}\p{M}'’\- ]+$/u, 'Only letters, spaces, hyphens, and apostrophes'),
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
