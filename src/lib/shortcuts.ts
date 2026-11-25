import { useEffect, useRef } from 'react'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useShortcut(
  key: string,
  onFire: () => void,
  options?: { enabled?: boolean; allowInField?: boolean },
) {
  const enabled = options?.enabled ?? true
  const allowInField = options?.allowInField ?? false
  const onFireRef = useRef(onFire)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    onFireRef.current = onFire
    enabledRef.current = enabled
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.shiftKey) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() !== key.toLowerCase()) return
      if (!allowInField && isTypingTarget(event.target)) return
      event.preventDefault()
      if (!enabledRef.current) return
      onFireRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, allowInField])
}
