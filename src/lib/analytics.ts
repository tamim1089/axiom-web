/* ── analytics ────────────────────────────────────────────────────────────
 * Google Analytics loads a third-party script. On the app page that is
 * unacceptable: the Telegram login key lives in that origin's storage, and any
 * script with access to the page has access to the key. One compromised tag
 * would be an account breach, not a tracking problem.
 *
 * So analytics exist only on the marketing pages, which hold nothing. The app
 * ships a Content Security Policy with no third-party origins at all, so even
 * a mistaken future import cannot load one — the browser refuses.
 *
 * Set VITE_GA_ID in .env to switch it on. With no id, nothing is requested.
 * ──────────────────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function initAnalytics(): void {
  const id = import.meta.env.VITE_GA_ID as string | undefined
  if (!id) return
  if (document.querySelector(`script[data-ga="${id}"]`)) return

  const tag = document.createElement('script')
  tag.async = true
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  tag.dataset.ga = id
  document.head.appendChild(tag)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // Must push `arguments` itself — gtag.js reads the Arguments object, and
    // spreading it into an array breaks the parameter parsing.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  // No cookie-based cross-site signals; we only need to count visits.
  window.gtag('config', id, { anonymize_ip: true })
}
