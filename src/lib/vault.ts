import { getClient } from './telegram'

/* ── the vault ────────────────────────────────────────────────────────────
 * Files live in a private channel of the user's own, not in Saved Messages.
 *
 * Saved Messages is a place people already use — notes, forwarded links,
 * things they mailed themselves. Writing a file manager on top of it means
 * every unrelated message shows up in the library, and every delete is one
 * misclick away from destroying something the app did not create. A dedicated
 * channel gives the app a namespace of its own: everything in it belongs to
 * Axiom, so listing is exact and deleting is safe.
 *
 * The channel is private — no username, no invite link is published — and it
 * belongs to the user's account, not to us. Uninstall Axiom and it is still
 * there in their Telegram client, with every file in it.
 *
 * Resolution order: remembered id → search dialogs by title → create. The
 * localStorage entry is only a cache; wiping it costs one dialog scan, never
 * a duplicate channel or a lost file.
 * ──────────────────────────────────────────────────────────────────────── */

export const VAULT_TITLE = 'Axiom Storage'
const VAULT_ABOUT =
  'Private file storage for Axiom. Created automatically — files you upload to Axiom are kept here.'
const CACHE_KEY = 'axiom.vault.id'

let resolving: Promise<number> | null = null

async function findExisting(): Promise<number | null> {
  const client = getClient()

  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) {
    try {
      // Confirm it still exists and we still have access; a channel deleted
      // from another device would otherwise wedge every upload.
      const chat = await client.getChat(Number(cached))
      if (chat) return Number(cached)
    } catch {
      localStorage.removeItem(CACHE_KEY)
    }
  }

  // Scan dialogs for a channel we created earlier on another device.
  for await (const dialog of client.iterDialogs({ limit: 400 })) {
    const chat = dialog.peer as unknown as { title?: string; id: number }
    if (chat?.title === VAULT_TITLE) {
      localStorage.setItem(CACHE_KEY, String(chat.id))
      return chat.id
    }
  }

  return null
}

/** The channel id, creating the channel on first use. Safe to call often. */
export function getVaultId(): Promise<number> {
  // Concurrent callers must not each create a channel.
  if (!resolving) {
    resolving = (async () => {
      const existing = await findExisting()
      if (existing !== null) return existing

      const chat = await getClient().createChannel({
        title: VAULT_TITLE,
        description: VAULT_ABOUT,
      })
      const id = (chat as unknown as { id: number }).id
      localStorage.setItem(CACHE_KEY, String(id))
      return id
    })().catch((err: unknown) => {
      // Let the next call retry rather than caching a rejected promise.
      resolving = null
      throw err
    })
  }
  return resolving
}

/** Called on sign-out so the next account does not inherit this one's vault. */
export function forgetVault(): void {
  localStorage.removeItem(CACHE_KEY)
  resolving = null
}
