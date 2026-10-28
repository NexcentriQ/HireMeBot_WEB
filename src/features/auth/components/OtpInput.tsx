import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

type OtpInputProps = {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  length?: number
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  ariaLabel?: string
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = true,
  ariaLabel = 'One-time code'
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const digits = useMemo(() => value.padEnd(length, ' ').slice(0, length).split(''), [value, length])

  useEffect(() => {
    if (autoFocus) {
      const firstEmpty = Math.min(value.length, length - 1)
      inputs.current[firstEmpty]?.focus()
    }
  }, [autoFocus, length, value.length])

  const setAt = useCallback(
    (idx: number, char: string) => {
      const sanitized = char.replace(/\D/g, '').slice(0, 1)
      const current = value.split('')
      current[idx] = sanitized
      const normalized = current.join('').slice(0, length).replace(/\s+/g, '')
      onChange(normalized)
      if (sanitized && idx < length - 1) {
        inputs.current[idx + 1]?.focus()
      }
      if (normalized.length === length && !normalized.includes(' ')) {
        onComplete?.(normalized)
      }
    },
    [length, onChange, onComplete, value]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
      if (!pasted) return
      onChange(pasted)
      if (pasted.length === length) {
        onComplete?.(pasted)
        inputs.current[length - 1]?.focus()
      } else {
        inputs.current[pasted.length]?.focus()
      }
    },
    [length, onChange, onComplete]
  )

  const handleKeyDown = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault()
        const current = value.split('')
        if (current[idx]) {
          current[idx] = ''
          onChange(current.join('').trimEnd())
          return
        }
        if (idx > 0) {
          current[idx - 1] = ''
          onChange(current.join('').trimEnd())
          inputs.current[idx - 1]?.focus()
        }
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault()
        inputs.current[idx - 1]?.focus()
      } else if (e.key === 'ArrowRight' && idx < length - 1) {
        e.preventDefault()
        inputs.current[idx + 1]?.focus()
      }
    },
    [length, onChange, value]
  )

  return (
    <div
      className="flex items-center justify-center gap-2 sm:gap-3"
      role="group"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
    >
      {Array.from({ length }).map((_, idx) => {
        const char = digits[idx]?.trim() ?? ''
        return (
          <input
            key={idx}
            ref={(el) => (inputs.current[idx] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            disabled={disabled}
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            onChange={(e) => setAt(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Digit ${idx + 1}`}
            className={cn(
              'h-14 w-11 sm:h-16 sm:w-12 text-center text-xl sm:text-2xl font-semibold rounded-xl',
              'border border-input bg-card text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
              invalid && 'border-destructive focus-visible:ring-destructive'
            )}
          />
        )
      })}
    </div>
  )
}
