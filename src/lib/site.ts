/** Single source of truth for anything that appears in more than one place. */

export const SITE = {
  name: 'Axiom',
  tagline: 'Your cloud. Your control.',
  /* Set VITE_SITE_URL in .env — it drives every canonical URL, Open Graph
     tag, sitemap entry and schema block, in the HTML and at runtime alike.
     Point it at the custom domain the day you attach one. */
  url: (import.meta.env.VITE_SITE_URL as string) || 'http://localhost:5173',
  github: 'https://github.com/axiom-official',
  instagram: 'https://www.instagram.com/axiomcloud.official/',
  email: 'Aacampusdirectoroffice@adu.ac.ae',
  /* Stated on the page so it is a promise, not a hope. Keep it true. */
  responseTime: 'within one business day',
} as const

/* ── physical address ─────────────────────────────────────────────────────
 * Deliberately blank. Filling this in switches the contact section to show a
 * map and directions, and upgrades the structured data from Organization to
 * LocalBusiness.
 *
 * It is blank rather than guessed because publishing a wrong address is worse
 * than publishing none: Google cross-checks name/address/phone against other
 * listings, and a mismatch costs you the local ranking the markup was for.
 * ──────────────────────────────────────────────────────────────────────── */
export const ADDRESS = {
  street: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  /** Exactly as it appears on Google Maps, so the embed and link agree. */
  mapsQuery: '',
} as const

export const hasAddress = (): boolean => Boolean(ADDRESS.street && ADDRESS.city)

export const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#story', label: 'Case study' },
  { href: '/#faq', label: 'Questions' },
  { href: '/#contact', label: 'Contact' },
] as const

/* Structured data now lives in src/content/structured-data.ts, which has no
   browser-only imports so the Vite config can use it at build time too. */
