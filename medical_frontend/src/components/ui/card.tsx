import { cn } from '@/lib/utils'

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg bg-surface border border-line shadow-card', className)} {...p}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between px-5 pt-5 pb-4', className)} {...p}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[15px] font-semibold text-ink', className)} {...p}>{children}</h3>
}

export function CardContent({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...p}>{children}</div>
}
