import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  DatabaseBackup,
  FolderTree,
  LayoutDashboard,
  Menu,
  MonitorSmartphone,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
  Upload,
  Wrench,
  X,
} from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

const COLLAPSE_KEY = 'patrimonio.nav-collapsed'

const links = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/equipment', label: 'Equipamentos', icon: MonitorSmartphone },
  { to: '/maintenance', label: 'Manutenções', icon: Wrench },
  { to: '/sectors', label: 'Setores', icon: FolderTree },
  { to: '/categories', label: 'Categorias', icon: Tags },
]

function currentSection(pathname: string) {
  return (
    links.find(({ to, end }) =>
      end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`),
    )?.label ?? 'Patrimônio'
  )
}

function SidebarBody({
  navId,
  collapsed = false,
  onNavigate,
  onBackup,
  onRestore,
  header,
}: {
  navId: string
  collapsed?: boolean
  onNavigate?: () => void
  onBackup: () => void
  onRestore: () => void
  header: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {header}
      <nav
        id={navId}
        aria-label="Principal"
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3"
      >
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-700 hover:bg-zinc-100',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={cn('space-y-2 p-3', collapsed && 'px-2')}>
        <Separator />
        <Button
          variant="outline"
          title={collapsed ? 'Backup' : undefined}
          className={cn('min-h-11 w-full', collapsed ? 'px-0' : 'justify-start')}
          onClick={onBackup}
        >
          <DatabaseBackup className="size-4" />
          <span className={cn(collapsed && 'sr-only')}>Backup</span>
        </Button>
        <Button
          variant="outline"
          title={collapsed ? 'Restaurar' : undefined}
          className={cn('min-h-11 w-full', collapsed ? 'px-0' : 'justify-start')}
          onClick={onRestore}
        >
          <Upload className="size-4" />
          <span className={cn(collapsed && 'sr-only')}>Restaurar</span>
        </Button>
        <p className={cn('px-2 pt-1 text-xs text-muted-foreground', collapsed && 'sr-only')}>
          versão 0.1.0
        </p>
      </div>
    </div>
  )
}

export function AppShell() {
  const fileRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navPath, setNavPath] = useState(location.pathname)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  if (navPath !== location.pathname) {
    setNavPath(location.pathname)
    setMobileOpen(false)
  }

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // preferência local é opcional
      }
      return next
    })
  }

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

  function openRestore() {
    fileRef.current?.click()
  }

  const section = currentSection(location.pathname)

  return (
    <div className="flex h-svh overflow-hidden bg-zinc-50">
      <aside
        className={cn(
          'hidden h-full shrink-0 overflow-hidden border-r bg-white transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[4.25rem]' : 'w-60',
        )}
      >
        <SidebarBody
          navId="app-navigation"
          collapsed={collapsed}
          onBackup={() => void handleBackup()}
          onRestore={openRestore}
          header={
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-4',
                collapsed ? 'justify-center' : 'justify-between',
              )}
            >
              <div className={cn('min-w-0 px-2', collapsed && 'sr-only')}>
                <h1 className="truncate text-lg font-semibold tracking-tight">Patrimônio</h1>
                <p className="truncate text-sm text-muted-foreground">Informática</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                aria-expanded={!collapsed}
                aria-controls="app-navigation"
                onClick={toggleCollapsed}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </div>
          }
        />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/40 lg:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18.5rem,88vw)] flex-col bg-white shadow-xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden"
          >
            <SidebarBody
              navId="app-navigation-mobile"
              onNavigate={() => setMobileOpen(false)}
              onBackup={() => void handleBackup()}
              onRestore={openRestore}
              header={
                <div className="flex items-start justify-between gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-lg font-semibold tracking-tight">
                      Patrimônio
                    </DialogTitle>
                    <DialogDescription>Informática</DialogDescription>
                  </div>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label="Fechar menu"
                    >
                      <X />
                    </Button>
                  </DialogClose>
                </div>
              }
            />
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-white px-3 pt-[env(safe-area-inset-top)] lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-controls="app-navigation-mobile"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <div className="min-w-0 py-2">
            <p className="truncate text-sm font-semibold leading-tight">Patrimônio</p>
            <p className="truncate text-xs text-muted-foreground">{section}</p>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <Outlet />
        </main>
      </div>

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
    </div>
  )
}
