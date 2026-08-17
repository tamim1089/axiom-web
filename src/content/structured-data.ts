/* ── structured data ──────────────────────────────────────────────────────
 * Pure data and pure builders, no `import.meta.env`, no browser APIs. So
 * this module can be imported by the Vite config at build time as well as by
 * the app at runtime.
 *
 * That matters: the JSON-LD used to be rendered by React, which meant it only
 * existed after a crawler executed JavaScript. Google does render, but plenty
 * of things that read structured data do not, link unfurlers, non-Google
 * crawlers, AI agents. Injecting it into the HTML at build time makes it
 * present for everyone, from one definition rather than two that drift.
 * ──────────────────────────────────────────────────────────────────────── */

export const DESCRIPTION =
  'Axiom is a personal cloud that runs entirely in your browser and keeps your files in your own Telegram account.'

export const FAQ = [
  {
    q: 'Where do my files actually go?',
    a: 'Into a private channel called “Axiom Storage” that Axiom creates inside your own Telegram account the first time you upload. Only you are in it. Axiom has no servers, so there is nowhere else for a file to be. If you stop using Axiom tomorrow, the channel and everything in it stays in your Telegram account.',
  },
  {
    q: 'Can Axiom read my files, or see my Telegram messages?',
    a: 'No. The whole app runs in your browser tab and talks to Telegram directly. Your login key is created on your device and stored on your device, and it is never transmitted to us. We do not operate a server that could receive it. Axiom only ever touches the storage channel it created, never your chats.',
  },
  {
    q: 'What does it cost, and how much can I store?',
    a: 'Axiom itself is free, and there is no subscription, because we pay for no storage and no bandwidth. Your files move directly between your browser and Telegram. Your capacity is whatever your Telegram account allows. We will not advertise unlimited storage, because individual files are capped by Telegram, and Telegram sets the overall limits, not us.',
  },
  {
    q: 'Is this allowed, and is it reliable enough to trust?',
    a: 'You are using your own Telegram account through Telegram’s documented client API, which is the same mechanism Telegram Web and Telegram Desktop use. That said, we would not recommend Axiom as your only copy of anything irreplaceable. Any storage you do not control the terms of deserves a second copy somewhere else. That is true of Axiom, and it is true of Dropbox.',
  },
  {
    q: 'What happens if I clear my browser data, or switch devices?',
    a: 'Your files are untouched. They live in Telegram, not in the browser. Clearing site data only erases the login key, so you scan the QR code once more. Signing in on a new device works the same way: scan, and your whole library is there. On iPhone, Safari can drop stored data after about a week without a visit, so expect to rescan occasionally there.',
  },
] as const

type AddressInput = {
  street: string
  city: string
  region: string
  postalCode: string
  country: string
  phone: string
}

/** Organization by default; LocalBusiness only once a real address exists. */
export function organizationSchema(opts: {
  url: string
  email: string
  sameAs: string[]
  address?: AddressInput
}) {
  const hasAddress = Boolean(opts.address?.street && opts.address?.city)
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': hasAddress ? 'LocalBusiness' : 'Organization',
    name: 'Axiom',
    url: opts.url,
    logo: `${opts.url}/logo.png`,
    image: `${opts.url}/og-v2.jpg`,
    description: DESCRIPTION,
    email: opts.email,
    sameAs: opts.sameAs,
  }
  if (!hasAddress || !opts.address) return base

  return {
    ...base,
    telephone: opts.address.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: opts.address.street,
      addressLocality: opts.address.city,
      addressRegion: opts.address.region,
      postalCode: opts.address.postalCode,
      addressCountry: opts.address.country,
    },
  }
}

export function softwareSchema(url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Axiom',
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Any',
    url,
    description: DESCRIPTION,
    // Free with no subscription, stated because it is the unusual part.
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
}

export function faqSchema(items: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  }
}
