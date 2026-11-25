import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

export type RowAction = {
  label: string
  onClick: () => void
  destructive?: boolean
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex justify-end">
      <div className="hidden gap-2 lg:flex">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.destructive ? 'destructive' : 'outline'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-11" aria-label="Ações">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                className="min-h-11"
                variant={action.destructive ? 'destructive' : 'default'}
                onClick={action.onClick}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
