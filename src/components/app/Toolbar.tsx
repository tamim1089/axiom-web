import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownUp,
  Download,
  FolderInput,
  LayoutGrid,
  List,
  Menu,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { COLLECTIONS, useLibrary, visibleFiles, type SortKey } from '@/store/library'
import { pathOf, ROOT } from '@/lib/folders'
import { useTransfers } from '@/store/transfers'
import { Mark } from '@/components/Mark'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { cn } from '@/lib/utils'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
]

export function Toolbar({
  searchRef,
  onMenu,
  user,
  onSignOut,
}: {
  searchRef: React.RefObject<HTMLInputElement | null>
  onMenu: () => void
  user: { displayName: string; username?: string | null }
  onSignOut: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState(false)
  const store = useLibrary()
  const visible = visibleFiles(store)
  const selectedFiles = visible.filter((f) => store.selected.has(f.id))
  const enqueueUploads = useTransfers((s) => s.enqueueUploads)
  const enqueueDownload = useTransfers((s) => s.enqueueDownload)

  const trail = store.folderId === null ? [] : pathOf(store.folders, store.folderId)
  const label = trail.length
    ? trail[trail.length - 1].name
    : (COLLECTIONS.find((c) => c.key === store.collection)?.label ?? 'All files')
  const selecting = selectedFiles.length > 0

  // Dismiss the account menu on any outside click, the behaviour every menu
  // is expected to have and the one that is always forgotten.
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-md">
      <div className="flex h-18 items-center gap-4 px-4 sm:px-6">
        <button
          onClick={onMenu}
          className="tap justify-center rounded-xl px-3 text-titanium transition-colors hover:bg-mist hover:text-ink lg:hidden"
          aria-label="Show library"
        >
          <Menu className="size-6" />
        </button>

        <a href="/" className="hidden items-center gap-2.5 lg:flex" aria-label="Axiom home">
          <Mark className="size-8" />
          <span className="text-[1.25rem] font-semibold tracking-[-0.03em]">Axiom</span>
        </a>

        {/* Search is a peer of the title, not buried in a menu. With a flat
            file list it is the primary way to navigate past a few hundred. */}
        <div className="relative ml-auto w-full max-w-lg lg:ml-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-titanium" />
          <input
            ref={searchRef}
            value={store.query}
            onChange={(e) => store.setQuery(e.target.value)}
            placeholder="Search your files"
            aria-label="Search your files"
            className="h-12 w-full rounded-xl border border-line bg-mist/70 pl-12 pr-11 text-body outline-none transition-colors placeholder:text-titanium focus:border-signal focus:bg-paper"
          />
          {store.query && (
            <button
              onClick={() => store.setQuery('')}
              className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-titanium transition-colors hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-4.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => fileInput.current?.click()}
          className="tap ml-auto gap-2.5 rounded-xl bg-ink px-5 text-body font-medium text-paper transition-opacity hover:opacity-90"
        >
          <Upload className="size-5" strokeWidth={2} />
          <span className="hidden sm:inline">Upload</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            enqueueUploads([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />

        <ThemeSwitcher className="hidden lg:flex" />

        <div className="relative">
          <button
            onClick={(e) => {
              // Without this the window listener above closes it in the same tick.
              e.stopPropagation()
              setMenu((m) => !m)
            }}
            aria-haspopup="menu"
            aria-expanded={menu}
            className="flex size-11 items-center justify-center rounded-full bg-mist text-body font-semibold transition-colors hover:bg-line"
            aria-label="Account"
          >
            {user.displayName.trim().charAt(0).toUpperCase() || '?'}
          </button>

          {menu && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-14 w-72 overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_12px_40px_rgba(10,10,11,0.14)]"
            >
              <div className="border-b border-line px-4 py-3.5">
                <p className="truncate text-body font-medium">{user.displayName}</p>
                <p className="truncate text-small text-titanium">
                  {user.username ? `@${user.username}` : 'Signed in'}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
                <span className="text-body text-graphite">Appearance</span>
                <ThemeSwitcher />
              </div>
              {/* Says what actually happens: the key is erased from this
                  browser, which is the only place it ever existed. */}
              <button
                onClick={onSignOut}
                role="menuitem"
                className="tap w-full px-4 text-left text-body transition-colors hover:bg-mist"
              >
                Sign out and erase this session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Second row swaps between browsing chrome and selection actions, so
          bulk actions never sit greyed out waiting to be relevant. */}
      <div className="flex h-16 items-center gap-2 border-t border-line px-3.5 sm:gap-3 sm:px-6">
        {selecting ? (
          <>
            <button
              onClick={store.clearSelection}
              className="tap justify-center rounded-xl px-3 text-titanium transition-colors hover:bg-mist hover:text-ink"
              aria-label="Clear selection"
            >
              <X className="size-5" />
            </button>
            <span className="text-body font-medium">{selectedFiles.length} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <MoveMenu />
              <button
                onClick={() => selectedFiles.forEach(enqueueDownload)}
                className="tap gap-2 rounded-xl px-4 text-body transition-colors hover:bg-mist"
              >
                <Download className="size-5" strokeWidth={1.75} />
                Download
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} from your Telegram account? This cannot be undone.`,
                    )
                  ) {
                    void store.removeSelected()
                  }
                }}
                className="tap gap-2 rounded-xl px-4 text-body transition-colors hover:bg-mist"
              >
                <Trash2 className="size-5" strokeWidth={1.75} />
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            {/* A breadcrumb only where there is a trail. Collections are one
                level deep, so drawing "Home ›" in front of them is noise. */}
            <nav aria-label="Location" className="flex min-w-0 items-center gap-1.5">
              {trail.length > 0 && (
                <>
                  <button
                    onClick={() => store.setCollection('all')}
                    className="hidden shrink-0 text-body text-titanium transition-colors hover:text-ink sm:inline"
                  >
                    All files
                  </button>
                  {trail.slice(0, -1).map((f) => (
                    <span key={f.id} className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <span className="text-titanium/60">/</span>
                      <button
                        onClick={() => store.setFolder(f.id)}
                        className="max-w-32 truncate text-body text-titanium transition-colors hover:text-ink"
                      >
                        {f.name}
                      </button>
                    </span>
                  ))}
                  <span className="hidden shrink-0 text-titanium/60 sm:inline">/</span>
                </>
              )}
              <h1 className="truncate text-body font-medium">{label}</h1>
            </nav>
            <span className="shrink-0 whitespace-nowrap text-small tabular-nums text-titanium">{visible.length}</span>

            <div className="ml-auto flex items-center gap-1.5">
              <span className="mr-1 hidden text-small text-titanium lg:inline">Sort by</span>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => store.setSort(s.key)}
                  className={cn(
                    // Hidden on phones: six controls will not fit across 390px,
                    // and the direction toggle plus view switch are the two
                    // people actually reach for.
                    'tap hidden rounded-lg px-3 text-small transition-colors sm:inline-flex',
                    store.sort === s.key
                      ? 'bg-mist font-medium text-ink'
                      : 'text-titanium hover:text-ink',
                  )}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={store.toggleDirection}
                className="tap justify-center rounded-lg px-2.5 text-titanium transition-colors hover:bg-mist hover:text-ink"
                aria-label={store.ascending ? 'Sort descending' : 'Sort ascending'}
              >
                <ArrowDownUp className="size-5" strokeWidth={1.75} />
              </button>

              <div className="mx-2 h-6 w-px bg-line" />

              <div className="flex rounded-xl bg-mist p-1">
                {(['grid', 'list'] as const).map((v) => {
                  const Icon = v === 'grid' ? LayoutGrid : List
                  return (
                    <button
                      key={v}
                      onClick={() => store.setView(v)}
                      aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                      aria-pressed={store.view === v}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-lg transition-colors',
                        store.view === v
                          ? 'bg-paper text-ink shadow-sm'
                          : 'text-titanium hover:text-ink',
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

/* Filing is a menu rather than a drag target. Dragging works for one file on a
   wide screen and for nothing else: it has no keyboard equivalent, no touch
   equivalent, and no way to express "these forty". */
function MoveMenu() {
  const folders = useLibrary((s) => s.folders)
  const fileSelected = useLibrary((s) => s.fileSelected)
  const createFolder = useLibrary((s) => s.createFolder)
  const [open, setOpen] = useState(false)

  // Flattened with indent depth, so the tree reads as a tree in a flat list.
  const rows: { id: number; name: string; depth: number }[] = []
  const walk = (parent: number, depth: number) => {
    for (const f of folders.folders
      .filter((f) => f.parent === parent)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      rows.push({ id: f.id, name: f.name, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(ROOT, 0)

  const choose = (id: number) => {
    setOpen(false)
    fileSelected(id)
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="tap gap-2 rounded-xl px-4 text-body transition-colors hover:bg-mist"
      >
        <FolderInput className="size-5" strokeWidth={1.75} />
        <span className="hidden sm:inline">Move to</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-12 z-50 max-h-80 w-64 overflow-y-auto rounded-2xl border border-line bg-paper py-1.5 shadow-[0_12px_40px_rgba(10,10,11,0.16)]"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                const name = prompt('New folder')
                if (!name?.trim()) return
                // Only file the selection if a folder was actually created.
                // A name that survives trim() can still clean to nothing, and
                // filing into "the last folder in the list" then moves files
                // somewhere nobody asked for.
                const created = createFolder(name)
                if (created !== undefined) fileSelected(created)
              }}
              className="tap w-full gap-2 px-3.5 text-left text-body font-medium text-signal hover:bg-mist"
            >
              New folder with these
            </button>

            <div className="my-1.5 h-px bg-line" />

            <button
              role="menuitem"
              onClick={() => choose(ROOT)}
              className="tap w-full px-3.5 text-left text-body hover:bg-mist"
            >
              All files
            </button>
            {rows.map((row) => (
              <button
                key={row.id}
                role="menuitem"
                onClick={() => choose(row.id)}
                style={{ paddingLeft: 14 + row.depth * 14 }}
                className="tap w-full truncate pr-3.5 text-left text-body hover:bg-mist"
              >
                {row.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
