export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function mapSqliteError(err: unknown): Error {
  if (err instanceof AppError) return err
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('UNIQUE') && message.includes('asset_tag')) {
    return new AppError('Já existe um equipamento com este tombamento.')
  }
  if (message.includes('UNIQUE') && message.includes('serial')) {
    return new AppError('Já existe um equipamento com este número de série.')
  }
  if (message.includes('UNIQUE') && message.includes('sectors')) {
    return new AppError('Já existe um setor com este nome.')
  }
  if (message.includes('UNIQUE') && message.includes('categories')) {
    return new AppError('Já existe uma categoria com este nome.')
  }
  if (message.includes('UNIQUE') && message.includes('maintenance_one_open')) {
    return new AppError('Este equipamento já possui uma manutenção aberta.')
  }
  return new AppError('Não foi possível concluir a operação.')
}

export function wrapDb<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    throw mapSqliteError(err)
  }
}
