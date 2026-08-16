'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, ChevronDown, RotateCw, X } from 'lucide-react'
import { useTransfers, type Transfer } from '@/store/transfers'
import { bytes, eta, rate } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ── the dock ─────────────────────────────────────────────────────────────
 * One row per transfer, each with its own state, its own bytes, and its own
 * retry. The thing that makes multi-file upload UIs fail is collapsing all of
 * that into a single aggregate bar: when three of twenty fail, an aggregate
 * can't say which three, and offers nothing to act on.
 * ──────────────────────────────────────────────────────────────────────── */

export function TransferDock() {
  const transfers = useTransfers((s) => s.transfers)
  const dockOpen = useTransfers((s) => s.dockOpen)
  const setDockOpen = useTransfers((s) => s.setDockOpen)
  const clearFinished = useTransfers((s) => s.clearFinished)

  if (!transfers.length) return null

  const running = transfers.filter((t) => t.state === 'active' || t.state === 'queued')
  const failed = transfers.filter((t) => t.state === 'failed')

  const summary = running.length
    ? `${running.length} transfer${running.length > 1 ? 's' : ''}`
    : failed.length
      ? `${failed.length} failed`
      : 'Transfers complete'

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="pointer-events-auto fixed bottom-4 right-4 z-40 w-[min(27rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-paper shadow-[0_8px_30px_rgba(10,10,11,0.12)]"
    >
      <div className="flex h-16 items-center gap-3 border-b border-line px-4">
        <span className="text-body font-medium">{summary}</span>
        {running.length > 0 && (
          <span className="size-2 animate-pulse rounded-full bg-signal" aria-hidden />
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {!running.length && (
            <button
              onClick={clearFinished}
              className="tap rounded-lg px-3 text-small text-titanium transition-colors hover:text-ink"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setDockOpen(!dockOpen)}
            aria-label={dockOpen ? 'Collapse transfers' : 'Expand transfers'}
            className="tap justify-center rounded-lg px-2.5 text-titanium transition-colors hover:bg-mist hover:text-ink"
          >
            <ChevronDown
              className={cn('size-5 transition-transform', !dockOpen && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {dockOpen && (
          <motion.ul
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="max-h-96 overflow-y-auto"
          >
            {transfers.map((t) => (
              <TransferRow key={t.id} transfer={t} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TransferRow({ transfer: t }: { transfer: Transfer }) {
  const cancel = useTransfers((s) => s.cancel)
  const retry = useTransfers((s) => s.retry)

  const pct = t.size ? Math.min(100, (t.transferred / t.size) * 100) : 0
  const remaining = t.speed > 0 ? (t.size - t.transferred) / t.speed : Infinity
  const Icon = t.direction === 'up' ? ArrowUp : ArrowDown

  const detail =
    t.state === 'active'
      ? `${bytes(t.transferred)} of ${bytes(t.size)} · ${rate(t.speed)} · ${eta(remaining)} left`
      : t.state === 'queued'
        ? 'Waiting'
        : t.state === 'done'
          ? bytes(t.size)
          : t.state === 'cancelled'
            ? 'Cancelled'
            : (t.error ?? 'Failed')

  return (
    <li className="border-b border-line/70 px-4 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <Icon
          className={cn(
            'size-4 shrink-0',
            t.state === 'done'
              ? 'text-signal'
              : t.state === 'failed'
                ? 'text-ink'
                : 'text-titanium',
          )}
          strokeWidth={2}
        />
        <p className="min-w-0 flex-1 truncate text-body" title={t.name}>
          {t.name}
        </p>

        {(t.state === 'active' || t.state === 'queued') && (
          <button
            onClick={() => cancel(t.id)}
            aria-label={`Cancel ${t.name}`}
            className="flex size-10 items-center justify-center rounded-lg text-titanium transition-colors hover:bg-mist hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        )}
        {(t.state === 'failed' || t.state === 'cancelled') && (
          <button
            onClick={() => retry(t.id)}
            aria-label={`Retry ${t.name}`}
            className="flex size-10 items-center justify-center rounded-lg text-titanium transition-colors hover:bg-mist hover:text-ink"
          >
            <RotateCw className="size-4.5" />
          </button>
        )}
      </div>

      <p
        className={cn(
          'mt-1 truncate text-small',
          t.state === 'failed' ? 'text-ink' : 'text-titanium',
        )}
        title={t.error}
      >
        {detail}
      </p>

      {/* The track only exists while there is progress to describe. */}
      {(t.state === 'active' || t.state === 'queued') && (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </li>
  )
}
