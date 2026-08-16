import { ArrowRight, Check, Clock, Lock, Mail, Server, Zap } from 'lucide-react'
import { GithubIcon, InstagramIcon } from '@/components/site/BrandIcons'
import { ImageStreamHero } from '@/components/ui/image-stream-hero'
import { ScrollChoreography } from '@/components/ui/scroll-choreography'
import { HowItWorks } from '@/components/HowItWorks'
import { SiteFooter, SiteHeader, StickyCta } from '@/components/site/Chrome'
import { Reveal } from '@/components/site/Reveal'
import { CORRIDOR, CORRIDOR_CARDS, PHOTOS } from '@/lib/file-tiles'
import { FAQ, REVIEWS, TEAM } from '@/content/site-content'
import { ADDRESS, SITE, hasAddress } from '@/lib/site'

const PRINCIPLES = [
  {
    icon: Lock,
    title: 'The key never leaves your device',
    body: 'Your Telegram login is created in this browser and stays in this browser. There is no copy on a server, because there is no server to keep one on.',
  },
  {
    icon: Zap,
    title: 'Files travel straight to Telegram',
    body: 'Uploads and downloads run directly between your browser and Telegram’s data centres. Nothing sits in the middle to slow them down, inspect them, or bill you for the bandwidth.',
  },
  {
    icon: Server,
    title: 'The storage is already yours',
    body: 'Files land in a private channel inside your own Telegram account. Stop using Axiom tomorrow and they are all still there, reachable from any Telegram app you own.',
  },
]

const LIMITS = [
  ['Largest single file', '2 GB, which is Telegram’s ceiling rather than ours'],
  ['Total storage', 'Whatever your Telegram account allows. We do not claim unlimited'],
  ['While transferring', 'Keep the tab open; closing it stops the transfer'],
  ['On iPhone', 'Safari can forget the login after about a week away, so you rescan'],
]

export function Landing() {
  return (
    <div className="bg-paper">
      {/* Structured data is stamped into the HTML at build time by the
          axiom-structured-data Vite plugin, so crawlers that do not execute
          JavaScript still see it. Rendering it here too would duplicate it. */}

      <SiteHeader />
      <StickyCta />

      <main id="main">
        {/* ── hero ──────────────────────────────────────────────────────
            The corridor carries photographs of people with their dogs: the
            thing people actually keep a lifetime of files for is not
            "documents", it is the people and animals in them. */}
        <section className="relative pt-20">
          <ImageStreamHero
            images={CORRIDOR}
            cards={CORRIDOR_CARDS}
            priority
            speed={26}
            axis={52}
            className="h-[86vh] min-h-[680px] w-full bg-paper"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(58% 48% at 50% 56%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.62) 52%, rgba(255,255,255,0) 82%)',
              }}
            />
            <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
              <p className="eyebrow">Personal cloud storage</p>
              <h1 className="mt-6 max-w-5xl display-lg">
                Your cloud.
                <br />
                Your control.
              </h1>
              <p className="measure mt-8 text-[clamp(1.125rem,2vw,1.375rem)] leading-relaxed text-graphite">
                Keep every photo, video and document in your own Telegram account, opened from any
                browser, with nothing in between. Not even us.
              </p>

              {/* Both actions above the fold, primary first. */}
              <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
                <a
                  href="/app"
                  className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-ink px-8 text-lead font-medium text-paper transition-opacity hover:opacity-90 sm:w-auto"
                >
                  Try Axiom. It's free
                  <ArrowRight className="size-5" strokeWidth={2} />
                </a>
                <a
                  href="#how"
                  className="flex h-14 w-full items-center justify-center rounded-2xl border border-line bg-paper px-8 text-lead text-graphite transition-colors hover:border-titanium/50 hover:text-ink sm:w-auto"
                >
                  See how it works
                </a>
              </div>

              <p className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-small text-titanium">
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-signal" strokeWidth={2.5} /> No account to create
                </span>
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-signal" strokeWidth={2.5} /> No card, no trial
                </span>
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-signal" strokeWidth={2.5} /> Scan once, you're in
                </span>
              </p>
            </div>
          </ImageStreamHero>
        </section>

        {/* ── promise bar ───────────────────────────────────────────────── */}
        <section className="border-y border-line bg-mist/50">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-8">
            <Promise icon={Clock} title={`We reply ${SITE.responseTime}`}>
              Email us and a person answers. No ticket queue.
            </Promise>
            <Promise icon={Lock} title="Nothing to trust us with">
              We hold no files and no login keys, by design.
            </Promise>
            <Promise icon={GithubIcon} title="Open to inspect">
              Read the code that runs in your browser.
            </Promise>
          </div>
        </section>

        {/* ── how it works ──────────────────────────────────────────────── */}
        <section id="how" className="scroll-mt-24 py-28 sm:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-5 max-w-3xl display">
                Every other cloud puts a company in the middle.
              </h2>
            </Reveal>
            <p className="measure mt-6 text-lead leading-relaxed text-graphite">
              That middle is where files get scanned, accounts get locked, and subscriptions get
              charged. Axiom's middle is empty, not as a policy we could quietly change, but
              because there is nothing there to run one.{' '}
              <a
                href="#security"
                className="text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
              >
                Read how we keep it that way
              </a>
              .
            </p>
          </div>

          <div className="mt-16">
            <HowItWorks />
          </div>

          <div className="mx-auto mt-20 max-w-7xl px-5 sm:px-8">
            <div className="grid gap-10 md:grid-cols-3">
              {PRINCIPLES.map(({ icon: Icon, title, body }) => (
                <article key={title}>
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-signal-soft">
                    <Icon className="size-7 text-signal" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-6 text-[1.625rem] font-semibold leading-tight tracking-[-0.02em]">{title}</h3>
                  <p className="mt-3 text-body leading-relaxed text-graphite">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── the experience ────────────────────────────────────────────── */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-7xl px-5 pt-24 sm:px-8 sm:pt-32">
            <Reveal><p className="eyebrow">The experience</p>
            <h2 className="mt-5 max-w-3xl display">
              Scattered across devices. Gathered into one place.
            </h2></Reveal>
            <p className="measure mt-6 text-lead leading-relaxed text-graphite">
              Folders, search, previews and streaming video. The ordinary things a file manager
              owes you, with none of the storage machinery showing through.
            </p>
          </div>
          <ScrollChoreography images={PHOTOS} className="mt-16" />
        </section>

        {/* ── security ──────────────────────────────────────────────────── */}
        <section id="security" className="screenful scroll-mt-24 border-t border-line py-28 sm:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal><p className="eyebrow">Security</p>
            <h2 className="mt-5 max-w-3xl display">
              The honest version, including the trade-off.
            </h2></Reveal>
            <div className="measure mt-6 space-y-5 text-lead leading-relaxed text-graphite">
              <p>
                Because Axiom runs entirely in your browser, your login key is stored there too. That
                removes the biggest risk in this kind of product. A company database full of other
                people's account keys. And replaces it with a smaller one: any malicious script
                loaded on this site could read your key.
              </p>
              <p>
                So we load none. No analytics, no ad pixels, no third-party scripts of any kind run
                on the app itself, and the browser enforces that rather than trusting us to keep our
                word. It is the same bargain Telegram Web makes, and we would rather write it down
                than leave you to find out.
              </p>
            </div>
          </div>
        </section>

        {/* ── limits ────────────────────────────────────────────────────── */}
        <section id="limits" className="screenful scroll-mt-24 border-t border-line py-28 sm:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal><p className="eyebrow">Where the edges are</p>
            <h2 className="mt-5 max-w-3xl display">
              The parts most pages leave out.
            </h2></Reveal>
            <dl className="mt-14 divide-y divide-line border-y border-line">
              {LIMITS.map(([term, detail]) => (
                <div key={term} className="grid gap-x-10 gap-y-2 py-7 sm:grid-cols-[18rem_1fr]">
                  <dt className="text-body font-semibold">{term}</dt>
                  <dd className="text-body leading-relaxed text-graphite">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Reviews and team render only with real content behind them. */}
        {REVIEWS.length > 0 && (
          <section className="screenful border-t border-line py-28 sm:py-40">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <Reveal><p className="eyebrow">What people say</p>
              <h2 className="mt-5 display">In their words.</h2></Reveal>
              <div className="mt-14 grid gap-8 md:grid-cols-3">
                {REVIEWS.map((r) => (
                  <figure key={r.name} className="rounded-3xl border border-line bg-mist/40 p-8">
                    <blockquote className="text-body leading-relaxed">“{r.quote}”</blockquote>
                    <figcaption className="mt-6 text-small">
                      <span className="font-semibold">{r.name}</span>
                      <span className="block text-titanium">{r.role}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {TEAM.length > 0 && (
          <section className="screenful border-t border-line py-28 sm:py-40">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <Reveal><p className="eyebrow">The team</p>
              <h2 className="mt-5 display">The people who built it.</h2></Reveal>
              <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {TEAM.map((m) => (
                  <figure key={m.name}>
                    <img
                      src={m.photo}
                      alt={`${m.name}, ${m.role} at ${SITE.name}`}
                      className="aspect-[4/5] w-full rounded-2xl object-cover"
                      loading="lazy"
                    />
                    <figcaption className="mt-4">
                      <p className="text-body font-semibold">{m.name}</p>
                      <p className="text-small text-titanium">{m.role}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── faq ───────────────────────────────────────────────────────── */}
        <section id="faq" className="screenful scroll-mt-24 border-t border-line py-28 sm:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal><p className="eyebrow">Questions</p>
            <h2 className="mt-5 max-w-3xl display">
              Answered properly, including the awkward ones.
            </h2></Reveal>
            <div className="mt-14 divide-y divide-line border-y border-line">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-7">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[1.5rem] font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden
                      className="mt-1 shrink-0 text-titanium transition-transform group-open:rotate-45"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.75" />
                      </svg>
                    </span>
                  </summary>
                  <p className="measure mt-4 text-body leading-relaxed text-graphite">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── contact ───────────────────────────────────────────────────── */}
        <section id="contact" className="screenful scroll-mt-24 border-t border-line py-28 sm:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <Reveal><p className="eyebrow">Contact</p>
                <h2 className="mt-5 display">Talk to a person.</h2></Reveal>
                <p className="measure mt-6 text-lead leading-relaxed text-graphite">
                  Questions about how it works, something broken, or an idea for what it should do
                  next, write to us and we reply {SITE.responseTime}.
                </p>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`mailto:${SITE.email}?subject=Axiom%20enquiry`}
                    className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-ink px-7 text-lead font-medium text-paper transition-opacity hover:opacity-90"
                  >
                    <Mail className="size-5" strokeWidth={1.75} />
                    Email us
                  </a>
                  <a
                    href={SITE.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border border-line px-7 text-lead text-graphite transition-colors hover:text-ink"
                  >
                    <InstagramIcon className="size-5" />
                    Message on Instagram
                  </a>
                </div>

                {hasAddress() && (
                  <address className="mt-10 not-italic text-body leading-relaxed text-graphite">
                    {ADDRESS.street}
                    <br />
                    {ADDRESS.city}
                    {ADDRESS.region && `, ${ADDRESS.region}`} {ADDRESS.postalCode}
                    <br />
                    {ADDRESS.country}
                    <br />
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS.mapsQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-signal underline decoration-signal/30 underline-offset-4"
                    >
                      Get directions
                    </a>
                  </address>
                )}
              </div>

              {hasAddress() ? (
                <iframe
                  title="Map showing our location"
                  loading="lazy"
                  className="h-96 w-full rounded-3xl border border-line"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(ADDRESS.mapsQuery)}&output=embed`}
                />
              ) : (
                <div className="rounded-3xl border border-line bg-mist/50 p-10">
                  <h3 className="text-[1.625rem] font-semibold tracking-[-0.02em]">Prefer to read the code?</h3>
                  <p className="mt-4 text-body leading-relaxed text-graphite">
                    Everything that runs in your browser is published. If a claim on this page
                    matters to you, you can go and check it rather than take our word.
                  </p>
                  <a
                    href={SITE.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap mt-6 gap-2 text-body font-medium text-signal underline decoration-signal/30 underline-offset-4"
                  >
                    <GithubIcon className="size-5" />
                    View the source
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── close ─────────────────────────────────────────────────────── */}
        <section className="border-t border-line bg-mist/40 py-28 sm:py-36">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="display">
              Scan once. It's your cloud from there.
            </h2>
            <p className="mt-6 text-lead leading-relaxed text-graphite">
              No account, no card, no installer. Open it in the browser you already have.
            </p>
            <a
              href="/app"
              className="mt-10 inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-ink px-9 text-lead font-medium text-paper transition-opacity hover:opacity-90"
            >
              Open Axiom
              <ArrowRight className="size-5" strokeWidth={2} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function Promise({
  icon: Icon,
  title,
  children,
}: {
  icon: (props: { className?: string; strokeWidth?: number }) => React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4">
      <Icon className="mt-0.5 size-6 shrink-0 text-signal" strokeWidth={1.75} />
      <div>
        <p className="text-body font-semibold">{title}</p>
        <p className="mt-1 text-small leading-relaxed text-titanium">{children}</p>
      </div>
    </div>
  )
}

export default Landing
