/* Page copy that is data rather than markup, so it can be edited without
   touching components — and so the empty slots are visible in one place. */

export type Review = {
  quote: string
  name: string
  role: string
  /** Where it was said, so a reader can go and verify it. */
  source?: string
}

/* ── reviews ──────────────────────────────────────────────────────────────
 * EMPTY ON PURPOSE. Add real quotes from real people here and the section
 * appears on the page; leave it empty and the section is skipped entirely.
 *
 * These are not pre-filled with plausible-sounding testimonials because an
 * invented review is a fabricated endorsement — it misleads the reader, and
 * under both FTC guidance and UAE consumer-protection rules it is the
 * business, not the writer, that carries the liability. Ship it empty and it
 * costs you a section; ship it invented and it costs you the trust the whole
 * page is arguing for.
 *
 * Good places to collect them: GitHub issues and stars, the Telegram Drive
 * release threads, and anyone already running the desktop app.
 * ──────────────────────────────────────────────────────────────────────── */
export const REVIEWS: Review[] = []

/* ── team ─────────────────────────────────────────────────────────────────
 * Add real people with a real photo at /public/team/<file>. The section
 * renders only when this is non-empty, for the same reason as above.
 * ──────────────────────────────────────────────────────────────────────── */
export type Member = { name: string; role: string; photo: string }
export const TEAM: Member[] = []

/* Five questions, answered truthfully — including the ones with awkward
   answers, because those are the ones people actually want settled. */
export const FAQ = [
  {
    q: 'Where do my files actually go?',
    a: 'Into a private channel called “Axiom Storage” that Axiom creates inside your own Telegram account the first time you upload. Only you are in it. Axiom has no servers, so there is nowhere else for a file to be — and if you stop using Axiom tomorrow, the channel and everything in it stays in your Telegram account.',
  },
  {
    q: 'Can Axiom read my files, or see my Telegram messages?',
    a: 'No. The whole app runs in your browser tab and talks to Telegram directly. Your login key is created on your device and stored on your device, and it is never transmitted to us — we do not operate a server that could receive it. Axiom only ever touches the storage channel it created, never your chats.',
  },
  {
    q: 'What does it cost, and how much can I store?',
    a: 'Axiom itself is free, and there is no subscription, because we pay for no storage and no bandwidth — your files move directly between your browser and Telegram. Your capacity is whatever your Telegram account allows. We will not advertise unlimited storage: individual files are capped at 2 GB by Telegram, and Telegram sets the overall limits, not us.',
  },
  {
    q: 'Is this allowed, and is it reliable enough to trust?',
    a: 'You are using your own Telegram account through Telegram’s documented client API, which is the same mechanism Telegram Web and Telegram Desktop use. That said, we would not recommend Axiom as your only copy of anything irreplaceable. Any storage you do not control the terms of deserves a second copy somewhere else — that is true of Axiom, and it is true of Dropbox.',
  },
  {
    q: 'What happens if I clear my browser data, or switch devices?',
    a: 'Your files are untouched — they live in Telegram, not in the browser. Clearing site data only erases the login key, so you scan the QR code once more. Signing in on a new device works the same way: scan, and your whole library is there. On iPhone, Safari can drop stored data after about a week without a visit, so expect to rescan occasionally there.',
  },
] as const
