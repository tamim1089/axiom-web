/* ── motion tokens ────────────────────────────────────────────────────────
 * The shared vocabulary every animated component draws from. Durations and
 * easings are never written inline in a component — one place to tune means
 * the whole site keeps a single sense of timing rather than drifting into
 * fifteen slightly different "0.4s ease-out"s.
 *
 * Motion here must guide attention, communicate state, or preserve spatial
 * continuity. Anything that does none of those gets deleted.
 * ──────────────────────────────────────────────────────────────────────── */

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
    slow: 0.6,
    crawl: 1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp: [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    linear: [0, 0, 1, 1],
  },
  distance: { xs: 4, sm: 8, md: 16, lg: 24, xl: 48 },
  scale: { subtle: 0.98, press: 0.95, pop: 1.04 },
} as const

export const springs = {
  snappy: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
  instant: { type: 'spring', stiffness: 600, damping: 35 },
  release: { type: 'spring', stiffness: 200, damping: 20, restDelta: 0.001 },
} as const

/** Standard entrance for a section's children, staggered by index. */
export const rise = (reduced: boolean, index = 0) => ({
  initial: { opacity: 0, y: reduced ? 0 : motionTokens.distance.lg },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: {
    duration: reduced ? motionTokens.duration.fast : motionTokens.duration.slow,
    ease: motionTokens.easing.smooth,
    delay: reduced ? 0 : index * 0.08,
  },
})
