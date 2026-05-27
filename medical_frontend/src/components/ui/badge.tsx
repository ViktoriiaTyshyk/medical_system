import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
  {
    variants: {
      variant: {
        green:  'bg-jade/15 text-jade',
        blue:   'bg-sky/15 text-sky',
        yellow: 'bg-amber/15 text-amber',
        red:    'bg-rose/15 text-rose',
        gray:   'bg-ink-subtle/20 text-ink-muted',
        white:  'bg-white/10 text-white',
      },
    },
    defaultVariants: { variant: 'gray' },
  }
)

export function Badge({
  className, variant, children, ...p
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ variant }), className)} {...p}>{children}</span>
}
