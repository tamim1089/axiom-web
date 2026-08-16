import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import {
  faqSchema,
  FAQ,
  organizationSchema,
  softwareSchema,
} from './src/content/structured-data.js'

/**
 * Inject structured data into the built HTML.
 *
 * It used to be rendered by React, which meant it only existed once a crawler
 * executed JavaScript. Google renders; link unfurlers, non-Google crawlers and
 * agents largely do not. Stamping it into <head> at build time makes it
 * present for all of them, and keeps a single source of truth.
 */
function structuredData(siteUrl: string): Plugin {
  return {
    name: 'axiom-structured-data',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const url = siteUrl
        const blocks: unknown[] = [
          organizationSchema({
            url,
            email: 'Aacampusdirectoroffice@adu.ac.ae',
            sameAs: [
              'https://github.com/axiom-official',
              'https://www.instagram.com/axiomcloud.official/',
            ],
          }),
        ]
        // Product and FAQ markup belong on the landing page only; repeating
        // them on /privacy would just be duplicate entities.
        if (ctx.path === '/index.html' || ctx.path === '/') {
          blocks.push(softwareSchema(url), faqSchema(FAQ))
        }
        const tags = blocks
          .map(
            (b) =>
              `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`,
          )
          .join('\n    ')
        return html.replace('</head>', `  ${tags}\n  </head>`)
      },
    },
  }
}

/* Multi-page rather than a single-page app with client routing.
 *
 * Each page ships its own real <title>, description, canonical and Open Graph
 * tags in the HTML itself, so a crawler or a link unfurler sees them without
 * executing JavaScript. It also lets the app page carry a stricter
 * Content-Security-Policy than the marketing pages — see app.html. */
export default defineConfig(({ mode }) => {
  // Vite puts .env into import.meta.env for the app, not process.env for the
  // config — reading process.env here silently stamped localhost URLs into the
  // production structured data.
  const env = loadEnv(mode, import.meta.dirname, '')
  const siteUrl = (env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')

  return {
  plugins: [react(), tailwindcss(), structuredData(siteUrl)],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Without a chunking policy the whole app lands in one ~1.3 MB file, so
        // the QR code cannot render until the entire MTProto stack has parsed.
        // These groups let the shell and the QR renderer arrive first.
        codeSplitting: {
          groups: [
            { name: 'mtcute', test: /node_modules[/\\]@mtcute/ },
            { name: 'qrcode', test: /node_modules[/\\](qrcode|dijkstrajs|pngjs)/ },
            { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/ },
            { name: 'motion', test: /node_modules[/\\](motion|framer-motion)/ },
          ],
        },
      },
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        app: path.resolve(import.meta.dirname, 'app/index.html'),
        thankYou: path.resolve(import.meta.dirname, 'thank-you/index.html'),
        privacy: path.resolve(import.meta.dirname, 'privacy/index.html'),
        // 404 stays at the root: Netlify looks for /404.html by convention.
        notFound: path.resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  }
})
