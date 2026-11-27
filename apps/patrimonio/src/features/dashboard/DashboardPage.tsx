import { EmptyState } from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatDate, regularMaintenanceInfo } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import type { DashboardData } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((err) => toast.error(err.message))
  }, [])

  if (!data) {
    return <p className="text-muted-foreground">Carregando painel…</p>
  }

  const cards = [
    { label: 'Ativos', value: data.activeCount, href: '/equipment' },
    { label: 'Em uso', value: data.inUse, href: '/equipment?status=in_use' },
    {
      label: 'Em estoque',
      value: data.inStock,
      href: '/equipment?status=in_stock',
    },
    {
      label: 'Em manutenção',
      value: data.inMaintenance,
      href: '/equipment?status=in_maintenance',
    },
    {
      label: 'Baixados',
      value: data.writtenOff,
      href: '/equipment?status=written_off',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Painel</h2>
        <p className="text-muted-foreground">Visão geral do patrimônio de informática</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.href)}
            className="text-left"
          >
            <Card className="transition hover:border-zinc-400">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          </button>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor total (não baixados)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatBRL(data.totalValueCents)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Garantias vencidas"
          empty={data.expiredWarranties.length === 0}
        >
          {data.expiredWarranties.map((item) => (
            <Link key={item.id} to={`/equipment/${item.id}`} className="block hover:underline">
              {item.assetTag} · {item.name} · {formatDate(item.warrantyUntil)}
            </Link>
          ))}
        </ListCard>

        <ListCard
          title="Garantias a vencer em 30 dias"
          empty={data.warrantiesDueSoon.length === 0}
        >
          {data.warrantiesDueSoon.map((item) => (
            <Link key={item.id} to={`/equipment/${item.id}`} className="block hover:underline">
              {item.assetTag} · {item.name} · {formatDate(item.warrantyUntil)}
            </Link>
          ))}
        </ListCard>

        <ListCard
          title="Manutenção regular a fazer"
          empty={data.overdueRegularMaintenance.length === 0}
        >
          {data.overdueRegularMaintenance.map((item) => {
            const info = regularMaintenanceInfo({
              intervalDays: item.categoryMaintenanceIntervalDays,
              registeredAt: item.createdAt,
              lastCompletedOn: item.lastMaintenanceCompletedAt,
            })
            return (
              <Link key={item.id} to={`/equipment/${item.id}`} className="block hover:underline">
                {item.assetTag} · {item.name}
                {info.kind === 'due' ? ` · ${info.label}` : ''}
              </Link>
            )
          })}
        </ListCard>

        <ListCard
          title="Manutenções abertas"
          empty={data.openMaintenance.length === 0}
        >
          {data.openMaintenance.map((item) => (
            <Link
              key={item.id}
              to={`/equipment/${item.equipmentId}`}
              className="block hover:underline"
            >
              {item.equipmentAssetTag} · {item.equipmentName} · {formatDate(item.openedOn)}
            </Link>
          ))}
        </ListCard>

        <ListCard
          title="Últimas movimentações"
          empty={data.recentTransfers.length === 0}
        >
          {data.recentTransfers.map((item) => (
            <Link
              key={item.id}
              to={`/equipment/${item.equipmentId}`}
              className="block hover:underline"
            >
              {item.equipmentAssetTag} · {item.fromSectorName ?? 'Cadastro'} →{' '}
              {item.toSectorName} · {formatDate(item.transferredOn)}
            </Link>
          ))}
        </ListCard>
      </div>
    </div>
  )
}

function ListCard({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {empty ? <EmptyState title="Nenhum registro." /> : children}
      </CardContent>
    </Card>
  )
}
