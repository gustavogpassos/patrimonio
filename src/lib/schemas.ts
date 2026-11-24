import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null
      const t = v.trim()
      return t.length === 0 ? null : t
    })
    .refine((v) => v == null || v.length <= max, { message: `Máximo de ${max} caracteres` })

const requiredText = (min: number, max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(min).max(max))

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null
    const t = v.trim()
    return t.length === 0 ? null : t
  })
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Data inválida',
  })

export const sectorSchema = z.object({
  name: requiredText(2, 80),
  description: optionalText(500),
  active: z.boolean().default(true),
})

export const categorySchema = z.object({
  name: requiredText(2, 80),
  description: optionalText(500),
  active: z.boolean().default(true),
  regularMaintenance: z.boolean().default(false),
  maintenanceIntervalDays: z.number().int().min(1).max(3650).nullable().optional(),
})

export const createEquipmentSchema = z.object({
  assetTag: requiredText(2, 40),
  name: requiredText(2, 120),
  description: optionalText(2000),
  categoryId: z.number().int().positive(),
  sectorId: z.number().int().positive(),
  location: optionalText(120),
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(80),
  status: z.enum(['in_stock', 'in_use']),
  acquiredOn: optionalDate,
  acquisitionValueCents: z.number().int().min(0).nullable().optional(),
  supplier: optionalText(120),
  invoice: optionalText(120),
  warrantyUntil: optionalDate,
  notes: optionalText(2000),
})

export const updateEquipmentSchema = z.object({
  assetTag: requiredText(2, 40),
  name: requiredText(2, 120),
  description: optionalText(2000),
  categoryId: z.number().int().positive(),
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(80),
  acquiredOn: optionalDate,
  acquisitionValueCents: z.number().int().min(0).nullable().optional(),
  supplier: optionalText(120),
  invoice: optionalText(120),
  warrantyUntil: optionalDate,
  notes: optionalText(2000),
})

export const transferSchema = z.object({
  toSectorId: z.number().int().positive(),
  toLocation: optionalText(120),
  transferredOn: dateString,
  reason: requiredText(3, 300),
})

export const writeOffSchema = z.object({
  writtenOffOn: dateString,
  writeOffReason: requiredText(3, 300),
})

export const deleteEquipmentSchema = z.object({
  assetTagConfirmation: requiredText(2, 40),
})

export const openMaintenanceSchema = z.object({
  equipmentId: z.number().int().positive(),
  type: z.enum(['preventive', 'corrective']),
  openedOn: dateString,
  problem: requiredText(3, 2000),
  costCents: z.number().int().min(0).nullable().optional(),
  serviceProvider: optionalText(120),
})

export const completeMaintenanceSchema = z.object({
  completedOn: dateString,
  solution: requiredText(3, 2000),
  costCents: z.number().int().min(0).nullable().optional(),
  serviceProvider: optionalText(120),
  equipmentStatusAfter: z.enum(['in_use', 'in_stock', 'written_off']),
  writeOffReason: z.string().optional().nullable(),
})

export const cancelMaintenanceSchema = z.object({
  cancellationReason: requiredText(3, 300),
})

export type SectorInput = z.infer<typeof sectorSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>
export type TransferInput = z.infer<typeof transferSchema>
export type WriteOffInput = z.infer<typeof writeOffSchema>
export type OpenMaintenanceInput = z.infer<typeof openMaintenanceSchema>
export type CompleteMaintenanceInput = z.infer<typeof completeMaintenanceSchema>
export type CancelMaintenanceInput = z.infer<typeof cancelMaintenanceSchema>
