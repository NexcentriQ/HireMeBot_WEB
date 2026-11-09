import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { User, Phone } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { InputGroup, UnstyledInput } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { signupSchema, toE164, type SignupFormValues } from '../schemas'
import { readOnboardingDraft, saveOnboardingDraft } from '../services/onboardingDraft'
import { getPhoneVerificationService } from '../services/phoneVerification'
import type { FieldError } from '../services/studentAccountApi'
import { useAuth } from '../AuthProvider'
import { useToast } from '@/components/common/ToastProvider'

/**
 * V1 restriction: student signup is US-only. The country code is pinned to
 * `US` / `+1` with no selector. To add more countries later, reintroduce the
 * Select backed by `listCountries()` and expose it here.
 */
const SIGNUP_COUNTRY_CODE = 'US'
const SIGNUP_DIAL_CODE = '+1'

/**
 * Set by the registration step when `POST /students/register` rejected the
 * details (VALIDATION_FAILED or NAME_ALREADY_REGISTERED).
 */
export type SignupRouteState = {
  registrationError?: { message: string; fieldErrors: FieldError[] }
}

/** Backend field name → form field name. */
const SERVER_FIELD_TO_FORM: Record<string, keyof SignupFormValues> = {
  firstName: 'firstName',
  lastName: 'lastName',
  phoneNumber: 'phoneNumber',
  acceptedTerms: 'agreedToTerms'
}

/**
 * Restores what this student already typed: coming back from Verify Phone, or
 * resuming after the session had to be renewed with Google.
 */
function initialValues(ownerSub: string | undefined): SignupFormValues {
  const draft = ownerSub ? readOnboardingDraft(ownerSub) : null
  return {
    firstName: draft?.firstName ?? '',
    lastName: draft?.lastName ?? '',
    countryCode: SIGNUP_COUNTRY_CODE,
    phoneNumber: draft ? (parsePhoneNumberFromString(draft.phoneE164)?.formatNational() ?? '') : '',
    agreedToTerms: (draft?.acceptedTerms ?? false) as unknown as true
  }
}

export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { user, logout } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [defaultValues] = useState(() => initialValues(user?.userId))
  const registrationError = (location.state as SignupRouteState | null)?.registrationError
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isValid }
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues
  })

  // Show the backend's messages on the matching fields.
  useEffect(() => {
    if (!registrationError) return
    const unmatched: string[] = []
    for (const fieldError of registrationError.fieldErrors) {
      const field = SERVER_FIELD_TO_FORM[fieldError.field]
      if (field) setError(field, { type: 'server', message: fieldError.message }, { shouldFocus: true })
      else unmatched.push(fieldError.message)
    }
    if (registrationError.fieldErrors.length === 0 || unmatched.length > 0) {
      setFormError(unmatched.length > 0 ? unmatched.join(' ') : registrationError.message)
    }
  }, [registrationError, setError])

  async function onSubmit(values: SignupFormValues) {
    if (submitting || !user) return
    setFormError(null)
    const e164 = toE164(values.countryCode, values.phoneNumber)
    if (!e164) {
      toast.show('Please enter a valid phone number.', 'error')
      return
    }
    setSubmitting(true)
    try {
      // Short-lived, tab-scoped draft bound to this Google identity. Nothing
      // is sent to the backend until the OTP step finishes.
      saveOnboardingDraft({
        ownerSub: user.userId,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneE164: e164,
        acceptedTerms: values.agreedToTerms
      })
      const phoneVerification = getPhoneVerificationService()
      if (phoneVerification.available) {
        await phoneVerification.sendCode(e164)
      }
      navigate('/verify-phone')
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not start registration.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex-1 flex flex-col animate-fade-in">
        <div className="flex justify-center mt-2">
          <Logo size={56} tagline />
        </div>

        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold">Create Your Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join HireMeBot as a Student</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <InputGroup invalid={!!errors.firstName}>
              <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <UnstyledInput
                placeholder="First Name"
                aria-label="First name"
                autoComplete="given-name"
                {...register('firstName')}
              />
            </InputGroup>
            {errors.firstName && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <InputGroup invalid={!!errors.lastName}>
              <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <UnstyledInput
                placeholder="Last Name"
                aria-label="Last name"
                autoComplete="family-name"
                {...register('lastName')}
              />
            </InputGroup>
            {errors.lastName && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.lastName.message}
              </p>
            )}
          </div>

          <div>
            <InputGroup invalid={!!errors.phoneNumber}>
              <Phone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div
                className="flex items-center pr-3 border-r border-border/70 text-sm font-medium text-foreground select-none"
                aria-label={`Country code ${SIGNUP_DIAL_CODE} (United States)`}
                title="HireMeBot is available for US phone numbers in V1."
              >
                {SIGNUP_DIAL_CODE}
              </div>
              <UnstyledInput
                type="tel"
                inputMode="tel"
                placeholder="Enter phone number"
                aria-label="US phone number"
                autoComplete="tel-national"
                {...register('phoneNumber')}
              />
            </InputGroup>
            {errors.phoneNumber && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.phoneNumber.message}
              </p>
            )}
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Controller
              control={control}
              name="agreedToTerms"
              render={({ field }) => (
                <Checkbox
                  id="agree"
                  checked={field.value as boolean}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={!!errors.agreedToTerms || undefined}
                />
              )}
            />
            <label htmlFor="agree" className="text-sm leading-snug text-foreground">
              I agree to the{' '}
              <a href="#" className="text-primary font-medium hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-primary font-medium hover:underline">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.agreedToTerms && (
            <p role="alert" className="text-xs text-destructive -mt-2">
              {errors.agreedToTerms.message as string}
            </p>
          )}

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            loading={submitting}
            disabled={!isValid}
          >
            Continue
          </Button>

          {/* The Gmail address comes from Cognito and is never typed in. */}
          <p className="text-center text-sm text-muted-foreground pt-2">
            {user?.email ? (
              <>
                Signing up as <span className="font-medium text-foreground">{user.email}</span>.{' '}
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void logout()}
              className="text-primary font-semibold hover:underline"
            >
              Use a different Google account
            </button>
          </p>
        </form>
      </div>
    </AuthLayout>
  )
}
