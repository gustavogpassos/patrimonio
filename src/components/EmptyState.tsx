import type { ReactNode } from 'react'

export function EmptyState({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
      <p>{title}</p>
      {action}
    </div>
  )
}
