const LIST_KEYS = ['q', 'categoryId', 'sectorId', 'status', 'page'] as const

export function equipmentListSearch(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('listSearch' in state)) return ''
  const raw = (state as { listSearch: unknown }).listSearch
  if (typeof raw !== 'string' || raw === '') return ''
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const next = new URLSearchParams()
  for (const key of LIST_KEYS) {
    const value = params.get(key)
    if (value) next.set(key, value)
  }
  return next.toString()
}

export function equipmentListPath(state: unknown): string {
  const search = equipmentListSearch(state)
  return search ? `/equipment?${search}` : '/equipment'
}

export function wasJustCreated(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'created' in state &&
    (state as { created: unknown }).created === true
  )
}
