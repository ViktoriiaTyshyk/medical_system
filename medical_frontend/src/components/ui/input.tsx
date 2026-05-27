import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-[8px] bg-base-100 border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-subtle',
        'transition-all duration-150 outline-none',
        'focus:border-sky focus:ring-2 focus:ring-sky/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-[8px] bg-base-100 border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-subtle',
        'transition-all duration-150 outline-none resize-y min-h-[80px]',
        'focus:border-sky focus:ring-2 focus:ring-sky/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export function Label({ className, children, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-[11px] font-semibold text-ink-muted mb-1.5 tracking-wide', className)} {...p}>
      {children}
    </label>
  )
}

export function FormGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}
