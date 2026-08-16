import { ArrowRight, Check, Home, Mail, Search } from 'lucide-react'
import { GithubIcon } from './BrandIcons'
import { Breadcrumbs, SiteFooter, SiteHeader } from './Chrome'
import { SITE } from '@/lib/site'

function Page({
  trail,
  children,
}: {
  trail: { href?: string; label: string }[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main id="main" className="flex-1 pt-32">
        <div className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
          <Breadcrumbs trail={trail} />
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ── thank you ────────────────────────────────────────────────────────────
 * Reached after someone gets in touch. Its job is to confirm what happened,
 * say when they will hear back, and offer somewhere to go next — a dead-end
 * "thanks!" screen wastes the one moment someone is definitely paying
 * attention.
 * ──────────────────────────────────────────────────────────────────────── */
export function ThankYouPage() {
  return (
    <Page trail={[{ label: 'Thank you' }]}>
      <div className="mt-10 flex size-16 items-center justify-center rounded-2xl bg-signal-soft">
        <Check className="size-8 text-signal" strokeWidth={2} />
      </div>
      <h1 className="mt-8 display">Thanks — that reached us.</h1>
      <p className="mt-6 text-lead leading-relaxed text-graphite">
        We read everything that comes in, and you will hear back from a person {SITE.responseTime}.
        If it is urgent, replying to our email lands straight in the same place.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <NextStep
          href="/app"
          icon={ArrowRight}
          title="Open Axiom"
          body="You do not have to wait for us to start using it."
        />
        <NextStep
          href="/#faq"
          icon={Search}
          title="Read the questions"
          body="Your answer may already be written down."
        />
        <NextStep
          href={SITE.github}
          icon={GithubIcon}
          title="Follow the work"
          body="Every change ships in the open."
        />
        <NextStep
          href="/"
          icon={Home}
          title="Back to the start"
          body="Return to the home page."
        />
      </div>
    </Page>
  )
}

function NextStep({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string
  icon: (props: { className?: string; strokeWidth?: number }) => React.ReactNode
  title: string
  body: string
}) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-line p-6 transition-colors hover:border-titanium/50"
    >
      <Icon className="size-6 text-signal" strokeWidth={1.75} />
      <p className="mt-4 text-body font-semibold">{title}</p>
      <p className="mt-1 text-small leading-relaxed text-titanium">{body}</p>
    </a>
  )
}

/* ── 404 ──────────────────────────────────────────────────────────────────
 * Says what happened in plain terms and routes onward. A 404 that only
 * apologises leaves the visitor to press Back, which is the end of the visit.
 * ──────────────────────────────────────────────────────────────────────── */
export function NotFoundPage() {
  return (
    <Page trail={[{ label: 'Page not found' }]}>
      <p className="mt-10 text-lead font-medium text-signal">404</p>
      <h1 className="mt-4 display">That page isn't here.</h1>
      <p className="mt-6 text-lead leading-relaxed text-graphite">
        The link may be out of date, or the address may have a typo in it. Nothing is wrong with your
        files — they live in your Telegram account, not on this website.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <NextStep href="/" icon={Home} title="Home" body="Start from the beginning." />
        <NextStep href="/app" icon={ArrowRight} title="Open Axiom" body="Go straight to your files." />
        <NextStep href="/#faq" icon={Search} title="Questions" body="How Axiom works, answered." />
        <NextStep
          href={`mailto:${SITE.email}`}
          icon={Mail}
          title="Tell us"
          body="If a link of ours is broken, we want to know."
        />
      </div>
    </Page>
  )
}

/* ── privacy ──────────────────────────────────────────────────────────────
 * Short because the architecture makes it short. Every claim here is one the
 * code actually enforces.
 * ──────────────────────────────────────────────────────────────────────── */
export function PrivacyPage() {
  const updated = 'August 2026'

  return (
    <Page trail={[{ label: 'Privacy policy' }]}>
      <h1 className="mt-10 display">Privacy policy</h1>
      <p className="mt-4 text-small text-titanium">Last updated {updated}</p>

      <div className="mt-12 space-y-12">
        <Clause title="The short version">
          <p>
            Axiom runs entirely in your browser. We operate no servers that receive your files, your
            Telegram login, or a list of what you store. We cannot hand over what we never receive.
          </p>
        </Clause>

        <Clause title="What we never receive">
          <ul className="list-disc space-y-2 pl-5">
            <li>Your files. They move directly between your browser and Telegram.</li>
            <li>
              Your Telegram login key. It is created on your device and stored on your device.
            </li>
            <li>The names, sizes, or contents of anything you store.</li>
            <li>Your Telegram messages or contacts. Axiom only touches the channel it created.</li>
          </ul>
        </Clause>

        <Clause title="What is stored on your device">
          <p>
            Your Telegram login key and a small amount of app state are kept in your browser's local
            storage, so you do not have to scan a code every visit. Clearing your browser data for
            this site erases them. Signing out erases them immediately, and revokes the session with
            Telegram.
          </p>
        </Clause>

        <Clause title="Website analytics">
          <p>
            If analytics are enabled, they run on the marketing pages only — never on the app. The
            app page loads no third-party scripts whatsoever, and the browser enforces that through
            a Content Security Policy rather than relying on our good intentions. Analytics, where
            used, measure page visits in aggregate and are never joined to anything in your Telegram
            account.
          </p>
        </Clause>

        <Clause title="Telegram's role">
          <p>
            Your files are stored in your own Telegram account, so Telegram's own privacy policy
            governs them once they arrive. Axiom is independent software and is not affiliated with,
            sponsored by, or endorsed by Telegram.
          </p>
        </Clause>

        <Clause title="Your control">
          <p>
            Deleting a file in Axiom deletes the underlying message in your Telegram channel.
            Deleting that channel in any Telegram app removes everything at once. Because we hold no
            copy, there is no separate deletion request to make of us — and no export to request,
            since the files are already in an account you control.
          </p>
        </Clause>

        <Clause title="Children">
          <p>
            Axiom is not directed at children under 13, and Telegram requires its own minimum age to
            hold an account.
          </p>
        </Clause>

        <Clause title="Changes and contact">
          <p>
            If this policy changes materially we will update the date above and note it in the
            repository history, which is public. Questions go to{' '}
            <a
              href={`mailto:${SITE.email}`}
              className="text-signal underline decoration-signal/30 underline-offset-4"
            >
              {SITE.email}
            </a>{' '}
            and we reply {SITE.responseTime}.
          </p>
        </Clause>
      </div>
    </Page>
  )
}

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display-sm">{title}</h2>
      <div className="mt-4 space-y-4 text-body leading-relaxed text-graphite">{children}</div>
    </section>
  )
}
