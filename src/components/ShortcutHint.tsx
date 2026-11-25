export function ShortcutHint({ keys }: { keys: string }) {
  return (
    <kbd className="pointer-events-none ml-1 hidden rounded border border-current/25 px-1 font-mono text-[10px] font-normal leading-4 sm:inline">
      {keys}
    </kbd>
  )
}
