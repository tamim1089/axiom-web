import { useEffect, useState } from 'react'
import { Archive, FileText, FileType, Film, Image as ImageIcon, Music, File } from 'lucide-react'
import { getClient } from '@/lib/telegram'
import { ext, type FileKind } from '@/lib/format'
import { primary, type AxiomFile } from '@/lib/storage'
import { cn } from '@/lib/utils'

const GLYPH: Record<FileKind, typeof File> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileType,
  archive: Archive,
  doc: FileText,
  other: File,
}

/* Object URLs are cached for the session and deliberately never revoked while
   the app is open: the virtualizer unmounts tiles constantly as you scroll,
   and revoking on unmount would re-download the same thumbnail every pass. */
const cache = new Map<string, string>()
const failed = new Set<string>()
const inflight = new Map<string, Promise<string | null>>()

async function loadThumb(file: AxiomFile): Promise<string | null> {
  if (cache.has(file.id)) return cache.get(file.id)!
  if (failed.has(file.id)) return null
  if (inflight.has(file.id)) return inflight.get(file.id)!

  const task = (async () => {
    try {
      // Thumbnails live on the first part; later parts are raw tail bytes.
      const media = primary(file) as { thumbnails?: unknown[] } | undefined
      const thumbs = media?.thumbnails
      if (!Array.isArray(thumbs) || !thumbs.length) {
        failed.add(file.id)
        return null
      }
      // Smallest available: these are decoration at ~200px on screen, and the
      // grid can show a hundred at once.
      const buf = await getClient().downloadAsBuffer(thumbs[0] as never)
      const url = URL.createObjectURL(new Blob([buf as BlobPart], { type: 'image/jpeg' }))
      cache.set(file.id, url)
      return url
    } catch {
      failed.add(file.id)
      return null
    } finally {
      inflight.delete(file.id)
    }
  })()

  inflight.set(file.id, task)
  return task
}

export function Thumb({
  file,
  className,
  compact = false,
}: {
  file: AxiomFile
  className?: string
  /** List rows are ~28px; the drawn placeholders are sized for a grid tile. */
  compact?: boolean
}) {
  const visual = file.kind === 'image' || file.kind === 'video'
  const [url, setUrl] = useState<string | null>(() => cache.get(file.id) ?? null)

  useEffect(() => {
    if (!visual || url) return
    let live = true
    void loadThumb(file).then((u) => {
      if (live && u) setUrl(u)
    })
    return () => {
      live = false
    }
  }, [file, visual, url])

  if (url) {
    return (
      <img
        src={url}
        alt=""
        // The box is already sized by its container, but an intrinsic ratio
        // stops the element collapsing to zero height while the thumbnail is
        // still resolving from Telegram.
        width={320}
        height={320}
        loading="lazy"
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
        draggable={false}
      />
    )
  }

  if (compact) {
    const Glyph = GLYPH[file.kind]
    return (
      <div
        className={cn('flex h-full w-full items-center justify-center rounded bg-mist', className)}
      >
        <Glyph className="size-5 text-titanium" strokeWidth={1.75} />
      </div>
    )
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-mist', className)}>
      <Placeholder file={file} />
    </div>
  )
}

/* A tile with nothing but a small icon floating in grey is mostly dead pixels,
   and a grid of them reads as a loading state rather than as files. So the
   non-visual kinds get a drawn stand-in that says what the thing is at a
   glance — the same page motif the landing corridor uses, kept to hairlines
   and titanium so a wall of them stays calm. */
function Placeholder({ file }: { file: AxiomFile }) {
  const label = ext(file.name)

  if (file.kind === 'doc' || file.kind === 'pdf' || file.kind === 'other') {
    return (
      <Sheet label={label}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[2px] rounded-full bg-line"
            // Ragged right edge — four equal bars read as a placeholder.
            style={{ width: `${[86, 72, 90, 54][i]}%` }}
          />
        ))}
      </Sheet>
    )
  }

  if (file.kind === 'archive') {
    return (
      <Sheet label={label}>
        <div className="grid grid-cols-4 gap-[3px]">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={cn('h-[5px] rounded-[1px]', i % 3 === 0 ? 'bg-titanium/40' : 'bg-line')}
            />
          ))}
        </div>
      </Sheet>
    )
  }

  if (file.kind === 'audio') {
    // Deterministic bars from the name, so a file's waveform is always its own.
    const seed = file.name.length
    return (
      <div className="flex h-16 items-center gap-[4px]">
        {Array.from({ length: 13 }, (_, i) => (
          <div
            key={i}
            className="w-[4px] rounded-full bg-titanium/45"
            style={{ height: `${20 + ((seed * (i + 3) * 29) % 80)}%` }}
          />
        ))}
      </div>
    )
  }

  const Glyph = GLYPH[file.kind]
  return (
    <div className="flex flex-col items-center gap-2">
      <Glyph className="size-11 text-titanium" strokeWidth={1.25} />
      <span className="text-small font-medium text-titanium">{label}</span>
    </div>
  )
}

/** A page standing on the tile, proportioned like paper. */
function Sheet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[124px] w-[92px] flex-col rounded-[5px] border border-line bg-paper px-3.5 py-3.5 shadow-[0_1px_3px_rgba(10,10,11,0.05)]">
      <div className="flex flex-1 flex-col justify-start gap-[5px]">{children}</div>
      <span className="mt-1.5 text-[0.6875rem] font-semibold tracking-tight text-titanium">{label}</span>
    </div>
  )
}
