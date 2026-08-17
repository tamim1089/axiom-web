import { getClient } from './telegram'
import { getVaultId } from './vault'
import { decodeFolders, emptyFolders, encodeFolders, type FolderState } from './folders'

/* ── metadata sync ────────────────────────────────────────────────────────
 * Folders, tags, favourites and view preferences, synced between a user's
 * devices. Without giving anyone a way to read them.
 *
 * The trust boundary, stated precisely:
 *
 *   The Telegram channel remains the source of truth. This is a CACHE.
 *   If the remote copy is missing, stale, or garbage, the app rebuilds from
 *   the channel and carries on. Nothing here can lose a file.
 *
 *   The server never learns anything. It stores two opaque values: a 256-bit
 *   lookup id and a ciphertext. It cannot derive one from the other, cannot
 *   read the payload, and has no account, email or Telegram id to attach them
 *   to. A full database dump is a pile of random bytes.
 *
 * The key never travels through the server. It is generated on first use and
 * kept in a pinned message inside the user's own Axiom Storage channel, so a
 * second device gets it by virtue of being logged into Telegram at all, * there is no passphrase to remember and no key-exchange handshake to attack.
 * Possession of the key IS the authentication, and possession requires
 * Telegram access we never mediate.
 *
 * Requests go through our own Netlify function rather than to Supabase
 * directly. That is a security decision, not a routing one: it keeps the app
 * origin's connect-src at 'self', so the page that holds a Telegram auth key
 * is permitted to talk to exactly one host, ours. And nothing else.
 * ──────────────────────────────────────────────────────────────────────── */

const KEY_TAG = '⟦axiom-sync-key⟧'
const ENDPOINT = '/api/sync'
const KEY_CACHE = 'axiom.sync.key'

export type Overlay = {
  /** Bumped on every local change; the higher clock wins a conflict. */
  clock: number
  folders: FolderState
  updatedAt: number
}

export const emptyOverlay = (): Overlay => ({
  clock: 0,
  folders: emptyFolders(),
  updatedAt: 0,
})

/* ── payload framing ───────────────────────────────────────────────────────
 *
 *   u8   container version
 *   u8   0 = stored, 1 = gzip
 *   ...  the folder blob from folders.ts, compressed or not
 *
 * The compression flag is written rather than assumed, so a browser without
 * CompressionStream can still write a payload every other device can read.
 * gzip on top of the varint encoding is not redundant: repeated folder slots
 * and runs of one-byte deltas are exactly what its entropy coder is for, and
 * it typically halves an already small blob.
 * ──────────────────────────────────────────────────────────────────────── */

const CONTAINER = 1
const STORED = 0
const GZIP = 1

async function through(bytes: Uint8Array, mode: 'gzip' | 'gunzip'): Promise<Uint8Array> {
  const Stream = mode === 'gzip' ? globalThis.CompressionStream : globalThis.DecompressionStream
  const stream = new Stream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
  const out = new Response(new Blob([bytes as BufferSource]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

async function frame(state: FolderState): Promise<Uint8Array> {
  const body = encodeFolders(state)
  let flag = STORED
  let payload = body
  if (typeof globalThis.CompressionStream !== 'undefined') {
    try {
      const packed = await through(body, 'gzip')
      // Tiny blobs come out larger than they went in; keep whichever is smaller.
      if (packed.length < body.length) {
        payload = packed
        flag = GZIP
      }
    } catch {
      /* Fall through to stored. Correctness never depends on compressing. */
    }
  }
  const out = new Uint8Array(2 + payload.length)
  out[0] = CONTAINER
  out[1] = flag
  out.set(payload, 2)
  return out
}

async function unframe(bytes: Uint8Array): Promise<FolderState> {
  if (bytes.length < 2 || bytes[0] !== CONTAINER) throw new Error('unknown payload')
  const body = bytes.subarray(2)
  return decodeFolders(bytes[1] === GZIP ? await through(body, 'gunzip') : body)
}

/* ── key management ─────────────────────────────────────────────────────── */

let keyPromise: Promise<CryptoKey | null> | null = null

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  // HKDF first, so the stored secret and the encryption key are not the same
  // bytes, leaking one does not hand over the other.
  const base = await crypto.subtle.importKey('raw', raw as BufferSource, 'HKDF', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('axiom.sync.v1'),
      info: new TextEncoder().encode('overlay-encryption'),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Opaque per-user lookup id. Reveals nothing and cannot be reversed. */
async function vaultKey(raw: Uint8Array): Promise<string> {
  const mac = await crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', mac, new TextEncoder().encode('axiom:vault-id:v1'))
  return b64url(new Uint8Array(sig))
}

const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromB64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/**
 * Fetch the sync secret from the vault channel, creating it on first use.
 * Returns null when sync is unavailable. Every caller treats that as "carry
 * on locally", never as an error worth showing.
 */
async function secret(): Promise<Uint8Array | null> {
  const cached = localStorage.getItem(KEY_CACHE)
  if (cached) return fromB64(cached)

  try {
    const client = getClient()
    // getVaultId only ever returns a channel this account created (see
    // vault.ts), so the key we read below was necessarily written by the
    // user's own devices — an attacker cannot pre-plant one in a channel we
    // were merely invited into, because such a channel is never our vault.
    const vault = await getVaultId()

    // A pinned message is the natural home: one per channel, trivially found,
    // and it travels with the channel to every device the user signs in on.
    for await (const msg of client.iterHistory(vault, { limit: 60 })) {
      const text = (msg as unknown as { text?: string }).text ?? ''
      if (text.startsWith(KEY_TAG)) {
        const raw = fromB64(text.slice(KEY_TAG.length).trim())
        localStorage.setItem(KEY_CACHE, b64url(raw))
        return raw
      }
    }

    const fresh = crypto.getRandomValues(new Uint8Array(32))
    const sent = await client.sendText(vault, KEY_TAG + b64url(fresh))
    try {
      // pinMessage takes an { chatId, message } pair, not the Message itself.
      await client.pinMessage({ chatId: vault, message: sent.id })
    } catch {
      /* Pinning is a convenience; the scan above finds it either way. */
    }
    localStorage.setItem(KEY_CACHE, b64url(fresh))
    return fresh
  } catch {
    return null
  }
}

async function key(): Promise<CryptoKey | null> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const raw = await secret()
      return raw ? importKey(raw) : null
    })().catch(() => {
      keyPromise = null
      return null
    })
  }
  return keyPromise
}

/* ── transport ──────────────────────────────────────────────────────────── */

/** True when a sync endpoint is configured for this deployment. */
export const syncEnabled = (): boolean => import.meta.env.VITE_SYNC_ENABLED === 'true'

/**
 * Bind the last-write-wins clock to the ciphertext as additional authenticated
 * data. The clock travels beside the payload in plaintext JSON (the server
 * orders writes by it and cannot read the payload), so without this a malicious
 * or compromised server could pair an *old but genuine* ciphertext with an
 * inflated clock and drive a rollback: the client would authenticate the stale
 * payload, see the higher clock, and overwrite newer state. Feeding the clock
 * as AAD makes any clock the writer did not sign fail decryption instead.
 */
const clockAad = (clock: number): BufferSource =>
  new TextEncoder().encode(`axiom.sync.clock.v1:${clock}`)

export async function pullOverlay(): Promise<Overlay | null> {
  if (!syncEnabled()) return null
  try {
    const raw = await secret()
    const k = await key()
    if (!raw || !k) return null

    const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(await vaultKey(raw))}`)
    if (res.status === 404) return emptyOverlay()
    if (!res.ok) return null

    const { payload, clock } = (await res.json()) as { payload?: string; clock?: number }
    if (!payload) return emptyOverlay()
    const serverClock = typeof clock === 'number' ? clock : 0

    const blob = fromB64(payload)
    // First 12 bytes are the GCM nonce, generated fresh per write. The clock is
    // bound in as AAD, so a clock the writer never signed fails here and the
    // stale payload behind it is discarded rather than applied as a rollback.
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.slice(0, 12) as BufferSource, additionalData: clockAad(serverClock) },
      k,
      blob.slice(12) as BufferSource,
    )
    return {
      clock: serverClock,
      folders: await unframe(new Uint8Array(plain)),
      updatedAt: Date.now(),
    }
  } catch {
    // Tampered, truncated, or from a different key. The channel is still the
    // truth, so a bad cache is discarded rather than surfaced.
    return null
  }
}

export async function pushOverlay(overlay: Overlay): Promise<boolean> {
  if (!syncEnabled()) return false
  try {
    const raw = await secret()
    const k = await key()
    if (!raw || !k) return false

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: clockAad(overlay.clock) },
      k,
      (await frame(overlay.folders)) as BufferSource,
    )

    const packed = new Uint8Array(12 + cipher.byteLength)
    packed.set(iv, 0)
    packed.set(new Uint8Array(cipher), 12)

    const res = await fetch(ENDPOINT, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: await vaultKey(raw),
        payload: b64url(packed),
        clock: overlay.clock,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Local write wins ties; the higher clock wins otherwise. */
export function mergeOverlay(local: Overlay, remote: Overlay | null): Overlay {
  if (!remote) return local
  return remote.clock > local.clock ? remote : local
}
