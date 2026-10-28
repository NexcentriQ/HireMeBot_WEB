import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { User, Phone } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { InputGroup, UnstyledInput } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { signupSchema, toE164, type SignupFormValues } from '../schemas'
import { useAuth } from '../AuthProvider'
import { useToast } from '@/components/common/ToastProvider'

/**
 * V1 restriction: student signup is US-only. The country code is pinned to
 * `US` / `+1` with no selector. To add more countries later, reintroduce the
 * Select backed by `listCountries()` and expose it here.
 */
const SIGNUP_COUNTRY_CODE = 'US'
const SIGNUP_DIAL_CODE = '+1'

export function SignupPage() {
  const navigate = useNavigate()
  const { authService } = useAuth()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      countryCode: SIGNUP_COUNTRY_CODE,
      phoneNumber: '',
      agreedToTerms: false as unknown as true
    }
  })

  async function onSubmit(values: SignupFormValues) {
    if (submitting) return
    const e164 = toE164(values.countryCode, values.phoneNumber)
    if (!e164) {
      toast.show('Please enter a valid phone number.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const pending = await authService.startRegistration({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phoneE164: e164,
        agreedToTerms: values.agreedToTerms
      })
      await authService.sendPhoneOtp(pending.registrationId)
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

          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            loading={submitting}
            disabled={!isValid}
          >
            Continue
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-2">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Log In
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  )
}
