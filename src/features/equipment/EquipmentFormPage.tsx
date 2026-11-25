import { ShortcutHint } from '@/components/ShortcutHint'
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
import { formatBRLPlain, parseBRLToCents } from '@/lib/money'
import { useShortcut } from '@/lib/shortcuts'
import type { Category, EquipmentStatus, Sector } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

export function EquipmentFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)

  const [assetTag, setAssetTag] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<'in_stock' | 'in_use'>('in_stock')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [acquiredOn, setAcquiredOn] = useState('')
  const [amount, setAmount] = useState('')
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [warrantyUntil, setWarrantyUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [sectorName, setSectorName] = useState('')
  const [hasOpenMaintenance, setHasOpenMaintenance] = useState(false)
  const [recordStatus, setRecordStatus] = useState<EquipmentStatus | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [categoryList, sectorList] = await Promise.all([
          api.listCategories(false),
          api.listSectors(false),
        ])
        setCategories(categoryList)
        setSectors(sectorList)

        if (isEdit && id) {
          const equipment = await api.getEquipment(Number(id))
          setAssetTag(equipment.assetTag)
          setName(equipment.name)
          setDescription(equipment.description ?? '')
          setCategoryId(String(equipment.categoryId))
          setSectorId(String(equipment.sectorId))
          setSectorName(equipment.sectorName)
          setLocation(equipment.location ?? '')
          setBrand(equipment.brand ?? '')
          setModel(equipment.model ?? '')
          setSerialNumber(equipment.serialNumber ?? '')
          setAcquiredOn(equipment.acquiredOn ?? '')
          setAmount(
            equipment.acquisitionValueCents != null
              ? formatBRLPlain(equipment.acquisitionValueCents)
              : '',
          )
          setSupplier(equipment.supplier ?? '')
          setInvoice(equipment.invoice ?? '')
          setWarrantyUntil(equipment.warrantyUntil ?? '')
          setNotes(equipment.notes ?? '')
          setHasOpenMaintenance(equipment.hasOpenMaintenance)
          setRecordStatus(equipment.status)
          if (equipment.status === 'in_stock' || equipment.status === 'in_use') {
            setStatus(equipment.status)
          }
        } else {
          const next = await api.nextAssetTag()
          setAssetTag(next.assetTag)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, isEdit])

  useShortcut('s', () => void save(), { enabled: !loading, allowInField: true })

  async function save() {
    try {
      let acquisitionValueCents: number | null = null
      try {
        acquisitionValueCents = parseBRLToCents(amount)
      } catch {
        toast.error('Valor inválido')
        return
      }

      if (isEdit && id) {
        const updated = await api.updateEquipment(Number(id), {
          assetTag,
          name,
          description,
          categoryId: Number(categoryId),
          brand,
          model,
          serialNumber,
          acquiredOn,
          acquisitionValueCents,
          supplier,
          invoice,
          warrantyUntil,
          notes,
          ...(recordStatus === 'in_stock' ? { status } : {}),
        })
        toast.success('Equipamento atualizado')
        navigate(`/equipment/${updated.id}`)
      } else {
        const created = await api.createEquipment({
          assetTag,
          name,
          description,
          categoryId: Number(categoryId),
          sectorId: Number(sectorId),
          location,
          status,
          brand,
          model,
          serialNumber,
          acquiredOn,
          acquisitionValueCents,
          supplier,
          invoice,
          warrantyUntil,
          notes,
        })
        toast.success('Equipamento cadastrado')
        navigate(`/equipment/${created.id}`)
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
        <p className="hidden text-xs text-muted-foreground sm:block">Ctrl+S salva o formulário.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tombamento">
          <Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
        </Field>
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {(!isEdit || recordStatus === 'in_stock') && (
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as 'in_stock' | 'in_use')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">Em estoque</SelectItem>
                <SelectItem value="in_use">Em uso</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {isEdit ? (
          <>
            <Field label="Setor">
              <Input value={sectorName} disabled />
            </Field>
            <Field label="Localização">
              <Input value={location} disabled />
            </Field>
            {hasOpenMaintenance && (
              <p className="sm:col-span-2 text-sm text-amber-700">
                Status travado enquanto houver manutenção aberta.
              </p>
            )}
          </>
        ) : (
          <>
            <Field label="Setor">
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={String(sector.id)}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Localização">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Marca">
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label="Modelo">
          <Input value={model} onChange={(e) => setModel(e.target.value)} />
        </Field>
        <Field label="Valor (R$)">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <div className="sm:col-span-2 space-y-1">
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void save()} aria-keyshortcuts="Control+S">
          Salvar
          <ShortcutHint keys="Ctrl S" />
        </Button>
        <Button variant="outline" asChild>
          <Link to={isEdit && id ? `/equipment/${id}` : '/equipment'}>
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
