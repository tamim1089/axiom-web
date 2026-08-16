# axiom-web

The Axiom landing page and Telegram sign-in, as a static website.

## Architecture

There is no backend. The whole Telegram client runs in the browser tab:
[mtcute](https://mtcute.dev) speaks MTProto over a WebSocket straight to
Telegram's data centres, and the auth key is stored in this origin's IndexedDB.

```
Browser ──── wss://*.web.telegram.org ────► Telegram DC
   │
   └── auth key → IndexedDB (never transmitted anywhere)
```

This is the same shape as `web.telegram.org`, and it is what makes the site
deployable as pure static files: no server ever holds a session, and no file
byte crosses infrastructure we own.

Two consequences worth keeping in view:

- **`api_id` / `api_hash` ship in the client bundle.** Unavoidable for
  browser-side MTProto, and true of Telegram Web too. Treat them as public and
  rotatable rather than secret. If the app is ever abused they can be
  flood-limited, so a "bring your own credentials" escape hatch is the planned
  fallback.
- **XSS in this origin is an account takeover**, because the auth key is
  readable from IndexedDB. The CSP in `app.html` is load-bearing: no
  third-party scripts, ever. `'wasm-unsafe-eval'` is required there because
  mtcute compiles AES-IGE from WebAssembly (WebCrypto does not provide it); it
  permits WASM compilation only, not `eval()` of JavaScript strings.

## Setup

```bash
cp .env.example .env      # fill in from my.telegram.org → API development tools
npm install
npm run dev
```

| Command | |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |

Deploying is `npm run build` and publishing `dist/` to any static host.

## Layout

```
src/
  components/
    Landing.tsx              marketing page
    QrLogin.tsx              MTProto QR sign-in, 2FA, session resume
    AbsentMiddle.tsx         the "no server in the middle" diagram
    Mark.tsx                 logo
    app/                     the signed-in workspace
      Workspace.tsx          shell: drag-drop, keyboard, empty states
      Toolbar.tsx            search, sort, view mode, selection actions
      Sidebar.tsx            derived collections + stored total
      FileGrid.tsx           virtualized grid and list
      Thumb.tsx              thumbnails, and drawn stand-ins for the rest
      TransferDock.tsx       per-file transfer queue
      Preview.tsx            image / video / audio / PDF viewer
      DemoWorkspace.tsx      design harness, dev builds only
    ui/                      dropped-in components (shadcn convention)
    site/                    marketing chrome
      Chrome.tsx             header, sticky mobile CTA, breadcrumbs, footer
      Pages.tsx              thank-you, 404, privacy
      BrandIcons.tsx         GitHub/Instagram marks (Lucide 1.x dropped them)
  content/
    site-content.ts          FAQ, and the empty review/team slots
  entries/                   one per HTML page
  lib/
    telegram.ts              the mtcute client — the entire "backend"
    vault.ts                 finds or creates the private storage channel
    storage.ts               StorageService: scan, upload, download, delete
    stream.ts                page half of the Service Worker range bridge
    site.ts                  URLs, address, structured data
    analytics.ts             GA, marketing pages only
    format.ts                bytes, durations, relative dates, file kinds
    file-tiles.ts            hero photography
  store/
    library.ts               files, collections, search, sort, selection
    transfers.ts             upload/download queue with concurrency cap
```

`components/ui/` holds third-party/generated components unmodified, so they can
be re-pulled without stepping on local work; everything hand-written for Axiom
lives one level up.

## Storage model

`lib/storage.ts` is the only module that knows about Telegram. Everything above
it deals in `AxiomFile`.

**Files live in a private channel, not in Saved Messages.** On first upload,
`lib/vault.ts` creates a private channel called "Axiom Storage" in the user's
own account. Saved Messages is a place people already use — notes, forwarded
links, things they mailed themselves — so building a file manager on it means
every unrelated message appears in the library and every delete is one misclick
from destroying something the app did not create. A dedicated channel gives the
app a namespace of its own: listing is exact and deleting is safe.

Resolution order is remembered id → scan dialogs by title → create, so wiping
localStorage costs one dialog scan, never a duplicate channel or a lost file.

**That channel's history is the source of truth.** The file list is derived by
scanning it, not read from a manifest we maintain. A manifest can drift,
corrupt, or disagree with reality after a half-failed upload; the messages
cannot. Anything added later (folders, tags) is an overlay keyed by message id,
so losing the overlay loses organisation and never loses files.

Collections in the sidebar are derived from MIME type rather than being folders
the user has to build first. A new account has working navigation immediately,
and none of it needs storage of its own.

### Transfers

mtcute handles the wire rules — 512 KB parts, `saveBigFilePart` above 10 MB,
4 KB-aligned download offsets that never straddle a 1 MB boundary — and
parallelises across connections internally. On top of that, `store/transfers.ts`
adds a queue with a concurrency cap of 2: since each transfer is *already*
parallel, running many at once splits the same pipe more ways and makes every
ETA worse.

Every transfer keeps its own state, byte counter, smoothed speed, and error.
Collapsing that into one aggregate bar is what makes multi-file uploads feel
broken — when three of twenty fail, an aggregate can't say which three.

### Files larger than Telegram allows

Telegram refuses a single object above 2 GB (4 GB Premium). A 6 GB video is not
exotic — one phone shooting 4K produces them — so `lib/multipart.ts` splits
oversized files across several messages and everything above that layer sees
one file.

Two decisions carry it:

1. **Every part is self-describing.** The manifest is written into each part's
   caption, not stored in one place. A manifest message can be deleted or fail
   to send; captions attached to the parts cannot go missing without the part
   going with them. Scanning rebuilds the logical file from any complete set,
   in any order, and a set that is still missing parts is surfaced as
   `complete: false` rather than hidden.
2. **Part size is 4 KiB-aligned** (1.75 GiB = 458752 × 4096). Telegram only
   accepts download offsets on a 4096 boundary, so aligning part boundaries
   means an aligned offset in the logical file is still aligned inside whatever
   part it lands in — the alignment survives the mapping instead of needing to
   be recomputed per part.

`readRange(file, offset, length)` is the single entry point for bytes. It maps
a global window onto the parts it spans and concatenates, so a seek that
straddles a boundary is stitched transparently. Preview, download and the
Service Worker all go through it, which means reassembly is implemented exactly
once. The mapping is covered by an exhaustive test against a reference model —
330 checks over boundary straddles, gaps, and alignment.

### Streaming

Media elements do not take a callback for bytes — they take a URL and issue
HTTP Range requests. So `public/sw.js` is a Service Worker that claims
`/_stream/<id>` URLs and answers those ranges; it cannot speak MTProto itself,
so it asks the page for each window over `postMessage` (`lib/stream.ts`) and
replies with a 206.

The result is that a 2 GB video opens instantly and seeks anywhere without
downloading itself first. Offsets are aligned down to Telegram's 4 KB boundary
and trimmed before returning, and open-ended ranges (`bytes=0-`) are capped at
a 2 MB window — honouring them literally would fetch the whole file to satisfy
one seek.

### Downloads

Two tiers, chosen by capability rather than browser sniffing:

1. **File System Access API** — `showSaveFilePicker`, then pipe mtcute's
   `ReadableStream` straight into the file. No size ceiling, no memory
   pressure. Chromium only. The picker is opened *before* downloading a byte,
   so a cancelled dialog costs no bandwidth.
2. **Blob** — Safari and Firefox have no save picker, so the file is buffered
   and handed over as an object URL. That has a real ceiling, so it is guarded
   at 512 MB with an explanatory error rather than an out-of-memory crash.

## Design harness

The workspace is unreachable without a phone to scan with, which makes
iterating on layout painfully slow. `npm run dev` then visit **`/app.html#demo`** for
the workspace seeded with fabricated files — real `AxiomFile` records, so the
grid, sorting, search, and selection run their actual code paths.

Gated on `import.meta.env.DEV`, so it is dropped from production builds.

## Sign-in flow

`signInQr` handles the parts that make hand-rolled QR login fail — the ~30s
token refresh, the `LOGIN_TOKEN_MIGRATE_TO` data-centre hop mid-flow, and the
SRP exchange for accounts with a 2FA password. The UI covers the resulting
states: resting, connecting, live QR with countdown, scanned, password, signed
in, error.

A returning visitor is not asked to scan again — `QrLogin` probes for a stored
session on mount and restores it.

## Status

Done: landing page, QR sign-in (verified end to end against Telegram), and the
workspace — scan, upload, download, delete, search, sort, grid/list, preview,
selection, transfer queue, keyboard shortcuts.

Not done:

- **Folders.** The overlay design is settled (keyed by message id, stored as a
  pinned JSON message) but not built. Collections cover navigation until then.
- **Thumbnail prefetch.** Thumbnails load per tile on first render; a batched
  prefetch pass would make fast scrolling smoother.
- **Streaming downloads on Safari/Firefox.** The Service Worker already serves
  ranges for playback; routing saves through it too would lift the 512 MB blob
  ceiling on those browsers.

### Keyboard

| | |
|---|---|
| `/` | Focus search |
| `Esc` | Clear selection, or blur search |
| `Cmd/Ctrl + A` | Select all in view |
| `Delete` | Delete selection (confirms first) |
| `Enter` | Open preview |
| `←` `→` | Step through files in preview |

Click selects, `Shift`-click extends a range over the *current* sort order, and
`Cmd/Ctrl`-click toggles.


## Metadata sync (optional)

`lib/sync.ts` plus `netlify/functions/sync.mts` sync folders, tags and
favourites between a user's devices without anyone being able to read them.

The trust boundary, precisely:

- **The Telegram channel stays the source of truth. This is a cache.** If the
  remote copy is missing, stale or garbage, the app rebuilds from the channel.
  Nothing here can lose a file.
- **The server learns nothing.** It stores two opaque values: a 256-bit lookup
  id (`HMAC-SHA256(key, "axiom:vault-id:v1")`) and an AES-256-GCM ciphertext.
  It cannot derive one from the other, and there is no account, email or
  Telegram id to attach them to. A full database dump is random bytes.
- **The key never touches the server.** It is generated on first use and kept
  in a pinned message inside the user's own storage channel, so a second device
  gets it by being signed into Telegram at all — no passphrase, no key-exchange
  handshake. Possession of the key *is* the authentication.

Requests go through our own Netlify function rather than to Supabase directly.
That is a security decision: it keeps the app origin's `connect-src` at `'self'`
plus Telegram, so the page holding an auth key may talk to exactly two hosts.
The function also rate-limits writes and keeps the service-role key server-side.

Schema in `supabase/schema.sql` — RLS enabled with **no policies**, so the anon
and authenticated roles get nothing and the function is the only path in.

Off by default. Set `VITE_SYNC_ENABLED=true` plus `SUPABASE_URL` and
`SUPABASE_SERVICE_KEY` in Netlify to switch it on; with it off the app is
exactly as it was and never calls out.

## The marketing site

Five pages, built as separate HTML entry points rather than one SPA, so each
ships a real `<title>`, description, canonical and Open Graph tags that a
crawler or link unfurler sees without running JavaScript.

| URL | Source | Purpose |
|---|---|---|
| `/` | `index.html` | Landing: hero, how it works, case study, security, limits, FAQ, contact |
| `/app` | `app/index.html` | The Telegram client |
| `/thank-you` | `thank-you/index.html` | Post-enquiry confirmation (`noindex`) |
| `/privacy` | `privacy/index.html` | Privacy policy |
| `/404` | `404.html` | Not found (`noindex`) |

**No `.html` in any URL.** Pages are emitted as directories, so Netlify serves
them at bare paths — directory output *is* the clean-URL mechanism, not a
redirect papering over an extension. `_redirects` adds explicit 200 rewrites so
`/app` serves directly with no trailing-slash hop, and 301s every legacy
`.html` address onto its clean form in a single redirect.

The split is not only for SEO. **The app page loads no third-party scripts and
its CSP forbids them**, because the Telegram auth key lives in that origin's
storage and any script with page access has key access. Analytics therefore run
on the marketing pages only, which hold nothing. Set `VITE_GA_ID` to switch
them on; with no id, nothing is requested.

Also shipped: `robots.txt` (app disallowed — every URL under it is personal),
`sitemap.xml`, `_redirects` for clean paths, `netlify.toml` with security
headers, breadcrumbs with `BreadcrumbList` data, `FAQPage` data, and `og.png`.

### Content that needs you

Two sections are deliberately empty in `src/content/site-content.ts`, and the
page skips them entirely while they are:

- **`REVIEWS`** — add real quotes from real people. Not pre-filled with
  plausible testimonials, because an invented review is a fabricated
  endorsement: it misleads the reader, and the liability sits with the
  business, not the person who typed it.
- **`TEAM`** — add real people and a real photo at `/public/team/`.

`ADDRESS` in `src/lib/site.ts` is blank for the same reason. Fill it in and the
contact section gains a map and directions, and the structured data upgrades
from `Organization` to `LocalBusiness`. Left blank it stays `Organization`,
which is what Axiom actually is — `LocalBusiness` markup with no verifiable
address risks a manual action rather than a rich result.

## Performance

Measured on the live site, warm CDN cache, before and after the optimisation
pass:

| | Before | After |
|---|---|---|
| TTFB | 701 ms | 137 ms |
| First Contentful Paint | 1800 ms | ~930 ms |
| Load | 2430 ms | ~865 ms |
| Transfer | 2533 KB | 1684 KB |

What actually moved the numbers:

- **Self-hosted Geist.** Google Fonts cost two extra origin handshakes
  (`fonts.googleapis.com` for the CSS, then `fonts.gstatic.com` for the file)
  on the critical path, with the stylesheet blocking render while both
  resolved. Geist ships as one variable file per subset, so 300–700 is a single
  28 KB download from an already-open connection. It also removed two third
  parties from the CSP.
- **Right-sized imagery.** Corridor cards render ~260 px wide; they were being
  shipped at 800 px, roughly 1.6× more pixels than any display could use. At
  640 px (exact for a 2× screen) the photo set dropped 35%.
- **Eager hero loading + preload.** Every corridor card is inside the initial
  viewport, so `loading="lazy"` was deferring the one thing the page is built
  around.

## Design system

Rebuilt around two rules from Apple's HIG:

1. **Hierarchy comes from size and weight** — never all-caps, letter-spacing,
   or a mono face. Uppercase strips the ascenders and descenders that make word
   shapes recognisable, at a measured cost of roughly 12% more fixations per
   line.
2. **Body text is 17px and no control is under 44px.** Nothing should require
   leaning toward the screen.

Tokens live in `src/index.css`: `--text-tiny` (15px, the floor) through
`--text-lead` (22px), plus `display-sm` / `display` / `display-lg` utilities for
section and hero type, on an 8px spacing grid. `screenful` gives a section a
viewport-height minimum so the page reads as a sequence of rooms rather than a
list of thin bands.

### Motion

`lib/motion.ts` holds the shared tokens — durations, easings, spring presets —
and no component writes a duration or easing inline. Everything imports from
`motion/react`; `framer-motion` is not installed, and mixing the two in one tree
is the first thing that breaks.

The "how it works" section is a scroll-driven pinned sequence rather than a
looping animation: a packet is stopped at a company server, scanned, and
released, then the server is struck out and dissolves and the wire heals into
one unbroken line. Scroll drives it so the reader controls the pace and the
removal lands as something they did. Below 40rem the route rotates to vertical,
because three tiles and two rail segments do not fit across a phone. Reduced
motion gets both outcomes stated statically.
