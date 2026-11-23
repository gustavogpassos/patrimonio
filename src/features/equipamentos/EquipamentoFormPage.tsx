import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatBRLPlain, parseBRLToCentavos } from '@/lib/money'
import type { Categoria, Setor } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

export function EquipamentoFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)

  const [tombamento, setTombamento] = useState('')
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [setorId, setSetorId] = useState('')
  const [complementoLocal, setComplementoLocal] = useState('')
  const [status, setStatus] = useState<'em_estoque' | 'em_uso'>('em_estoque')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [numeroSerie, setNumeroSerie] = useState('')
  const [dataAquisicao, setDataAquisicao] = useState('')
  const [valor, setValor] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [garantiaAte, setGarantiaAte] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [setorNome, setSetorNome] = useState('')
  const [temManutencaoAberta, setTemManutencaoAberta] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [cats, sets] = await Promise.all([
          api.listCategorias(false),
          api.listSetores(false),
        ])
        setCategorias(cats)
        setSetores(sets)

        if (isEdit && id) {
          const e = await api.getEquipamento(Number(id))
          setTombamento(e.tombamento)
          setNome(e.nome)
          setDescricao(e.descricao ?? '')
          setCategoriaId(String(e.categoriaId))
          setSetorId(String(e.setorId))
          setSetorNome(e.setorNome)
          setComplementoLocal(e.complementoLocal ?? '')
          setMarca(e.marca ?? '')
          setModelo(e.modelo ?? '')
          setNumeroSerie(e.numeroSerie ?? '')
          setDataAquisicao(e.dataAquisicao ?? '')
          setValor(
            e.valorAquisicaoCentavos != null
              ? formatBRLPlain(e.valorAquisicaoCentavos)
              : '',
          )
          setFornecedor(e.fornecedor ?? '')
          setNotaFiscal(e.notaFiscal ?? '')
          setGarantiaAte(e.garantiaAte ?? '')
          setObservacoes(e.observacoes ?? '')
          setTemManutencaoAberta(e.temManutencaoAberta)
        } else {
          const next = await api.nextTombamento()
          setTombamento(next.tombamento)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, isEdit])

  async function save() {
    try {
      let valorCentavos: number | null = null
      try {
        valorCentavos = parseBRLToCentavos(valor)
      } catch {
        toast.error('Valor inválido')
        return
      }

      if (isEdit && id) {
        const updated = await api.updateEquipamento(Number(id), {
          tombamento,
          nome,
          descricao,
          categoriaId: Number(categoriaId),
          marca,
          modelo,
          numeroSerie,
          dataAquisicao,
          valorAquisicaoCentavos: valorCentavos,
          fornecedor,
          notaFiscal,
          garantiaAte,
          observacoes,
        })
        toast.success('Equipamento atualizado')
        navigate(`/equipamentos/${updated.id}`)
      } else {
        const created = await api.createEquipamento({
          tombamento,
          nome,
          descricao,
          categoriaId: Number(categoriaId),
          setorId: Number(setorId),
          complementoLocal,
          status,
          marca,
          modelo,
          numeroSerie,
          dataAquisicao,
          valorAquisicaoCentavos: valorCentavos,
          fornecedor,
          notaFiscal,
          garantiaAte,
          observacoes,
        })
        toast.success('Equipamento cadastrado')
        navigate(`/equipamentos/${created.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          {isEdit ? 'Editar equipamento' : 'Novo equipamento'}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tombamento">
          <Input value={tombamento} onChange={(e) => setTombamento(e.target.value)} />
        </Field>
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {!isEdit && (
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as 'em_estoque' | 'em_uso')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_estoque">Em estoque</SelectItem>
                <SelectItem value="em_uso">Em uso</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {isEdit ? (
          <>
            <Field label="Setor">
              <Input value={setorNome} disabled />
            </Field>
            <Field label="Complemento">
              <Input value={complementoLocal} disabled />
            </Field>
            {temManutencaoAberta && (
              <p className="sm:col-span-2 text-sm text-amber-700">
                Status travado enquanto houver manutenção aberta.
              </p>
            )}
          </>
        ) : (
          <>
            <Field label="Setor">
              <Select value={setorId} onValueChange={setSetorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Complemento">
              <Input
                value={complementoLocal}
                onChange={(e) => setComplementoLocal(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Marca">
          <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
        </Field>
        <Field label="Modelo">
          <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </Field>
        <Field label="Número de série">
          <Input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
        </Field>
        <Field label="Data de aquisição">
          <Input
            type="date"
            value={dataAquisicao}
            onChange={(e) => setDataAquisicao(e.target.value)}
          />
        </Field>
        <Field label="Valor (R$)">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Fornecedor">
          <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
        </Field>
        <Field label="Nota fiscal">
          <Input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
        </Field>
        <Field label="Garantia até">
          <Input
            type="date"
            value={garantiaAte}
            onChange={(e) => setGarantiaAte(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2 space-y-1">
          <Label>Descrição</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void save()}>Salvar</Button>
        <Button variant="outline" asChild>
          <Link to={isEdit && id ? `/equipamentos/${id}` : '/equipamentos'}>
            Cancelar
          </Link>
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
