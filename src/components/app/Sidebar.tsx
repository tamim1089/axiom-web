import { useMemo, useState } from 'react'
import {
  Archive,
  ChevronRight,
  Code2,
  FileText,
  Files,
  Film,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Clock,
  MoreHorizontal,
  Music,
  FileType,
} from 'lucide-react'
import { COLLECTIONS, useLibrary, type Collection } from '@/store/library'
import { childrenOf, ROOT, type Folder } from '@/lib/folders'
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
  const folderId = useLibrary((s) => s.folderId)
  const folders = useLibrary((s) => s.folders)
  const setCollection = useLibrary((s) => s.setCollection)
  const createFolder = useLibrary((s) => s.createFolder)

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

  /** How many files sit directly in each folder. One pass, not one per row. */
  const perFolder = useMemo(() => {
    const counts = new Map<number, number>()
    for (const f of files) {
      const id = folders.placement[f.id] ?? ROOT
      if (id !== ROOT) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [files, folders.placement])

  const roots = childrenOf(folders, ROOT)

  const addFolder = (parent: number) => {
    const name = prompt(parent === ROOT ? 'New folder' : 'New folder inside this one')
    if (name?.trim()) createFolder(name, parent)
  }

  return (
    <nav className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-mist/50">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="px-3 pb-3 pt-2 text-small font-medium text-titanium">Library</p>
        <ul className="space-y-1">
          {COLLECTIONS.map(({ key, label }) => {
            const Icon = ICONS[key]
            const count = stats.counts.get(key) ?? 0
            const active = folderId === null && collection === key
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

        <div className="mt-7 flex items-center justify-between px-3 pb-2">
          <p className="text-small font-medium text-titanium">Folders</p>
          <button
            onClick={() => addFolder(ROOT)}
            className="flex size-8 items-center justify-center rounded-lg text-titanium transition-colors hover:bg-line/60 hover:text-ink"
            aria-label="New folder"
            title="New folder"
          >
            <FolderPlus className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        {roots.length === 0 ? (
          /* An empty section explains itself rather than sitting blank. */
          <p className="px-3.5 pb-2 text-small leading-relaxed text-titanium/80">
            Make a folder, then select files and file them. Nothing moves inside Telegram.
          </p>
        ) : (
          <ul className="space-y-1">
            {roots.map((folder) => (
              <Branch
                key={folder.id}
                folder={folder}
                depth={0}
                counts={perFolder}
                onNavigate={onClose}
                onAddChild={addFolder}
              />
            ))}
          </ul>
        )}
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

/** One folder row plus, when open, its children. Recursion mirrors the tree. */
function Branch({
  folder,
  depth,
  counts,
  onNavigate,
  onAddChild,
}: {
  folder: Folder
  depth: number
  counts: Map<number, number>
  onNavigate?: () => void
  onAddChild: (parent: number) => void
}) {
  const folders = useLibrary((s) => s.folders)
  const folderId = useLibrary((s) => s.folderId)
  const setFolder = useLibrary((s) => s.setFolder)
  const renameFolder = useLibrary((s) => s.renameFolder)
  const deleteFolder = useLibrary((s) => s.deleteFolder)
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)

  const kids = childrenOf(folders, folder.id)
  const active = folderId === folder.id
  const count = counts.get(folder.id) ?? 0

  return (
    <li>
      <div
        className={cn(
          'group flex items-center rounded-xl transition-colors',
          active ? 'bg-ink text-paper' : 'text-graphite hover:bg-line/60',
        )}
        style={{ paddingLeft: depth * 14 }}
      >
        {/* A disclosure arrow only where there is something to disclose, and it
            keeps its column either way so names stay on one left edge. */}
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={!kids.length}
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={kids.length ? open : undefined}
          className="flex size-8 shrink-0 items-center justify-center disabled:opacity-0"
        >
          <ChevronRight
            className={cn('size-4 transition-transform', open && 'rotate-90')}
            strokeWidth={2}
          />
        </button>

        <button
          onClick={() => {
            setFolder(folder.id)
            onNavigate?.()
          }}
          aria-current={active ? 'page' : undefined}
          className="flex h-11 min-w-0 flex-1 items-center gap-2.5 text-left text-body"
        >
          {open && kids.length ? (
            <FolderOpen className="size-5 shrink-0" strokeWidth={1.75} />
          ) : (
            <FolderClosed className="size-5 shrink-0" strokeWidth={1.75} />
          )}
          <span className={cn('flex-1 truncate', active && 'font-medium')}>{folder.name}</span>
          {count > 0 && (
            <span
              className={cn('text-small tabular-nums', active ? 'text-paper/65' : 'text-titanium')}
            >
              {count}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenu((m) => !m)
            }}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Actions for ${folder.name}`}
            className={cn(
              'mr-1 flex size-8 items-center justify-center rounded-lg transition-opacity',
              // Always reachable by keyboard, revealed on hover by pointer.
              'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
              active ? 'hover:bg-paper/15' : 'hover:bg-line',
            )}
          >
            <MoreHorizontal className="size-4.5" />
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div
                role="menu"
                className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-line bg-paper py-1 text-ink shadow-[0_12px_40px_rgba(10,10,11,0.16)]"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    const name = prompt('Rename folder', folder.name)
                    if (name?.trim()) renameFolder(folder.id, name)
                  }}
                  className="tap w-full px-3.5 text-left text-body hover:bg-mist"
                >
                  Rename
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    onAddChild(folder.id)
                    setOpen(true)
                  }}
                  className="tap w-full px-3.5 text-left text-body hover:bg-mist"
                >
                  New folder inside
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    // Says exactly what happens, because "delete" next to files
                    // reads as deleting files.
                    if (confirm(`Remove the folder “${folder.name}”? Your files are not deleted.`)) {
                      deleteFolder(folder.id)
                    }
                  }}
                  className="tap w-full px-3.5 text-left text-body hover:bg-mist"
                >
                  Remove folder
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {open && kids.length > 0 && (
        <ul className="mt-1 space-y-1">
          {kids.map((child) => (
            <Branch
              key={child.id}
              folder={child}
              depth={depth + 1}
              counts={counts}
              onNavigate={onNavigate}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
