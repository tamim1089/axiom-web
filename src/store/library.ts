import { create } from 'zustand'
import { scanFiles, deleteFiles, type AxiomFile } from '@/lib/storage'
import type { FileKind } from '@/lib/format'
import * as tree from '@/lib/folders'
import { ROOT, type FolderState } from '@/lib/folders'
import { emptyOverlay, pullOverlay, pushOverlay, syncEnabled } from '@/lib/sync'

/* ── the library ──────────────────────────────────────────────────────────
 * Collections are derived from what a file *is*, so a new account has working
 * navigation on day one without building anything. Folders sit on top for the
 * organising a person actually wants to do, and are an overlay: filing a file
 * changes this map, never the file.
 *
 * Folders live in localStorage first and sync second. That order matters. The
 * feature has to work on a deployment with no sync configured at all, and a
 * network that is down must never look like folders that are gone.
 * ──────────────────────────────────────────────────────────────────────── */

const FOLDER_CACHE = 'axiom.folders.v1'

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
  /** Folder being browsed. null means a collection is showing instead. */
  folderId: number | null
  folders: FolderState
  /** Bumped on every folder edit; the higher clock wins across devices. */
  clock: number
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

  loadFolders: () => Promise<void>
  /** The new folder's id, or undefined if the name cleaned to nothing. */
  createFolder: (name: string, parent?: number) => number | undefined
  renameFolder: (id: number, name: string) => void
  deleteFolder: (id: number) => void
  moveFolder: (id: number, parent: number) => void
  fileSelected: (folder: number) => void
  setFolder: (id: number | null) => void

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

/** Read the local copy. A broken cache is discarded, never surfaced. */
function cachedFolders(): FolderState {
  try {
    const raw = localStorage.getItem(FOLDER_CACHE)
    if (!raw) return tree.emptyFolders()
    const parsed = JSON.parse(raw) as { folders?: FolderState; clock?: number }
    return parsed.folders ?? tree.emptyFolders()
  } catch {
    return tree.emptyFolders()
  }
}

function cachedClock(): number {
  try {
    const raw = localStorage.getItem(FOLDER_CACHE)
    return raw ? ((JSON.parse(raw) as { clock?: number }).clock ?? 0) : 0
  } catch {
    return 0
  }
}

/* Writes land locally at once and remotely on a trailing timer. Filing ten
   files in a row is one upload, not ten, and the local copy is already correct
   before the first request leaves. */
let pushTimer: ReturnType<typeof setTimeout> | undefined

function persist(folders: FolderState, clock: number): void {
  try {
    localStorage.setItem(FOLDER_CACHE, JSON.stringify({ folders, clock }))
  } catch {
    /* Private mode, or the quota is full. Folders still work for this session. */
  }
  if (!syncEnabled()) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void pushOverlay({ ...emptyOverlay(), folders, clock, updatedAt: Date.now() })
  }, 1200)
}

/** Apply a pure tree operation, then persist. Every folder edit goes through here. */
function commit(
  get: () => LibraryStore,
  set: (partial: Partial<LibraryStore>) => void,
  change: (state: FolderState) => FolderState,
): void {
  const { folders, clock } = get()
  const next = change(folders)
  if (next === folders) return
  const bumped = clock + 1
  set({ folders: next, clock: bumped })
  persist(next, bumped)
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  files: [],
  loading: false,
  collection: 'all',
  folderId: null,
  folders: cachedFolders(),
  clock: cachedClock(),
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

  /* Remote is consulted once, on load, and only wins on a strictly higher
     clock. A device that has been offline making changes keeps them. */
  loadFolders: async () => {
    if (!syncEnabled()) return
    const remote = await pullOverlay()
    if (!remote) return
    const { clock } = get()
    if (remote.clock <= clock) return
    set({ folders: remote.folders, clock: remote.clock })
    persist(remote.folders, remote.clock)
  },

  /* Returns the id rather than leaving the caller to work it out. A caller
     that files a selection into "the folder just created" has to know which
     one that is, and the only handle it had was the last element of the array,
     which is the right answer only while nothing goes wrong. A name of "///"
     cleans to nothing and creates no folder at all, and then the last element
     is some unrelated folder the user never chose. */
  createFolder: (name, parent = ROOT) => {
    const id = tree.nextId(get().folders)
    commit(get, set, (s) => tree.createFolder(s, name, parent))
    return get().folders.folders.some((f) => f.id === id) ? id : undefined
  },
  renameFolder: (id, name) => commit(get, set, (s) => tree.renameFolder(s, id, name)),
  moveFolder: (id, parent) => commit(get, set, (s) => tree.moveFolder(s, id, parent)),

  deleteFolder: (id) => {
    commit(get, set, (s) => tree.deleteFolder(s, id))
    // Do not leave the user staring at a folder that no longer exists.
    if (get().folderId === id) set({ folderId: null, collection: 'all' })
  },

  fileSelected: (folder) => {
    const ids = [...get().selected]
    if (!ids.length) return
    commit(get, set, (s) => tree.placeFiles(s, ids, folder))
    set({ selected: new Set(), anchor: undefined })
  },

  setFolder: (folderId) =>
    set({ folderId, collection: 'all', selected: new Set(), anchor: undefined }),

  setCollection: (collection) =>
    set({ collection, folderId: null, selected: new Set(), anchor: undefined }),
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

/** The visible list: folder or collection, then search, then sort. */
export function visibleFiles(s: LibraryStore): AxiomFile[] {
  const q = s.query.trim().toLowerCase()
  let out = s.files

  if (s.folderId !== null) {
    // Exactly this folder, not its subfolders. A folder that silently included
    // everything beneath it would make moving a file look like it did nothing.
    out = out.filter((f) => (s.folders.placement[f.id] ?? ROOT) === s.folderId)
  } else if (s.collection === 'recent') {
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
