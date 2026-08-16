import { readRange, type AxiomFile } from './storage'

/* ── page half of the streaming bridge ────────────────────────────────────
 * The Service Worker answers Range requests but cannot speak MTProto. This is
 * the other end: it holds the file registry, listens for range-request
 * messages, fetches exactly that window from Telegram, and posts the bytes
 * back. See public/sw.js for the reasoning.
 * ──────────────────────────────────────────────────────────────────────── */

const registry = new Map<string, AxiomFile>()
let ready: Promise<boolean> | null = null

/* Attached at module load, not inside ensureStreaming(). The worker survives
   reloads, so it can ask for a range before any preview has opened. And if
   nobody is listening that request hangs until the worker's timeout rather
   than failing at once. Listening early costs nothing and turns a 45-second
   stall into an immediate, accurate error. */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', onMessage)
}

/** True once a worker is controlling the page and streaming URLs will resolve. */
export function ensureStreaming(): Promise<boolean> {
  if (ready) return ready

  ready = (async () => {
    if (!('serviceWorker' in navigator)) return false
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      // A freshly installed worker does not control this page until it
      // activates; without waiting, the first <video> src 404s.
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const done = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', done)
            resolve()
          }
          navigator.serviceWorker.addEventListener('controllerchange', done)
          // Don't hang forever if the worker never takes control.
          setTimeout(done, 3000)
        })
      }

      return Boolean(navigator.serviceWorker.controller)
    } catch {
      return false
    }
  })()

  return ready
}

async function onMessage(event: MessageEvent) {
  const msg = event.data as
    | { type: 'range-request'; id: number; key: string; offset: number; limit: number }
    | undefined
  if (!msg || msg.type !== 'range-request') return

  const reply = (payload: Record<string, unknown>, transfer: Transferable[] = []) =>
    navigator.serviceWorker.controller?.postMessage(
      { type: 'range-result', id: msg.id, ...payload },
      transfer,
    )

  const file = registry.get(msg.key)
  if (!file) {
    reply({ error: 'File is no longer open' })
    return
  }

  try {
    // readRange spans parts, so a seek that lands across a 1.75 GiB boundary is
    // stitched here and the worker never learns the file was ever split.
    const bytes = await readRange(file, msg.offset, msg.limit)
    // Copy into a standalone ArrayBuffer so it can be transferred rather than
    // structured-cloned. This runs for every seek, on multi-MB windows.
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    reply({ bytes: copy.buffer }, [copy.buffer])
  } catch (err) {
    reply({ error: err instanceof Error ? err.message : String(err) })
  }
}

/**
 * A URL the browser can range-request: `<video src={streamUrl(file)} />`.
 * Returns null when no worker is available, so callers can fall back.
 */
export function streamUrl(file: AxiomFile, opts: { download?: boolean } = {}): string | null {
  if (!navigator.serviceWorker?.controller) return null
  registry.set(file.id, file)
  const params = new URLSearchParams({
    size: String(file.size),
    mime: file.mime,
    name: file.name,
  })
  if (opts.download) params.set('dl', '1')

  // The trailing filename is not decoration: Safari cross-checks a media URL's
  // extension against the Content-Type and the <source type> attribute, and
  // refuses to play when an extensionless URL disagrees with either.
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_') || 'file'
  return `/_stream/${encodeURIComponent(file.id)}/${encodeURIComponent(safeName)}?${params}`
}

export function releaseStream(file: AxiomFile): void {
  registry.delete(file.id)
}
