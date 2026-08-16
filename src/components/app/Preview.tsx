'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Download, Loader2, X } from 'lucide-react'
import { objectUrl, type AxiomFile } from '@/lib/storage'
import { ensureStreaming, releaseStream, streamUrl } from '@/lib/stream'
import { useTransfers } from '@/store/transfers'
import { bytes, when } from '@/lib/format'

/* Video and audio stream through the Service Worker, so a 2 GB file opens
   instantly and seeks anywhere without downloading itself first. Images and
   PDFs have no range protocol to exploit — the viewer needs the whole object —
   so those still fetch fully, and are capped. */
const BUFFERED = new Set(['image', 'pdf'])
const STREAMED = new Set(['video', 'audio'])
const BUFFER_CEILING = 96 * 1024 * 1024

type Source = { url: string; streamed: boolean }

export function Preview({
  file,
  onClose,
  onStep,
}: {
  file: AxiomFile
  onClose: () => void
  onStep: (delta: number) => void
}) {
  const [source, setSource] = useState<Source | null>(null)
  const [error, setError] = useState<string | null>(null)
  const enqueueDownload = useTransfers((s) => s.enqueueDownload)

  const streamable = STREAMED.has(file.kind)
  const bufferable = BUFFERED.has(file.kind) && file.size <= BUFFER_CEILING
  const viewable = streamable || bufferable

  useEffect(() => {
    if (!viewable) return
    const ac = new AbortController()
    let created: string | null = null
    setSource(null)
    setError(null)

    void (async () => {
      try {
        if (streamable) {
          await ensureStreaming()
          const url = streamUrl(file)
          if (url) {
            if (!ac.signal.aborted) setSource({ url, streamed: true })
            return
          }
          // No worker (private mode, unsupported browser). Buffering a large
          // video would hang the tab, so say so instead of trying.
          if (file.size > BUFFER_CEILING) {
            throw new Error(
              'Streaming is unavailable in this browser, and this file is too large to load in one piece. Download it to watch.',
            )
          }
        }

        const url = await objectUrl(file, ac.signal)
        if (ac.signal.aborted) {
          URL.revokeObjectURL(url)
          return
        }
        created = url
        setSource({ url, streamed: false })
      } catch (err) {
        if (!ac.signal.aborted) setError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      ac.abort()
      if (created) URL.revokeObjectURL(created)
      releaseStream(file)
    }
  }, [file, viewable, streamable])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onStep(1)
      if (e.key === 'ArrowLeft') onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
    >
      <header className="flex h-18 shrink-0 items-center gap-4 px-5 text-paper">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium">{file.name}</p>
          <p className="text-small text-paper/55">
            {bytes(file.size)} · {when(file.date)}
          </p>
        </div>
        <button
          onClick={() => enqueueDownload(file)}
          className="tap gap-2 rounded-xl bg-paper/12 px-4 text-body transition-colors hover:bg-paper/20"
        >
          <Download className="size-5" strokeWidth={1.75} />
          <span className="hidden sm:inline">Download</span>
        </button>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="tap justify-center rounded-xl px-3 transition-colors hover:bg-paper/12"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
        <StepButton side="left" onClick={() => onStep(-1)} />

        {!viewable ? (
          <div className="text-center text-paper/75">
            <p className="text-lead">No preview for this kind of file</p>
            <p className="mt-3 text-small text-paper/50">
              {file.size > BUFFER_CEILING
                ? 'Too large to open in the browser — download it instead'
                : file.mime}
            </p>
          </div>
        ) : error ? (
          <p className="measure text-center text-small leading-relaxed text-paper/70">{error}</p>
        ) : !source ? (
          <Loader2 className="size-7 animate-spin text-paper/40" />
        ) : file.kind === 'image' ? (
          <img
            src={source.url}
            alt={file.name}
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
        ) : file.kind === 'video' ? (
          <video
            src={source.url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
            onError={() =>
              setError(
                `This browser can't play ${file.mime || 'this format'}. The file itself is fine — download it and it will open in any player.`,
              )
            }
          />
        ) : file.kind === 'audio' ? (
          <audio src={source.url} controls autoPlay className="w-full max-w-lg" />
        ) : (
          <iframe src={source.url} title={file.name} className="h-full w-full rounded-xl bg-paper" />
        )}

        <StepButton side="right" onClick={() => onStep(1)} />
      </div>
    </motion.div>
  )
}

function StepButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous file' : 'Next file'}
      className={`absolute ${side === 'left' ? 'left-3' : 'right-3'} top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-paper/12 text-paper transition-colors hover:bg-paper/22 sm:flex`}
    >
      <Icon className="size-6" />
    </button>
  )
}
