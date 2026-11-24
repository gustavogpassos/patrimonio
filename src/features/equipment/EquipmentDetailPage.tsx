import { RegularMaintenanceBadge } from '@/components/RegularMaintenanceBadge'
import { MaintenanceStateBadge, StatusBadge } from '@/components/StatusBadge'
import { WarrantyBadge } from '@/components/WarrantyBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CancelMaintenanceDialog,
  CompleteMaintenanceDialog,
  OpenMaintenanceDialog,
} from '@/features/maintenance/MaintenanceDialogs'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import type { EquipmentDetail, Maintenance } from '@/lib/types'
import { MAINTENANCE_TYPE_LABELS } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DeleteDialog } from './DeleteDialog'
import { TransferDialog } from './TransferDialog'
import { WriteOffDialog } from './WriteOffDialog'

export function EquipmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [openMaintenance, setOpenMaintenance] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<Maintenance | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Maintenance | null>(null)

  async function load() {
    if (!id) return
    try {
      setEquipment(await api.getEquipment(Number(id)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  async function reactivate() {
    if (!equipment) return
    if (!window.confirm('Status will return to In stock.')) return
    try {
      await api.reactivate(equipment.id)
      toast.success('Equipment reactivated')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  if (!equipment) return <p className="text-muted-foreground">Loading…</p>

  const writtenOff = equipment.status === 'written_off'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{equipment.name}</h2>
            <StatusBadge status={equipment.status} />
          </div>
          <p className="text-muted-foreground">{equipment.assetTag}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/equipment/${equipment.id}/edit`}>Edit</Link>
          </Button>
          {!writtenOff && (
            <>
              <Button variant="outline" onClick={() => setTransferOpen(true)}>
                Transfer
              </Button>
              <Button variant="outline" onClick={() => setOpenMaintenance(true)}>
                New maintenance
              </Button>
              <Button variant="outline" onClick={() => setWriteOffOpen(true)}>
                Write off
              </Button>
            </>
          )}
          {writtenOff && (
            <Button variant="outline" onClick={() => void reactivate()}>
              Reactivate
            </Button>
          )}
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Category" value={equipment.categoryName} inactive={!equipment.categoryActive} />
            <Info label="Brand" value={equipment.brand} />
            <Info label="Model" value={equipment.model} />
            <Info label="Serial number" value={equipment.serialNumber} />
            <Info label="Acquired" value={formatDate(equipment.acquiredOn)} />
            <Info label="Amount" value={formatBRL(equipment.acquisitionValueCents)} />
            <Info label="Supplier" value={equipment.supplier} />
            <Info label="Invoice" value={equipment.invoice} />
            <div className="sm:col-span-2">
              <Info label="Description" value={equipment.description} />
            </div>
            <div className="sm:col-span-2">
              <Info label="Notes" value={equipment.notes} />
            </div>
            {writtenOff && (
              <>
                <Info label="Write-off date" value={formatDate(equipment.writtenOffOn)} />
                <Info label="Write-off reason" value={equipment.writeOffReason} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location and warranty</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Info label="Sector" value={equipment.sectorName} inactive={!equipment.sectorActive} />
            <Info label="Location" value={equipment.location} />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Warranty</span>
              <WarrantyBadge warrantyUntil={equipment.warrantyUntil} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Regular maintenance</span>
              <RegularMaintenanceBadge
                intervalDays={
                  equipment.categoryRegularMaintenance
                    ? equipment.categoryMaintenanceIntervalDays
                    : null
                }
                registeredAt={equipment.createdAt}
                lastCompletedOn={equipment.lastMaintenanceCompletedAt}
                writtenOff={equipment.status === 'written_off'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>{formatDate(transfer.transferredOn)}</TableCell>
                  <TableCell>
                    {transfer.fromSectorName ?? 'Registration'}
                    {transfer.fromLocation ? ` · ${transfer.fromLocation}` : ''}
                  </TableCell>
                  <TableCell>
                    {transfer.toSectorName}
                    {transfer.toLocation ? ` · ${transfer.toLocation}` : ''}
                  </TableCell>
                  <TableCell>{transfer.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opened</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.maintenance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No maintenance.
                  </TableCell>
                </TableRow>
              ) : (
                equipment.maintenance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.openedOn)}</TableCell>
                    <TableCell>{MAINTENANCE_TYPE_LABELS[record.type]}</TableCell>
                    <TableCell>
                      <MaintenanceStateBadge state={record.state} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{record.problem}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {record.state === 'open' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setCompleteTarget(record)}>
                            Complete
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setCancelTarget(record)}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        equipment={equipment}
        onDone={() => void load()}
      />
      <WriteOffDialog
        open={writeOffOpen}
        onOpenChange={setWriteOffOpen}
        equipment={equipment}
        onDone={() => void load()}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        equipment={equipment}
        onDone={() => navigate('/equipment')}
      />
      <OpenMaintenanceDialog
        open={openMaintenance}
        onOpenChange={setOpenMaintenance}
        equipmentId={equipment.id}
        onDone={() => void load()}
      />
      <CompleteMaintenanceDialog
        open={Boolean(completeTarget)}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        maintenance={completeTarget}
        onDone={() => void load()}
      />
      <CancelMaintenanceDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        maintenance={cancelTarget}
        onDone={() => void load()}
      />
    </div>
  )
}

function Info({
  label,
  value,
  inactive,
}: {
  label: string
  value: string | null | undefined
  inactive?: boolean
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>
        {value || '—'}
        {inactive && (
          <Badge variant="outline" className="ml-2">
            Inactive
          </Badge>
        )}
      </div>
    </div>
  )
}
