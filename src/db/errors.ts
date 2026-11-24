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
    return new AppError('An equipment item with this asset tag already exists.')
  }
  if (message.includes('UNIQUE') && message.includes('serial')) {
    return new AppError('An equipment item with this serial number already exists.')
  }
  if (message.includes('UNIQUE') && message.includes('sectors')) {
    return new AppError('A sector with this name already exists.')
  }
  if (message.includes('UNIQUE') && message.includes('categories')) {
    return new AppError('A category with this name already exists.')
  }
  if (message.includes('UNIQUE') && message.includes('maintenance_one_open')) {
    return new AppError('This equipment already has an open maintenance order.')
  }
  return new AppError('Could not complete the operation.')
}

export function wrapDb<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    throw mapSqliteError(err)
  }
}
