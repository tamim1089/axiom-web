import { getClient } from './telegram'
import { getVaultId } from './vault'
import { kindOf, type FileKind } from './format'
import {
  decodeManifest,
  encodeManifest,
  isComplete,
  planParts,
  sliceRange,
  type PartRef,
} from './multipart'

/* ── the storage service ──────────────────────────────────────────────────
 * The abstraction boundary from the original design notes, except it runs in
 * the tab instead of on a server. Everything above this module deals in
 * AxiomFile and knows nothing about messages, documents, or data centres.
 *
 * Files live in a private channel of the user's own (see vault.ts), and that
 * channel's history is the source of truth, not a separate index. A manifest
 * we maintain can drift, get corrupted, or disagree with reality after an
 * upload fails halfway; the messages cannot. So the list is derived by
 * scanning, and anything we add later (folders, tags) is an overlay keyed by
 * message id, losing the overlay loses organisation, never files.
 *
 * Files above Telegram's per-object cap are split across several messages and
 * reassembled here (see multipart.ts). Nothing above this layer knows.
 * ──────────────────────────────────────────────────────────────────────── */

export type AxiomFile = {
  /** Group id for split files, message id otherwise. Stable for the file's life. */
  id: string
  name: string
  /** Logical size. The size of the file the user gave us, not of any one part. */
  size: number
  mime: string
  date: Date
  kind: FileKind
  /** Always at least one. Ordered by index, offsets contiguous from zero. */
  parts: PartRef[]
  /** False when a split file is missing parts; it can be listed but not read. */
  complete: boolean
}

type AnyMedia = {
  type?: string
  fileName?: string
  fileSize?: number | bigint
  mimeType?: string
  thumbnails?: unknown[]
}

const num = (v: number | bigint | undefined): number =>
  typeof v === 'bigint' ? Number(v) : (v ?? 0)

/** Media types that represent a stored file rather than a sticker, poll, etc. */
const FILE_TYPES = new Set(['document', 'video', 'audio', 'voice', 'photo'])

/** Convenience for the common single-part case. */
export const primary = (f: AxiomFile): unknown => f.parts[0]?.media

type RawMessage = { id: number; date: Date; media?: unknown; text?: string; caption?: string }

/**
 * Walk the vault newest-first, surfacing files as they are found.
 *
 * Streams via a callback rather than resolving once at the end: a long history
 * would otherwise show an empty grid for the whole scan, and the first page is
 * the only part most people ever look at.
 *
 * Split files are held back until every part has been seen, then emitted once
 * as a single entry. A half-scanned 6 GB video must never appear as three
 * confusing 1.75 GB fragments.
 */
export async function scanFiles(
  onBatch: (files: AxiomFile[]) => void,
  opts: { signal?: AbortSignal; limit?: number } = {},
): Promise<void> {
  const client = getClient()
  const vault = await getVaultId()
  const limit = opts.limit ?? 4000

  let batch: AxiomFile[] = []
  const pending = new Map<
    string,
    { manifest: ReturnType<typeof decodeManifest>; parts: PartRef[]; date: Date }
  >()

  const flush = () => {
    if (batch.length) {
      onBatch(batch)
      batch = []
    }
  }

  let seen = 0
  for await (const raw of client.iterHistory(vault, { limit })) {
    if (opts.signal?.aborted) return
    const msg = raw as unknown as RawMessage
    const media = msg.media as AnyMedia | undefined
    if (!media?.type || !FILE_TYPES.has(media.type)) continue

    seen++
    const manifest = decodeManifest(msg.caption ?? msg.text)

    if (!manifest || manifest.c === 1) {
      batch.push(singleFile(msg, media))
    } else {
      // Part of a split file. Collect until the set is whole.
      const group = pending.get(manifest.g) ?? { manifest, parts: [], date: msg.date }
      group.parts.push({
        index: manifest.i,
        offset: 0, // assigned once the set is ordered
        size: num(media.fileSize),
        messageId: msg.id,
        media,
      })
      // Oldest part's date is the file's date. That is when the upload began.
      if (msg.date < group.date) group.date = msg.date
      pending.set(manifest.g, group)

      if (isComplete(group.parts, manifest.c)) {
        pending.delete(manifest.g)
        batch.push(assemble(manifest, group.parts, group.date))
      }
    }

    if (batch.length >= 40) flush()
    if (seen >= limit) break
  }

  // Sets still missing parts after the whole scan: surface them anyway, marked
  // incomplete, so a failed upload is visible and deletable rather than
  // invisible storage the user cannot account for.
  for (const [, group] of pending) {
    if (!group.manifest) continue
    batch.push(assemble(group.manifest, group.parts, group.date, false))
  }

  flush()
}

function singleFile(msg: RawMessage, media: AnyMedia): AxiomFile {
  const mime =
    media.mimeType ?? (media.type === 'photo' ? 'image/jpeg' : 'application/octet-stream')
  const name = media.fileName ?? (media.type === 'photo' ? `Photo ${msg.id}.jpg` : `File ${msg.id}`)
  const size = num(media.fileSize)

  return {
    id: String(msg.id),
    name,
    size,
    mime,
    date: msg.date,
    kind: kindOf(mime, name),
    parts: [{ index: 0, offset: 0, size, messageId: msg.id, media }],
    complete: true,
  }
}

function assemble(
  manifest: NonNullable<ReturnType<typeof decodeManifest>>,
  parts: PartRef[],
  date: Date,
  complete = true,
): AxiomFile {
  const ordered = [...parts].sort((a, b) => a.index - b.index)
  // Offsets come from the actual part sizes, in order, never from the planned
  // sizes, so a part that uploaded short is caught by the range mapper rather
  // than silently shifting every byte after it.
  let offset = 0
  for (const p of ordered) {
    p.offset = offset
    offset += p.size
  }

  return {
    id: manifest.g,
    name: manifest.n,
    size: manifest.s,
    mime: manifest.m,
    date,
    kind: kindOf(manifest.m, manifest.n),
    parts: ordered,
    complete: complete && offset === manifest.s,
  }
}

/* ── upload ─────────────────────────────────────────────────────────────── */

/** Crypto-strength group id; collisions across a user's own vault must not happen. */
function groupId(): string {
  const b = new Uint8Array(9)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, '')
}

export async function uploadFile(
  file: File,
  opts: { onProgress?: (sent: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<AxiomFile | null> {
  const client = getClient()
  const vault = await getVaultId()
  const mime = file.type || 'application/octet-stream'
  const plan = planParts(file.size)
  const g = groupId()

  const sentParts: PartRef[] = []
  let sentBefore = 0

  for (const { index, start, end } of plan) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // A Blob slice is a view, not a copy. A 6 GB file is never held in memory.
    const chunk = plan.length === 1 ? file : file.slice(start, end)
    const partName = plan.length === 1 ? file.name : `${file.name}.part${index + 1}`

    const msg = await client.sendMedia(
      vault,
      { type: 'document', file: chunk, fileName: partName, fileMime: mime },
      {
        caption: encodeManifest({
          v: 1,
          g,
          n: file.name,
          s: file.size,
          i: index,
          c: plan.length,
          m: mime,
        }),
        // Progress is reported against the whole logical file, so a 6 GB upload
        // shows one bar climbing to 100% rather than restarting four times.
        progressCallback: (sent) => opts.onProgress?.(sentBefore + sent, file.size),
        abortSignal: opts.signal,
      },
    )

    const raw = msg as unknown as RawMessage
    const media = raw.media as AnyMedia | undefined
    sentParts.push({
      index,
      offset: start,
      size: num(media?.fileSize) || end - start,
      messageId: raw.id,
      media,
    })
    sentBefore += end - start
  }

  if (plan.length === 1) {
    const only = sentParts[0]
    return {
      id: String(only.messageId),
      name: file.name,
      size: file.size,
      mime,
      date: new Date(),
      kind: kindOf(mime, file.name),
      parts: sentParts,
      complete: true,
    }
  }

  return {
    id: g,
    name: file.name,
    size: file.size,
    mime,
    date: new Date(),
    kind: kindOf(mime, file.name),
    parts: sentParts,
    complete: true,
  }
}

export async function deleteFiles(files: AxiomFile[]): Promise<void> {
  if (!files.length) return
  const vault = await getVaultId()
  // Every part of every file, deleting only the first message of a split file
  // would leave the rest as orphaned storage the user can no longer see.
  const ids = files.flatMap((f) => f.parts.map((p) => p.messageId))
  await getClient().deleteMessagesById(vault, ids)
}

/* ── reading ──────────────────────────────────────────────────────────────
 * One entry point for bytes. Everything else, preview, download, the Service
 * Worker's range handler, goes through readRange, so multipart reassembly is
 * implemented exactly once.
 * ──────────────────────────────────────────────────────────────────────── */

/* ── the byte window primitive ────────────────────────────────────────────
 * mtcute's `limit` parameter cannot be used. It is *validated* as a length
 * (must divide 1 MiB, see download-iterable.js:107-112) but *consumed* as an
 * absolute end offset (`let position = offset; while (position < limitBytes)`
 * at :233-235). So a 2 MiB window throws MtArgumentError, and any window whose
 * offset already exceeds the limit returns zero bytes. Which is every seek
 * past the first megabyte.
 *
 * So we never pass `limit`. We open a stream at `offset`, take exactly the
 * bytes we need, and cancel. `offset` must still be 4 KiB-aligned (:74-75),
 * which sliceRange already guarantees.
 * ──────────────────────────────────────────────────────────────────────── */
async function readWindow(
  media: unknown,
  offset: number,
  length: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (length <= 0) return new Uint8Array(0)

  // Our own controller so cancelling this window never aborts the caller's
  // wider operation, while an outer abort still propagates inward.
  const ac = new AbortController()
  const relay = () => ac.abort()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  signal?.addEventListener('abort', relay, { once: true })

  try {
    const stream = getClient().downloadAsStream(media as never, {
      offset,
      abortSignal: ac.signal,
    })
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let got = 0

    try {
      while (got < length) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        got += value.byteLength
      }
    } finally {
      // Stop the transfer as soon as the window is satisfied. Without this the
      // rest of a multi-gigabyte file keeps downloading behind every seek.
      await reader.cancel().catch(() => {})
      ac.abort()
    }

    const out = new Uint8Array(Math.min(got, length))
    let at = 0
    for (const c of chunks) {
      if (at >= out.length) break
      const take = Math.min(c.byteLength, out.length - at)
      out.set(c.subarray(0, take), at)
      at += take
    }
    return out
  } finally {
    signal?.removeEventListener('abort', relay)
  }
}

export async function readRange(
  file: AxiomFile,
  offset: number,
  length: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const slices = sliceRange(file.parts, offset, length)
  if (!slices.length) return new Uint8Array(0)

  // Single-part reads are the overwhelming majority; skip the concat entirely.
  if (slices.length === 1) {
    const s = slices[0]
    return readWindow(s.part.media, s.offset, s.length, signal)
  }

  const chunks: Uint8Array[] = []
  let total = 0
  for (const s of slices) {
    const view = await readWindow(s.part.media, s.offset, s.length, signal)
    chunks.push(view)
    total += view.byteLength
  }

  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}

/** Whole-file stream, part by part, with backpressure preserved. */
export function readStream(file: AxiomFile, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const client = getClient()
  let partIndex = 0
  let inner: ReadableStreamDefaultReader<Uint8Array> | null = null

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (signal?.aborted) {
          controller.error(new DOMException('Aborted', 'AbortError'))
          return
        }
        if (!inner) {
          if (partIndex >= file.parts.length) {
            controller.close()
            return
          }
          // One part at a time: mtcute parallelises within a part already, so
          // opening several at once only splits the same pipe.
          inner = client
            .downloadAsStream(file.parts[partIndex].media as never, { abortSignal: signal })
            .getReader()
          partIndex++
        }
        const { done, value } = await inner.read()
        if (done) {
          inner = null
          continue
        }
        controller.enqueue(value)
        return
      }
    },
    cancel(reason) {
      void inner?.cancel(reason)
    },
  })
}

/* ── download ─────────────────────────────────────────────────────────────
 * Two tiers, chosen by capability rather than by browser sniffing:
 *
 * 1. File System Access API, stream straight to a file the user picked. No
 *    ceiling, no memory pressure, real save dialog. Chromium only.
 * 2. Blob, Safari and Firefox have no save picker, and the honest consequence
 *    is a size ceiling, so this path is guarded rather than pretended away.
 * ──────────────────────────────────────────────────────────────────────── */

export const BLOB_CEILING = 512 * 1024 * 1024

export const canStreamToDisk = (): boolean => 'showSaveFilePicker' in globalThis

type SaveFilePickerFn = (opts: {
  suggestedName?: string
}) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>

export async function downloadFile(
  file: AxiomFile,
  opts: { onProgress?: (received: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  if (!file.complete) {
    throw new Error(
      `${file.name} is missing some of its parts, so it cannot be rebuilt. Delete it and upload again.`,
    )
  }

  if (canStreamToDisk()) {
    const picker = (globalThis as unknown as { showSaveFilePicker: SaveFilePickerFn })
      .showSaveFilePicker
    // Ask before downloading a byte: a cancelled dialog should cost nothing.
    const handle = await picker({ suggestedName: file.name })
    const writable = await handle.createWritable()

    let received = 0
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength
        opts.onProgress?.(received, file.size)
        controller.enqueue(chunk)
      },
    })

    await readStream(file, opts.signal).pipeThrough(counter).pipeTo(writable, {
      signal: opts.signal,
    })
    return
  }

  if (file.size > BLOB_CEILING) {
    throw new Error(
      `This browser has to hold the whole file in memory to save it, and ${file.name} is too large for that. Chrome or Edge can stream it straight to disk.`,
    )
  }

  const buf = await readRange(file, 0, file.size, opts.signal)
  opts.onProgress?.(file.size, file.size)
  const url = URL.createObjectURL(new Blob([buf as BlobPart], { type: file.mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Whole-file fetch for previews, where the bytes are needed in the page anyway. */
export async function objectUrl(file: AxiomFile, signal?: AbortSignal): Promise<string> {
  const buf = await readRange(file, 0, file.size, signal)
  return URL.createObjectURL(new Blob([buf as BlobPart], { type: file.mime }))
}
