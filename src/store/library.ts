import { create } from 'zustand'
import { scanFiles, deleteFiles, type AxiomFile } from '@/lib/storage'
import type { FileKind } from '@/lib/format'

/* ── the library ──────────────────────────────────────────────────────────
 * Collections are derived from what a file *is*, not from folders the user
 * has to build first. A new account has working navigation on day one, and
 * nothing here needs storage of its own. Which matters when there is no
 * server to keep it in. Real folders arrive later as an overlay on top.
 * ──────────────────────────────────────────────────────────────────────── */

export type Collection = 'all' | 'recent' | FileKind
export type SortKey = 'date' | 'name' | 'size'
export type ViewMode = 'grid' | 'list'

export const COLLECTIONS: { key: Collection; label: string }[] = [
  { key: 'all', label: 'All files' },
  { key: 'recent', label: 'Recents' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Video' },
  { key: 'audio', label: 'Audio' },
  { key: 'doc', label: 'Documents' },
  { key: 'code', label: 'Code' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'archive', label: 'Archives' },
]

type LibraryStore = {
  files: AxiomFile[]
  loading: boolean
  error?: string
  collection: Collection
  query: string
  sort: SortKey
  ascending: boolean
  view: ViewMode
  selected: Set<string>
  /** Anchor for shift-click range selection. */
  anchor?: string
  preview?: AxiomFile

  load: () => Promise<void>
  addFile: (file: AxiomFile) => void
  removeSelected: () => Promise<void>

  setCollection: (c: Collection) => void
  setQuery: (q: string) => void
  setSort: (s: SortKey) => void
  toggleDirection: () => void
  setView: (v: ViewMode) => void
  setPreview: (f?: AxiomFile) => void

  select: (id: string, mode: 'replace' | 'toggle' | 'range', visible: AxiomFile[]) => void
  selectAll: (visible: AxiomFile[]) => void
  clearSelection: () => void
}

let scanToken = 0

export const useLibrary = create<LibraryStore>((set, get) => ({
  files: [],
  loading: false,
  collection: 'all',
  query: '',
  sort: 'date',
  ascending: false,
  view: 'grid',
  selected: new Set(),

  load: async () => {
    const token = ++scanToken
    set({ loading: true, error: undefined, files: [] })
    try {
      await scanFiles((batch) => {
        // A newer scan may have started while this one was mid-flight.
        if (token !== scanToken) return
        set((s) => {
          const known = new Set(s.files.map((f) => f.id))
          const fresh = batch.filter((f) => !known.has(f.id))
          return fresh.length ? { files: [...s.files, ...fresh] } : {}
        })
      })
    } catch (err) {
      if (token === scanToken) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      if (token === scanToken) set({ loading: false })
    }
  },

  addFile: (file) =>
    set((s) => (s.files.some((f) => f.id === file.id) ? {} : { files: [file, ...s.files] })),

  removeSelected: async () => {
    const { files, selected } = get()
    const doomed = files.filter((f) => selected.has(f.id))
    if (!doomed.length) return
    // Optimistic: the grid should not sit still while the round trip happens.
    set({ files: files.filter((f) => !selected.has(f.id)), selected: new Set() })
    try {
      await deleteFiles(doomed)
    } catch (err) {
      // Put them back rather than silently losing rows the server still has.
      set((s) => ({
        files: [...doomed, ...s.files].sort((a, b) => b.date.getTime() - a.date.getTime()),
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  },

  setCollection: (collection) => set({ collection, selected: new Set(), anchor: undefined }),
  setQuery: (query) => set({ query }),
  setSort: (sort) => set({ sort }),
  toggleDirection: () => set((s) => ({ ascending: !s.ascending })),
  setView: (view) => set({ view }),
  setPreview: (preview) => set({ preview }),

  select: (id, mode, visible) => {
    const { selected, anchor } = get()

    if (mode === 'replace') {
      set({ selected: new Set([id]), anchor: id })
      return
    }

    if (mode === 'toggle') {
      const next = new Set(selected)
      next.has(id) ? next.delete(id) : next.add(id)
      set({ selected: next, anchor: id })
      return
    }

    // Range: from the anchor to here, over what is actually on screen. So a
    // shift-click follows the current sort rather than some hidden order.
    const from = visible.findIndex((f) => f.id === (anchor ?? id))
    const to = visible.findIndex((f) => f.id === id)
    if (from === -1 || to === -1) {
      set({ selected: new Set([id]), anchor: id })
      return
    }
    const [lo, hi] = from < to ? [from, to] : [to, from]
    set({ selected: new Set(visible.slice(lo, hi + 1).map((f) => f.id)) })
  },

  selectAll: (visible) => set({ selected: new Set(visible.map((f) => f.id)) }),
  clearSelection: () => set({ selected: new Set(), anchor: undefined }),
}))

/** The visible list: collection filter, then search, then sort. */
export function visibleFiles(s: LibraryStore): AxiomFile[] {
  const q = s.query.trim().toLowerCase()
  let out = s.files

  if (s.collection === 'recent') {
    const weekAgo = Date.now() - 7 * 86400_000
    out = out.filter((f) => f.date.getTime() >= weekAgo)
  } else if (s.collection !== 'all') {
    out = out.filter((f) => f.kind === s.collection)
  }

  if (q) out = out.filter((f) => f.name.toLowerCase().includes(q))

  const dir = s.ascending ? 1 : -1
  return [...out].sort((a, b) => {
    if (s.sort === 'name') return a.name.localeCompare(b.name) * dir
    if (s.sort === 'size') return (a.size - b.size) * dir
    return (a.date.getTime() - b.date.getTime()) * dir
  })
}
