import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { GithubIcon, InstagramIcon } from './BrandIcons'
import { Wordmark } from '@/components/Mark'
import { NAV, SITE } from '@/lib/site'
import { cn } from '@/lib/utils'

/* ── header ───────────────────────────────────────────────────────────────
 * The primary action sits in the header at every scroll position, so "start"
 * is never more than one glance away. Every control clears 44px.
 * ──────────────────────────────────────────────────────────────────────── */
export function SiteHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <a href="/" aria-label={`${SITE.name} home`}>
          <Wordmark priority />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="tap rounded-lg px-3.5 text-body text-graphite transition-colors hover:bg-mist hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/app"
            className="tap hidden gap-2 rounded-xl bg-ink px-5 text-body font-medium text-paper transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Open Axiom
            <ArrowRight className="size-4.5" strokeWidth={2} />
          </a>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="tap justify-center rounded-xl px-3 text-graphite transition-colors hover:bg-mist md:hidden"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-paper px-5 py-4 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="tap w-full border-b border-line/70 text-lead text-graphite last:border-b-0"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

/* ── sticky mobile call to action ─────────────────────────────────────────
 * Phones have no persistent header CTA once the thumb is halfway down a long
 * page. This bar appears after the hero scrolls past, so the action is always
 * reachable without scrolling back up.
 * ──────────────────────────────────────────────────────────────────────── */
export function StickyCta() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 620)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-4 backdrop-blur-xl transition-transform duration-300 sm:hidden',
        show ? 'translate-y-0' : 'translate-y-full',
      )}
      // Hidden from assistive tech while off-screen, so it isn't announced twice.
      aria-hidden={!show}
    >
      <a
        href="/app"
        tabIndex={show ? 0 : -1}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-lead font-medium text-paper"
      >
        Try Axiom. It's free
        <ArrowRight className="size-5" strokeWidth={2} />
      </a>
    </div>
  )
}

/* Breadcrumbs, with the matching structured data so the trail can appear in
   search results rather than only on the page. */
export function Breadcrumbs({ trail }: { trail: { href?: string; label: string }[] }) {
  const items = [{ href: '/', label: 'Home' }, ...trail]

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-small">
        <ol className="flex flex-wrap items-center gap-2 text-titanium">
          {items.map((item, i) => (
            <li key={item.label} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>/</span>}
              {item.href && i < items.length - 1 ? (
                <a href={item.href} className="underline-offset-4 hover:text-ink hover:underline">
                  {item.label}
                </a>
              ) : (
                <span aria-current="page" className="text-graphite">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: items.map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.label,
              item: item.href ? `${SITE.url}${item.href}` : undefined,
            })),
          }),
        }}
      />
    </>
  )
}

/* ── footer ───────────────────────────────────────────────────────────────
 * Carries the internal links that would otherwise be orphaned. Every page
 * reachable from every page, which is what stops a crawler treating /privacy
 * and /thank-you as dead ends.
 * ──────────────────────────────────────────────────────────────────────── */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-mist/40">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <a href="/" aria-label={`${SITE.name} home`}>
              <Wordmark />
            </a>
            <p className="mt-4 max-w-xs text-small leading-relaxed text-titanium">
              A personal cloud that runs in your browser and keeps your files in your own Telegram
              account.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SITE.name} on GitHub`}
                className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper text-graphite transition-colors hover:text-ink"
              >
                <GithubIcon className="size-5" />
              </a>
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SITE.name} on Instagram`}
                className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper text-graphite transition-colors hover:text-ink"
              >
                <InstagramIcon className="size-5" />
              </a>
            </div>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { href: '/#how', label: 'How it works' },
              { href: '/#limits', label: 'Limits' },
              { href: '/app', label: 'Open Axiom' },
            ]}
          />
          <FooterColumn
            title="Support"
            links={[
              { href: '/#faq', label: 'Questions' },
              { href: '/#contact', label: 'Contact us' },
              { href: `mailto:${SITE.email}`, label: 'Email support' },
              { href: SITE.github, label: 'Report an issue' },
            ]}
          />
          <FooterColumn
            title="Legal"
            links={[
              { href: '/privacy', label: 'Privacy policy' },
              { href: '/#security', label: 'Security' },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-8 text-small text-titanium sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Built on principles.
          </p>
          <p>Independent software. Not affiliated with or endorsed by Telegram.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <h2 className="text-body font-semibold">{title}</h2>
      <ul className="mt-4 space-y-1">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="tap text-body text-titanium underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
