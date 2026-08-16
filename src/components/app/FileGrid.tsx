import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AlertTriangle, Download, Play } from 'lucide-react'
import { useLibrary } from '@/store/library'
import { useTransfers } from '@/store/transfers'
import { bytes, when } from '@/lib/format'
import type { AxiomFile } from '@/lib/storage'
import { Thumb } from './Thumb'
import { cn } from '@/lib/utils'

/* ── the grid ─────────────────────────────────────────────────────────────
 * Virtualized in both modes. A Telegram account can hold tens of thousands of
 * files, and the difference between rendering 40 rows and rendering all of
 * them is the difference between a scroll that tracks the finger and one that
 * does not.
 *
 * Rows, not cells, are the virtualized unit in grid mode: the column count is
 * derived from the measured width, so each row is one fixed-height element and
 * the virtualizer stays one-dimensional.
 * ──────────────────────────────────────────────────────────────────────── */

/* A phone is ~390px wide: at a 232px minimum only one tile fits per row, which
   turns the library into a very long single column. Narrow viewports get a
   smaller minimum so two tiles sit side by side, which is how every native
   photo grid behaves at this width. */
const TILE_MIN_NARROW = 148
const TILE_MIN = 232
const NARROW_AT = 640
const TILE_GAP = 20
const TILE_H = 268
const TILE_H_NARROW = 210
const ROW_H = 60

function useColumns(ref: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ cols: 4, narrow: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const narrow = el.clientWidth < NARROW_AT
      const min = narrow ? TILE_MIN_NARROW : TILE_MIN
      const w = el.clientWidth - (narrow ? 28 : 48)
      setLayout({ cols: Math.max(1, Math.floor((w + TILE_GAP) / (min + TILE_GAP))), narrow })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return layout
}

/** Modifier keys decide the selection verb; centralised so grid and list agree. */
function selectMode(e: React.MouseEvent): 'replace' | 'toggle' | 'range' {
  if (e.shiftKey) return 'range'
  if (e.metaKey || e.ctrlKey) return 'toggle'
  return 'replace'
}

export function FileGrid({ files }: { files: AxiomFile[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const view = useLibrary((s) => s.view)
  const selected = useLibrary((s) => s.selected)
  const select = useLibrary((s) => s.select)
  const setPreview = useLibrary((s) => s.setPreview)
  const enqueueDownload = useTransfers((s) => s.enqueueDownload)

  const { cols, narrow } = useColumns(scrollRef)
  const isGrid = view === 'grid'
  const rowCount = isGrid ? Math.ceil(files.length / cols) : files.length

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (isGrid ? (narrow ? TILE_H_NARROW : TILE_H) + TILE_GAP : ROW_H),
    overscan: 4,
  })

  // Column count and view mode both change row geometry under the virtualizer.
  useEffect(() => virtualizer.measure(), [cols, narrow, view, virtualizer])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-3.5 py-4 sm:px-6 sm:py-6">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const items = isGrid
            ? files.slice(row.index * cols, row.index * cols + cols)
            : [files[row.index]]

          return (
            <div
              key={row.key}
              className={cn('absolute left-0 top-0 w-full', isGrid ? 'grid' : 'block')}
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
                ...(isGrid
                  ? { gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: TILE_GAP }
                  : {}),
              }}
            >
              {items.map((file) =>
                !file ? null : isGrid ? (
                  <Tile
                    key={file.id}
                    file={file}
                    selected={selected.has(file.id)}
                    onSelect={(e) => select(file.id, selectMode(e), files)}
                    onOpen={() => setPreview(file)}
                    onDownload={() => enqueueDownload(file)}
                    height={narrow ? TILE_H_NARROW : TILE_H}
                  />
                ) : (
                  <Row
                    key={file.id}
                    file={file}
                    selected={selected.has(file.id)}
                    onSelect={(e) => select(file.id, selectMode(e), files)}
                    onOpen={() => setPreview(file)}
                  />
                ),
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ItemProps = {
  file: AxiomFile
  selected: boolean
  onSelect: (e: React.MouseEvent) => void
  onOpen: () => void
}

function Tile({
  file,
  selected,
  onSelect,
  onOpen,
  onDownload,
  height,
}: ItemProps & { onDownload: () => void; height: number }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      className={cn(
        'group relative flex cursor-default flex-col overflow-hidden rounded-xl border transition-colors',
        selected
          ? 'border-signal bg-signal/[0.06] ring-1 ring-signal'
          : 'border-line bg-paper hover:border-titanium/40',
      )}
      style={{ height }}
    >
      <div className="relative flex-1 overflow-hidden bg-mist">
        <Thumb file={file} />
        {file.kind === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-ink/60 p-3.5 backdrop-blur-sm">
              <Play className="size-6 fill-paper text-paper" />
            </div>
          </div>
        )}
        {!file.complete && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/85 px-3 py-2 text-tiny text-paper backdrop-blur-sm">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            Missing parts
          </div>
        )}
        {/* Download stays hidden until intent is shown, so a wall of tiles is
            files rather than a wall of buttons. */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDownload()
          }}
          aria-label={`Download ${file.name}`}
          className="absolute right-2.5 top-2.5 flex size-10 items-center justify-center rounded-xl bg-paper/92 opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-paper focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Download className="size-5 text-ink" strokeWidth={1.75} />
        </button>
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3.5">
        <p className="truncate text-body font-medium leading-snug" title={file.name}>
          {file.name}
        </p>
        <p className="mt-1 text-small text-titanium">
          {bytes(file.size)} · {when(file.date)}
        </p>
      </div>
    </div>
  )
}

function Row({ file, selected, onSelect, onOpen }: ItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      className={cn(
        'flex h-15 cursor-default items-center gap-4 rounded-xl px-4 transition-colors',
        selected ? 'bg-signal/10 ring-1 ring-inset ring-signal/40' : 'hover:bg-mist',
      )}
    >
      <div className="size-10 shrink-0 overflow-hidden rounded-lg">
        <Thumb file={file} compact />
      </div>
      <p className="min-w-0 flex-1 truncate text-body" title={file.name}>
        {file.name}
      </p>
      {!file.complete && (
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-mist px-2.5 py-1 text-tiny text-graphite"
          title="Some parts of this file are missing, so it cannot be rebuilt."
        >
          <AlertTriangle className="size-3.5" strokeWidth={2} />
          Incomplete
        </span>
      )}
      <p className="hidden w-28 shrink-0 text-right text-small tabular-nums text-titanium sm:block">
        {bytes(file.size)}
      </p>
      <p className="w-28 shrink-0 text-right text-small text-titanium">{when(file.date)}</p>
    </div>
  )
}
