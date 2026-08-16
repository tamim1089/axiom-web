import { create } from 'zustand'
import { uploadFile, downloadFile, type AxiomFile } from '@/lib/storage'

/* ── the transfer queue ───────────────────────────────────────────────────
 * Every transfer carries its own state, its own byte counter, and its own
 * error. Aggregate-only progress ("uploading 12 files…") is the failure mode
 * that makes multi-file uploads feel broken: when one of twelve fails, a
 * single bar cannot say which, and there is nothing to retry.
 *
 * Concurrency is capped because mtcute already parallelises *within* one
 * transfer across several connections. Running many files at once on top of
 * that just splits the same pipe more ways and makes every ETA worse.
 * ──────────────────────────────────────────────────────────────────────── */

const MAX_CONCURRENT = 2
/** Speed is smoothed; raw deltas jitter enough to make the number unreadable. */
const SMOOTHING = 0.3

export type TransferState = 'queued' | 'active' | 'done' | 'failed' | 'cancelled'

export type Transfer = {
  id: string
  name: string
  size: number
  direction: 'up' | 'down'
  state: TransferState
  transferred: number
  /** Bytes per second, exponentially smoothed. */
  speed: number
  error?: string
  startedAt?: number
  lastTick?: { at: number; bytes: number }
  controller?: AbortController
  /** Retained so a failed upload can be retried without re-picking the file. */
  file?: File
  target?: AxiomFile
}

type TransferStore = {
  transfers: Transfer[]
  dockOpen: boolean
  enqueueUploads: (files: File[]) => void
  enqueueDownload: (file: AxiomFile) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  clearFinished: () => void
  setDockOpen: (open: boolean) => void
  /** Set by the app so a finished upload can drop straight into the grid. */
  onUploaded?: (file: AxiomFile) => void
  setOnUploaded: (fn: (file: AxiomFile) => void) => void
}

let seq = 0
const nextId = () => `t${++seq}`

export const useTransfers = create<TransferStore>((set, get) => {
  const patch = (id: string, next: Partial<Transfer>) =>
    set((s) => ({
      transfers: s.transfers.map((t) => (t.id === id ? { ...t, ...next } : t)),
    }))

  const progress = (id: string) => (transferred: number, total: number) => {
    const t = get().transfers.find((x) => x.id === id)
    if (!t) return
    const now = performance.now()
    let speed = t.speed
    if (t.lastTick) {
      const dt = (now - t.lastTick.at) / 1000
      if (dt > 0.25) {
        const instant = (transferred - t.lastTick.bytes) / dt
        speed = t.speed ? t.speed * (1 - SMOOTHING) + instant * SMOOTHING : instant
        patch(id, { transferred, speed, lastTick: { at: now, bytes: transferred } })
        return
      }
      patch(id, { transferred })
      return
    }
    patch(id, {
      transferred,
      size: t.size || total,
      lastTick: { at: now, bytes: transferred },
    })
  }

  /** Start whatever the concurrency budget allows, oldest first. */
  const pump = () => {
    const { transfers } = get()
    const active = transfers.filter((t) => t.state === 'active').length
    const slots = MAX_CONCURRENT - active
    if (slots <= 0) return

    for (const t of transfers.filter((x) => x.state === 'queued').slice(0, slots)) {
      const controller = new AbortController()
      patch(t.id, { state: 'active', controller, startedAt: performance.now() })

      const run =
        t.direction === 'up'
          ? uploadFile(t.file!, { onProgress: progress(t.id), signal: controller.signal }).then(
              (uploaded) => {
                if (uploaded) get().onUploaded?.(uploaded)
              },
            )
          : downloadFile(t.target!, { onProgress: progress(t.id), signal: controller.signal })

      run
        .then(() => patch(t.id, { state: 'done', transferred: get().transfers.find((x) => x.id === t.id)?.size ?? 0 }))
        .catch((err: unknown) => {
          const aborted = controller.signal.aborted
          patch(t.id, {
            state: aborted ? 'cancelled' : 'failed',
            // A cancelled save dialog is a decision, not a failure to report.
            error: aborted ? undefined : err instanceof Error ? err.message : String(err),
          })
        })
        .finally(pump)
    }
  }

  return {
    transfers: [],
    dockOpen: true,

    setOnUploaded: (fn) => set({ onUploaded: fn }),
    setDockOpen: (dockOpen) => set({ dockOpen }),

    enqueueUploads: (files) => {
      if (!files.length) return
      set((s) => ({
        dockOpen: true,
        transfers: [
          ...s.transfers,
          ...files.map((file) => ({
            id: nextId(),
            name: file.name,
            size: file.size,
            direction: 'up' as const,
            state: 'queued' as const,
            transferred: 0,
            speed: 0,
            file,
          })),
        ],
      }))
      pump()
    },

    enqueueDownload: (target) => {
      set((s) => ({
        dockOpen: true,
        transfers: [
          ...s.transfers,
          {
            id: nextId(),
            name: target.name,
            size: target.size,
            direction: 'down' as const,
            state: 'queued' as const,
            transferred: 0,
            speed: 0,
            target,
          },
        ],
      }))
      pump()
    },

    cancel: (id) => {
      get().transfers.find((t) => t.id === id)?.controller?.abort()
      patch(id, { state: 'cancelled' })
      pump()
    },

    retry: (id) => {
      patch(id, {
        state: 'queued',
        transferred: 0,
        speed: 0,
        error: undefined,
        lastTick: undefined,
      })
      pump()
    },

    clearFinished: () =>
      set((s) => ({
        transfers: s.transfers.filter((t) => t.state === 'active' || t.state === 'queued'),
      })),
  }
})
