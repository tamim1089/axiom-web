import { useMemo } from 'react'
import {
  Archive,
  Code2,
  FileText,
  Files,
  Film,
  Image as ImageIcon,
  Clock,
  Music,
  FileType,
} from 'lucide-react'
import { COLLECTIONS, useLibrary, type Collection } from '@/store/library'
import { bytes } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONS: Record<Collection, typeof Files> = {
  all: Files,
  recent: Clock,
  image: ImageIcon,
  video: Film,
  audio: Music,
  doc: FileText,
  code: Code2,
  pdf: FileType,
  archive: Archive,
  other: Files,
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const files = useLibrary((s) => s.files)
  const collection = useLibrary((s) => s.collection)
  const setCollection = useLibrary((s) => s.setCollection)

  /* Counts come from the loaded set, so a collection with nothing in it can be
     dimmed rather than leading somewhere empty. */
  const stats = useMemo(() => {
    const counts = new Map<Collection, number>()
    const weekAgo = Date.now() - 7 * 86400_000
    let total = 0
    for (const f of files) {
      total += f.size
      counts.set('all', (counts.get('all') ?? 0) + 1)
      counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1)
      if (f.date.getTime() >= weekAgo) counts.set('recent', (counts.get('recent') ?? 0) + 1)
    }
    return { counts, total }
  }, [files])

  return (
    <nav className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-mist/50">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="px-3 pb-3 pt-2 text-small font-medium text-titanium">Library</p>
        <ul className="space-y-1">
          {COLLECTIONS.map(({ key, label }) => {
            const Icon = ICONS[key]
            const count = stats.counts.get(key) ?? 0
            const active = collection === key
            return (
              <li key={key}>
                <button
                  onClick={() => {
                    setCollection(key)
                    onClose?.()
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'tap w-full gap-3 rounded-xl px-3.5 text-left text-body transition-colors',
                    active
                      ? 'bg-ink font-medium text-paper'
                      : count === 0
                        ? 'text-titanium/60 hover:bg-line/60'
                        : 'text-graphite hover:bg-line/60',
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        'text-small tabular-nums',
                        active ? 'text-paper/65' : 'text-titanium',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* No quota bar: there is no quota we control, and drawing a bar against
          a limit we cannot see would be an invented number. */}
      <div className="border-t border-line px-6 py-5">
        <p className="text-small text-titanium">Stored in your Telegram account</p>
        <p className="mt-1 text-[1.5rem] font-semibold tracking-[-0.03em] tabular-nums">
          {bytes(stats.total)}
        </p>
      </div>
    </nav>
  )
}
