import type { Config, Context } from '@netlify/functions'

/* ── sync endpoint ────────────────────────────────────────────────────────
 * A deliberately stupid key/value store in front of Supabase. It handles two
 * opaque strings and understands neither.
 *
 * It exists for three reasons, none of which is "the app needs a backend":
 *
 * 1. It keeps the Supabase origin out of the app page's Content-Security-
 *    Policy. The page holding a Telegram auth key may talk to 'self' and
 *    Telegram, and to nothing else, including us, from its own origin.
 * 2. It rate-limits writes. A public, key-addressed store with no ceiling is
 *    free hosting for whoever finds it.
 * 3. It keeps the service-role credential server-side, so row access is
 *    decided here rather than by whoever holds the anon key.
 *
 * It cannot read anything it stores: `payload` is AES-256-GCM ciphertext whose
 * key never leaves the user's devices, and `id` is an HMAC that identifies a
 * row without identifying a person. See src/lib/sync.ts.
 * ──────────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const TABLE = 'overlays'

/** 256-bit HMAC, base64url. Anything else is not one of ours. */
const VALID_ID = /^[A-Za-z0-9_-]{43}$/
/** Generous for an overlay of folders and tags, small enough to not be storage. */
const MAX_PAYLOAD = 256 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      // No credentials are involved, and the app is same-origin anyway.
      'access-control-allow-origin': 'null',
    },
  })

/* In-memory, per-instance, best-effort. Netlify may run several instances, so
   this thins abuse rather than stopping it; the payload ceiling and Supabase's
   own limits are the real backstop. */
const hits = new Map<string, { n: number; until: number }>()
const WINDOW_MS = 60_000
const MAX_WRITES = 20

function rateLimited(ip: string, now: number): boolean {
  const rec = hits.get(ip)
  if (!rec || now > rec.until) {
    hits.set(ip, { n: 1, until: now + WINDOW_MS })
    return false
  }
  rec.n++
  return rec.n > MAX_WRITES
}

export default async function handler(req: Request, ctx: Context): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ error: 'Sync is not configured for this deployment' }, 503)
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'content-type': 'application/json',
  }

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    if (!VALID_ID.test(id)) return json({ error: 'Bad id' }, 400)

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=payload,clock`,
      { headers },
    )
    if (!res.ok) return json({ error: 'Upstream error' }, 502)

    const rows = (await res.json()) as { payload: string; clock: number }[]
    if (!rows.length) return json({ error: 'Not found' }, 404)
    return json(rows[0])
  }

  if (req.method === 'PUT') {
    const ip = ctx.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown'
    // No Date.now() ambiguity here. This runs per request, server-side.
    if (rateLimited(ip, Date.now())) return json({ error: 'Slow down' }, 429)

    let body: { id?: string; payload?: string; clock?: number }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return json({ error: 'Bad JSON' }, 400)
    }

    const { id, payload, clock } = body
    if (!id || !VALID_ID.test(id)) return json({ error: 'Bad id' }, 400)
    if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD) {
      return json({ error: 'Bad payload' }, 400)
    }
    if (typeof clock !== 'number' || !Number.isFinite(clock) || clock < 0) {
      return json({ error: 'Bad clock' }, 400)
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id, payload, clock, updated_at: new Date().toISOString() }),
    })
    if (!res.ok) return json({ error: 'Upstream error' }, 502)
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/sync' }
