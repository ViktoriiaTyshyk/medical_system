import { cn } from '@/lib/utils'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

const styles: Record<AlertVariant, string> = {
  error:   'bg-rose/8 border-rose/30 text-rose',
  success: 'bg-jade/8 border-jade/30 text-jade',
  warning: 'bg-amber/8 border-amber/30 text-amber',
  info:    'bg-sky/8  border-sky/30  text-sky',
}

export function Alert({
  variant = 'info', children, className,
}: { variant?: AlertVariant; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[8px] border px-4 py-3 text-sm', styles[variant], className)}>
      {children}
    </div>
  )
}
