import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const btn = cva(
  'inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none text-sm whitespace-nowrap border',
  {
    variants: {
      variant: {
        primary:   'bg-sky-dark border-sky text-white hover:bg-sky shadow-sm hover:shadow-md',
        secondary: 'bg-panel-50 border-line text-ink hover:bg-panel-100',
        ghost:     'bg-transparent border-transparent text-ink-muted hover:bg-panel-50 hover:text-ink',
        danger:    'bg-transparent border-rose text-rose hover:bg-rose/10',
        success:   'bg-jade-dark border-jade text-white hover:bg-jade',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-sm font-semibold',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof btn> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(btn({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin-slow h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
