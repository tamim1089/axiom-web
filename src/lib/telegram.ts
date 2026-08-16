import { TelegramClient } from '@mtcute/web'

/* ── the client ───────────────────────────────────────────────────────────
 * This is the whole backend. It runs in the tab.
 *
 * @mtcute/web defaults to a WebSocket transport straight to Telegram's data
 * centres and an IndexedDB session store, which is precisely the architecture
 * we want: the auth key is created in this browser, persists in this browser,
 * and is never transmitted anywhere else. There is no server to leak it.
 *
 * Consequence worth being honest about: an XSS bug in this origin reads that
 * key out of IndexedDB and owns the Telegram account. Same bargain Telegram
 * Web makes. It buys the strict CSP in index.html and a hard no on
 * third-party scripts.
 * ──────────────────────────────────────────────────────────────────────── */

const apiId = Number(import.meta.env.VITE_TELEGRAM_API_ID)
const apiHash = import.meta.env.VITE_TELEGRAM_API_HASH as string

if (!apiId || !apiHash) {
  throw new Error(
    'Missing VITE_TELEGRAM_API_ID / VITE_TELEGRAM_API_HASH — copy .env.example to .env and fill them in from my.telegram.org',
  )
}

let instance: TelegramClient | null = null

/** Created on first use, so merely loading the landing page opens no sockets. */
export function getClient(): TelegramClient {
  if (!instance) {
    instance = new TelegramClient({
      apiId,
      apiHash,
      storage: 'axiom.session',
    })
  }
  return instance
}

/**
 * Ask the browser to keep our storage.
 *
 * WebKit's tracking prevention clears IndexedDB and Service Worker
 * registrations after roughly seven days of Safari use without a visit — which
 * here means the Telegram auth key and the streaming worker, gone, with the
 * user's only symptom being "it logged me out again". Persisted storage is
 * exempt.
 *
 * Called after a successful sign-in rather than at load, because that is when
 * the browser has the engagement signal it wants and is willing to say yes.
 * Failure is not worth surfacing: the app works either way, it just forgets
 * sooner.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
