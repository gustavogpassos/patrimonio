import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  DatabaseBackup,
  FolderTree,
  LayoutDashboard,
  MonitorSmartphone,
  Tags,
  Wrench,
} from 'lucide-react'
import { useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const links = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/equipment', label: 'Equipamentos', icon: MonitorSmartphone },
  { to: '/maintenance', label: 'Manutenções', icon: Wrench },
  { to: '/sectors', label: 'Setores', icon: FolderTree },
  { to: '/categories', label: 'Categorias', icon: Tags },
]

export function AppShell() {
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleBackup() {
    try {
      await api.downloadBackup()
      toast.success('Backup salvo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no backup')
    }
  }

  async function handleRestore(file: File | undefined) {
    if (!file) return
    if (!window.confirm('O banco atual será substituído.')) return
    try {
      await api.restoreBackup(file)
      toast.success('Backup restaurado')
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na restauração')
    }
  }

  return (
    <div className="flex min-h-svh bg-zinc-50">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-white">
        <div className="px-5 py-6">
          <h1 className="text-lg font-semibold tracking-tight">Patrimônio</h1>
          <p className="text-sm text-muted-foreground">Informática</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 p-4">
          <Separator />
          <Button variant="outline" className="w-full justify-start" onClick={handleBackup}>
            <DatabaseBackup className="size-4" />
            Backup
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => fileRef.current?.click()}
          >
            Restaurar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".db"
            className="hidden"
            onChange={(e) => {
              void handleRestore(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <p className="pt-2 text-xs text-muted-foreground">versão 0.1.0</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
