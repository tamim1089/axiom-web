'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Upload, X } from 'lucide-react'
import { useLibrary, visibleFiles } from '@/store/library'
import { useTransfers } from '@/store/transfers'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { FileGrid } from './FileGrid'
import { TransferDock } from './TransferDock'
import { Preview } from './Preview'

export type SessionUser = { displayName: string; username?: string | null; id: number }

export function Workspace({
  user,
  onSignOut,
}: {
  user: SessionUser
  onSignOut: () => void
}) {
  const store = useLibrary()
  const files = visibleFiles(store)
  const searchRef = useRef<HTMLInputElement>(null)
  const [drawer, setDrawer] = useState(false)
  const [dragging, setDragging] = useState(false)
  const enqueueUploads = useTransfers((s) => s.enqueueUploads)
  const setOnUploaded = useTransfers((s) => s.setOnUploaded)

  const load = store.load
  const addFile = store.addFile

  useEffect(() => {
    void load()
  }, [load])

  // A finished upload drops straight into the grid — rescanning the whole
  // history to discover a file we just created would be absurd.
  useEffect(() => setOnUploaded(addFile), [setOnUploaded, addFile])

  /* ── drag and drop ──────────────────────────────────────────────────────
   * The whole window is the drop target. A dedicated dropzone rectangle asks
   * the user to aim at the one place uploads are allowed; making the surface
   * the target means the gesture works wherever the file is let go.
   *
   * dragenter/dragleave fire for every child element crossed, so the depth
   * counter is what keeps the overlay from flickering on the way in. */
  const depth = useRef(0)
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const dropped = [...(e.dataTransfer?.files ?? [])]
      if (dropped.length) enqueueUploads(dropped)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [enqueueUploads])

  /* ── keyboard ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable

      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing) {
        if (e.key === 'Escape') el?.blur()
        return
      }
      if (useLibrary.getState().preview) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        store.selectAll(files)
        return
      }
      if (e.key === 'Escape') store.clearSelection()
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selected.size) {
        e.preventDefault()
        if (confirm(`Delete ${store.selected.size} file(s) from your Telegram account?`)) {
          void store.removeSelected()
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [files, store])

  const step = useCallback(
    (delta: number) => {
      const current = useLibrary.getState().preview
      if (!current) return
      const i = files.findIndex((f) => f.id === current.id)
      const next = files[i + delta]
      if (next) store.setPreview(next)
    },
    [files, store],
  )

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile library drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 bg-paper lg:hidden"
            >
              <div className="flex h-14 items-center justify-end px-3">
                <button
                  onClick={() => setDrawer(false)}
                  aria-label="Close library"
                  className="tap justify-center rounded-xl px-3 text-titanium hover:bg-mist"
                >
                  <X className="size-6" />
                </button>
              </div>
              <Sidebar onClose={() => setDrawer(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          searchRef={searchRef}
          onMenu={() => setDrawer(true)}
          user={user}
          onSignOut={onSignOut}
        />

        <main className="min-h-0 flex-1">
          {files.length > 0 ? (
            <FileGrid files={files} />
          ) : store.loading ? (
            <Centered>
              <Loader2 className="size-7 animate-spin text-titanium" />
              <p className="text-body text-titanium">Reading your library</p>
            </Centered>
          ) : store.error ? (
            <Centered>
              <p className="text-[1.375rem] font-semibold">Couldn't read your library</p>
              <p className="max-w-sm text-center text-small leading-relaxed text-titanium">
                {store.error}
              </p>
              <button
                onClick={() => void store.load()}
                className="tap mt-3 rounded-xl bg-ink px-6 text-body font-medium text-paper"
              >
                Try again
              </button>
            </Centered>
          ) : store.query ? (
            <Centered>
              <p className="text-[1.375rem] font-semibold">Nothing matches “{store.query}”</p>
              <button
                onClick={() => store.setQuery('')}
                className="tap text-body text-titanium underline-offset-4 hover:text-ink hover:underline"
              >
                Clear search
              </button>
            </Centered>
          ) : (
            /* An empty screen is an invitation to act, not a shrug. */
            <Centered>
              <div className="rounded-2xl border border-dashed border-line p-5">
                <Upload className="size-9 text-titanium" strokeWidth={1.5} />
              </div>
              <p className="text-[1.5rem] font-semibold">Drop files anywhere to upload</p>
              <p className="max-w-sm text-center text-body leading-relaxed text-titanium">
                They go straight to your Telegram account from this browser.
              </p>
            </Centered>
          )}
        </main>
      </div>

      {/* Drop overlay: one calm sheet, drawn above everything, pointer-events
          off so it never eats the drop it is advertising. */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-paper/85 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-signal px-16 py-12">
              <Upload className="size-10 text-signal" strokeWidth={1.75} />
              <p className="text-[1.5rem] font-semibold">Drop to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TransferDock />

      <AnimatePresence>
        {store.preview && (
          <Preview
            file={store.preview}
            onClose={() => store.setPreview(undefined)}
            onStep={step}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6">{children}</div>
  )
}
