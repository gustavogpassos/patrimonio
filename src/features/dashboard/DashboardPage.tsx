import { EmptyState } from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatDatePt, manutencaoRegularInfo } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import type { PainelData } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function DashboardPage() {
  const [data, setData] = useState<PainelData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .painel()
      .then(setData)
      .catch((err) => toast.error(err.message))
  }, [])

  if (!data) {
    return <p className="text-muted-foreground">Carregando painel…</p>
  }

  const cards = [
    { label: 'Ativos', value: data.ativos, href: '/equipamentos' },
    { label: 'Em uso', value: data.emUso, href: '/equipamentos?status=em_uso' },
    {
      label: 'Em estoque',
      value: data.emEstoque,
      href: '/equipamentos?status=em_estoque',
    },
    {
      label: 'Em manutenção',
      value: data.emManutencao,
      href: '/equipamentos?status=em_manutencao',
    },
    {
      label: 'Baixados',
      value: data.baixados,
      href: '/equipamentos?status=baixado',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Painel</h2>
        <p className="text-muted-foreground">Visão geral do patrimônio de informática</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => navigate(c.href)}
            className="text-left"
          >
            <Card className="transition hover:border-zinc-400">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{c.value}</p>
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
            <p className="text-3xl font-semibold">{formatBRL(data.valorTotalCentavos)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Garantias vencidas"
          empty={data.garantiasVencidas.length === 0}
        >
          {data.garantiasVencidas.map((e) => (
            <Link key={e.id} to={`/equipamentos/${e.id}`} className="block hover:underline">
              {e.tombamento} · {e.nome} · {formatDatePt(e.garantiaAte)}
            </Link>
          ))}
        </ListCard>

        <ListCard
          title="Garantias a vencer em 30 dias"
          empty={data.garantiasAVencer.length === 0}
        >
          {data.garantiasAVencer.map((e) => (
            <Link key={e.id} to={`/equipamentos/${e.id}`} className="block hover:underline">
              {e.tombamento} · {e.nome} · {formatDatePt(e.garantiaAte)}
            </Link>
          ))}
        </ListCard>

        <ListCard
          title="Manutenção regular a fazer"
          empty={data.manutencoesRegularesVencidas.length === 0}
        >
          {data.manutencoesRegularesVencidas.map((e) => {
            const info = manutencaoRegularInfo({
              intervaloDias: e.categoriaIntervaloManutencaoDias,
              cadastradoEm: e.createdAt,
              ultimaConclusao: e.ultimaManutencaoConclusao,
            })
            return (
              <Link key={e.id} to={`/equipamentos/${e.id}`} className="block hover:underline">
                {e.tombamento} · {e.nome}
                {info.kind === 'due' ? ` · ${info.label}` : ''}
              </Link>
            )
          })}
        </ListCard>

        <ListCard
          title="Manutenções abertas"
          empty={data.manutencoesAbertas.length === 0}
        >
          {data.manutencoesAbertas.map((m) => (
            <Link
              key={m.id}
              to={`/equipamentos/${m.equipamentoId}`}
              className="block hover:underline"
            >
              {m.equipamentoTombamento} · {m.equipamentoNome} · {formatDatePt(m.dataAbertura)}
            </Link>
          ))}
        </ListCard>

        <ListCard
          title="Últimas movimentações"
          empty={data.ultimasMovimentacoes.length === 0}
        >
          {data.ultimasMovimentacoes.map((m) => (
            <Link
              key={m.id}
              to={`/equipamentos/${m.equipamentoId}`}
              className="block hover:underline"
            >
              {m.equipamentoTombamento} · {m.setorOrigemNome ?? 'Cadastro'} →{' '}
              {m.setorDestinoNome} · {formatDatePt(m.dataMovimentacao)}
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
