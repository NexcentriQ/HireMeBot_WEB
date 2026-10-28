import * as React from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-12 w-full rounded-xl border border-input bg-background px-4 py-2 text-base placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          invalid && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

type InputGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  invalid?: boolean
}

export const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, invalid, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center h-14 w-full rounded-xl border border-input bg-card px-4 gap-3',
        // Single, clean focus affordance — just a primary-colored border, no halo.
        'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30',
        'transition-colors',
        invalid && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/30',
        className
      )}
      {...props}
    />
  )
)
InputGroup.displayName = 'InputGroup'

export const UnstyledInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex-1 min-w-0 bg-transparent text-base placeholder:text-muted-foreground disabled:opacity-50',
        // The surrounding InputGroup owns the focus ring; make sure the inner
        // input does not also pick up the global :focus-visible ring.
        'outline-none border-0 focus:outline-none focus-visible:outline-none',
        'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
        className
      )}
      {...props}
    />
  )
)
UnstyledInput.displayName = 'UnstyledInput'
