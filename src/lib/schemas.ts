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

export const setorSchema = z.object({
  nome: requiredText(2, 80),
  descricao: optionalText(500),
  ativo: z.boolean().default(true),
})

export const categoriaSchema = z.object({
  nome: requiredText(2, 80),
  descricao: optionalText(500),
  ativo: z.boolean().default(true),
  manutencaoRegular: z.boolean().default(false),
  intervaloManutencaoDias: z.number().int().min(1).max(3650).nullable().optional(),
})

export const createEquipamentoSchema = z.object({
  tombamento: requiredText(2, 40),
  nome: requiredText(2, 120),
  descricao: optionalText(2000),
  categoriaId: z.number().int().positive(),
  setorId: z.number().int().positive(),
  complementoLocal: optionalText(120),
  marca: optionalText(80),
  modelo: optionalText(80),
  numeroSerie: optionalText(80),
  status: z.enum(['em_estoque', 'em_uso']),
  dataAquisicao: optionalDate,
  valorAquisicaoCentavos: z.number().int().min(0).nullable().optional(),
  fornecedor: optionalText(120),
  notaFiscal: optionalText(120),
  garantiaAte: optionalDate,
  observacoes: optionalText(2000),
})

export const updateEquipamentoSchema = z.object({
  tombamento: requiredText(2, 40),
  nome: requiredText(2, 120),
  descricao: optionalText(2000),
  categoriaId: z.number().int().positive(),
  marca: optionalText(80),
  modelo: optionalText(80),
  numeroSerie: optionalText(80),
  dataAquisicao: optionalDate,
  valorAquisicaoCentavos: z.number().int().min(0).nullable().optional(),
  fornecedor: optionalText(120),
  notaFiscal: optionalText(120),
  garantiaAte: optionalDate,
  observacoes: optionalText(2000),
})

export const transferirSchema = z.object({
  setorDestinoId: z.number().int().positive(),
  complementoDestino: optionalText(120),
  dataMovimentacao: dateString,
  motivo: requiredText(3, 300),
})

export const baixarSchema = z.object({
  dataBaixa: dateString,
  motivoBaixa: requiredText(3, 300),
})

export const excluirSchema = z.object({
  tombamentoConfirmacao: requiredText(2, 40),
})

export const abrirManutencaoSchema = z.object({
  equipamentoId: z.number().int().positive(),
  tipo: z.enum(['preventiva', 'corretiva']),
  dataAbertura: dateString,
  descricaoProblema: requiredText(3, 2000),
  custoCentavos: z.number().int().min(0).nullable().optional(),
  fornecedorAssistencia: optionalText(120),
})

export const concluirManutencaoSchema = z.object({
  dataConclusao: dateString,
  solucao: requiredText(3, 2000),
  custoCentavos: z.number().int().min(0).nullable().optional(),
  fornecedorAssistencia: optionalText(120),
  statusEquipamentoApos: z.enum(['em_uso', 'em_estoque', 'baixado']),
  motivoBaixa: z.string().optional().nullable(),
})

export const cancelarManutencaoSchema = z.object({
  motivoCancelamento: requiredText(3, 300),
})

export type SetorInput = z.infer<typeof setorSchema>
export type CategoriaInput = z.infer<typeof categoriaSchema>
export type CreateEquipamentoInput = z.infer<typeof createEquipamentoSchema>
export type UpdateEquipamentoInput = z.infer<typeof updateEquipamentoSchema>
export type TransferirInput = z.infer<typeof transferirSchema>
export type BaixarInput = z.infer<typeof baixarSchema>
export type AbrirManutencaoInput = z.infer<typeof abrirManutencaoSchema>
export type ConcluirManutencaoInput = z.infer<typeof concluirManutencaoSchema>
export type CancelarManutencaoInput = z.infer<typeof cancelarManutencaoSchema>
