/* ── streaming range server ───────────────────────────────────────────────
 * Media elements do not accept a callback for bytes — they take a URL and
 * issue HTTP Range requests against it. So to play a multi-gigabyte video that
 * lives in Telegram, something has to answer those Range requests.
 *
 * That is this worker. It claims /_stream/ URLs, and since it cannot speak
 * MTProto itself (the client lives in the page), it asks the page for each
 * byte range over postMessage and replies with a spec-correct response.
 *
 * The details below are not pedantry — each one is a format or a browser that
 * silently fails without it:
 *
 *   • A request with NO Range header must get 200 and the full length. Answer
 *     it with a clamped 206 and plain fetch(), <img>, HEAD and download
 *     managers all receive a truncated file with no error anywhere.
 *   • `bytes=-500` means the LAST 500 bytes, not the first 501. MP4s with the
 *     moov atom at the end probe exactly this way, so getting it wrong makes
 *     those files unplayable while others work.
 *   • Filenames need RFC 5987 encoding or every non-ASCII name arrives as
 *     percent-escapes.
 *   • The window must be a size mtcute can actually serve, and the page — not
 *     this worker — decides how to fetch it.
 * ──────────────────────────────────────────────────────────────────────── */

const PREFIX = '/_stream/'
/* Serve at most this much per request. Media elements ask for open-ended
   ranges ("bytes=0-"); honouring that literally would download the entire
   file to satisfy one seek. 1 MiB also matches the granularity the page's
   reader works in. */
const WINDOW = 1024 * 1024
/* Telegram requires download offsets on a 4 KiB boundary. */
const ALIGN = 4096
const TIMEOUT = 45_000

let seq = 0
const pending = new Map()

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  const msg = event.data
  if (!msg || msg.type !== 'range-result') return
  const entry = pending.get(msg.id)
  if (!entry) return
  pending.delete(msg.id)
  clearTimeout(entry.timer)
  msg.error ? entry.reject(new Error(msg.error)) : entry.resolve(msg.bytes)
})

/**
 * Ask a page for a byte range.
 *
 * Broadcasts to every controlled window rather than picking one. matchAll()
 * returns most-recently-focused order, so with two Axiom tabs open the wrong
 * one — the one without this file registered — would answer "File is no
 * longer open" and kill playback in the tab that actually has it. Whichever
 * client holds the file replies; the rest are ignored.
 */
async function askPages(payload) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (!clients.length) throw new Error('No Axiom tab is open to serve this stream')

  const id = ++seq
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Timed out waiting for file data'))
    }, TIMEOUT)
    pending.set(id, { resolve, reject, timer })
  })

  for (const client of clients) {
    client.postMessage({ type: 'range-request', id, ...payload })
  }
  return promise
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PREFIX)) return
  event.respondWith(serve(event))
})

/** RFC 5987, so non-ASCII names survive the trip. */
function contentDisposition(name, inline) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Parse a single-range request header.
 * Returns null for "no range", 'invalid' for something unsatisfiable.
 */
function parseRange(header, size) {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return 'invalid'
  const [, rawStart, rawEnd] = m

  // Suffix form: "bytes=-500" is the last 500 bytes.
  if (rawStart === '') {
    if (rawEnd === '') return 'invalid'
    const wanted = Number(rawEnd)
    if (wanted <= 0) return 'invalid'
    return { start: Math.max(0, size - wanted), end: size - 1 }
  }

  const start = Number(rawStart)
  if (start >= size) return 'invalid'
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (end < start) return 'invalid'
  return { start, end }
}

async function serve(event) {
  const url = new URL(event.request.url)
  // Path is /_stream/<key>/<name>.<ext> — the trailing name exists because
  // Safari cross-checks a media URL's extension against its Content-Type.
  const rest = decodeURIComponent(url.pathname.slice(PREFIX.length))
  const key = rest.split('/')[0]
  const size = Number(url.searchParams.get('size') || 0)
  const mime = url.searchParams.get('mime') || 'application/octet-stream'
  const name = url.searchParams.get('name') || 'file'
  const download = url.searchParams.get('dl') === '1'

  if (!size) return new Response('Unknown file size', { status: 400 })

  const common = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': contentDisposition(name, !download),
    'Cache-Control': 'no-store',
  }

  if (event.request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...common, 'Content-Length': String(size) },
    })
  }

  const range = parseRange(event.request.headers.get('range'), size)

  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { ...common, 'Content-Range': `bytes */${size}` },
    })
  }

  // No Range header: this is a plain GET. It must be a 200 with the whole
  // length, or the consumer silently receives a truncated file.
  if (range === null) {
    // Streamed in windows rather than buffered: a plain GET of a 6 GB file
    // must not require 6 GB of worker memory. Cursor lives in a closure, not
    // on the source object.
    let at = 0
    const stream = new ReadableStream({
      async pull(controller) {
        if (at >= size) {
          controller.close()
          return
        }
        try {
          const aligned = alignDown(at)
          const lead = at - aligned
          const want = Math.min(WINDOW, size - at)
          const buf = await askPages({ key, offset: aligned, limit: lead + want })
          const body = new Uint8Array(buf).subarray(lead, lead + want)
          if (!body.byteLength) {
            controller.close()
            return
          }
          controller.enqueue(body)
          at += body.byteLength
        } catch (err) {
          controller.error(err)
        }
      },
    })
    return new Response(stream, {
      status: 200,
      headers: { ...common, 'Content-Length': String(size) },
    })
  }

  const { start } = range
  const end = Math.min(range.end, start + WINDOW - 1)

  // Telegram will only start on a 4 KiB boundary, so fetch from the boundary
  // at or below `start` and trim the lead-in before returning.
  const alignedOffset = alignDown(start)
  const lead = start - alignedOffset
  const wanted = end - start + 1

  try {
    const buf = await askPages({ key, offset: alignedOffset, limit: lead + wanted })
    const view = new Uint8Array(buf)
    const body = view.subarray(lead, lead + wanted)

    if (!body.byteLength) {
      return new Response(null, {
        status: 416,
        headers: { ...common, 'Content-Range': `bytes */${size}` },
      })
    }

    return new Response(body, {
      status: 206,
      headers: {
        ...common,
        'Content-Length': String(body.byteLength),
        'Content-Range': `bytes ${start}-${start + body.byteLength - 1}/${size}`,
      },
    })
  } catch (err) {
    return new Response(String(err && err.message ? err.message : err), { status: 502 })
  }
}

const alignDown = (n) => Math.floor(n / ALIGN) * ALIGN
