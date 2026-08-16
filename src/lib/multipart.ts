/* ── multipart files ──────────────────────────────────────────────────────
 * Telegram refuses a single object above 2 GB (4 GB for Premium). A 6 GB video
 * is not an exotic case. One phone shooting 4K produces them. So Axiom
 * splits oversized files across several messages and presents the set as one
 * file everywhere above this layer.
 *
 * Two design decisions carry the whole thing:
 *
 * 1. **Every part is self-describing.** The manifest is written into each
 *    part's caption, not stored in one place. A manifest message can be
 *    deleted, fail to send, or disagree with reality after a half-finished
 *    upload; captions attached to the parts themselves cannot go missing
 *    without the part going with them. Scanning can therefore rebuild the
 *    logical file from any complete set of parts, in any order.
 *
 * 2. **Part size is 4 KiB-aligned.** Telegram only accepts download offsets on
 *    a 4096 boundary. If every part begins at a multiple of 4096, then a
 *    4096-aligned offset in the logical file is still 4096-aligned inside
 *    whichever part it lands in. The alignment survives the mapping instead
 *    of needing to be recomputed and re-trimmed per part.
 * ──────────────────────────────────────────────────────────────────────── */

/** 1.75 GiB. Comfortably under the 2 GB cap, and exactly 458752 × 4096. */
export const PART_MAX = 1_879_048_192

/* The entire alignment guarantee rests on this. If a future edit picks a
   friendlier-looking number like 1.9 GB, offsets inside later parts stop
   landing on 4 KiB boundaries, Telegram rejects them, and seeking breaks only
   for files big enough to have a second part. The hardest case to notice.
   Fail at import instead. */
if (PART_MAX % 1_048_576 !== 0) {
  throw new Error(`PART_MAX must be a whole number of MiB; got ${PART_MAX}`)
}

/** Marks a caption as ours. Chosen to be visible but unlikely to be typed. */
const TAG = '⟦axiom⟧'

export type PartManifest = {
  /** Format version, so a future change can be migrated rather than guessed. */
  v: 1
  /** Group id, shared by every part of one logical file. */
  g: string
  /** File name. */
  n: string
  /** Total logical size in bytes. */
  s: number
  /** Zero-based index of this part. */
  i: number
  /** Total number of parts. */
  c: number
  /** MIME type. */
  m: string
}

export function encodeManifest(m: PartManifest): string {
  return TAG + JSON.stringify(m)
}

/** Returns null for any caption that is not ours or is malformed. */
export function decodeManifest(caption: string | undefined | null): PartManifest | null {
  if (!caption || !caption.startsWith(TAG)) return null
  try {
    const parsed = JSON.parse(caption.slice(TAG.length)) as PartManifest
    if (
      parsed?.v !== 1 ||
      typeof parsed.g !== 'string' ||
      typeof parsed.i !== 'number' ||
      typeof parsed.c !== 'number' ||
      typeof parsed.s !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Byte ranges for each part of a file of this size. */
export function planParts(totalSize: number): { index: number; start: number; end: number }[] {
  if (totalSize <= PART_MAX) return [{ index: 0, start: 0, end: totalSize }]
  const out = []
  let start = 0
  let index = 0
  while (start < totalSize) {
    const end = Math.min(start + PART_MAX, totalSize)
    out.push({ index, start, end })
    start = end
    index++
  }
  return out
}

export type PartRef = {
  index: number
  /** Global byte offset at which this part begins. */
  offset: number
  size: number
  messageId: number
  media: unknown
}

/** A slice of a read request, resolved to one part. */
export type PartSlice = {
  part: PartRef
  /** Offset *within* the part. 4 KiB-aligned whenever the global offset was. */
  offset: number
  length: number
}

/**
 * Map a global byte window onto the parts it spans.
 *
 * A window that straddles a boundary yields several slices, in order; the
 * caller concatenates them. Without this, seeking to a point near a part
 * boundary would silently return the wrong bytes. The failure mode is a video
 * that plays fine until roughly the 1.75 GB mark and then corrupts.
 */
export function sliceRange(parts: PartRef[], offset: number, length: number): PartSlice[] {
  const slices: PartSlice[] = []
  let cursor = offset
  let remaining = length

  for (const part of parts) {
    if (remaining <= 0) break
    const partEnd = part.offset + part.size
    if (cursor >= partEnd) continue
    if (cursor < part.offset) {
      // Gap: a part is missing from the set. Better to stop than to return
      // silently misaligned bytes that look like corruption downstream.
      break
    }
    const within = cursor - part.offset
    const take = Math.min(remaining, part.size - within)
    slices.push({ part, offset: within, length: take })
    cursor += take
    remaining -= take
  }

  return slices
}

/** True when every index 0..count-1 is present exactly once. */
export function isComplete(parts: PartRef[], expected: number): boolean {
  if (parts.length !== expected) return false
  const seen = new Set(parts.map((p) => p.index))
  return seen.size === expected && [...seen].every((i) => i >= 0 && i < expected)
}
