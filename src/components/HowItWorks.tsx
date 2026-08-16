'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { Building2, Cloud, Monitor } from 'lucide-react'
import { Wordmark } from '@/components/Mark'
import { motionTokens } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ── how it works ─────────────────────────────────────────────────────────
 * The claim is a removal, so the section performs the removal.
 *
 * One pinned stage, driven entirely by scroll position. In the first act a
 * packet leaves your device, stops dead at a company server, gets swept by a
 * scan bar, and only then continues, while the three things that happen to it
 * there surface underneath. In the second act that server is struck out and
 * dissolves, the wire heals into one unbroken line, and the packet crosses in
 * a single move.
 *
 * Scroll drives it rather than a timer for three reasons: the reader controls
 * the pace, the section earns the height it occupies, and the removal lands as
 * something you did rather than something that happened at you. A looping
 * animation in a small box could show the same shapes and would mean nothing.
 *
 * Reduced motion gets both acts side by side, static and complete — the
 * argument survives without the choreography.
 * ──────────────────────────────────────────────────────────────────────── */

const ACTS = {
  /* Act one: the packet is intercepted. */
  approach: [0, 0.14],
  held: [0.14, 0.26],
  release: [0.26, 0.36],
  /* The turn: the middleman is struck out and removed. */
  strike: [0.4, 0.5],
  dissolve: [0.48, 0.6],
  /* Act two: one unbroken crossing. */
  clear: [0.62, 0.92],
} as const

/* A phone cannot hold three tiles and two rail segments across 390px without
   the labels colliding, so the route rotates to vertical below the breakpoint.
   Same motion values, same choreography — only the axis changes. */
function useVertical() {
  const [vertical, setVertical] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 40rem)')
    const sync = () => setVertical(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return vertical
}

export function HowItWorks() {
  const reduced = useReducedMotion() ?? false
  const vertical = useVertical()
  const trackRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  })

  // Smoothing the raw progress keeps the packet from twitching with a trackpad's
  // sub-pixel deltas, which reads as jitter rather than motion.
  const sp = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 40,
    restDelta: 0.0005,
  })

  if (reduced) return <StaticFallback />

  return (
    <div ref={trackRef} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden pt-20 pb-24 sm:pt-24 sm:pb-0">
        <Stage sp={sp} vertical={vertical} />
      </div>
    </div>
  )
}

function Stage({ sp, vertical }: { sp: MotionValue<number>; vertical: boolean }) {
  // Two helpers rather than one: a single signature widens every value to
  // string | number, and then nothing can be handed to a typed prop.
  const pct = (input: number[], output: string[]) => useTransform(sp, input, output)
  const val = (input: number[], output: number[]) => useTransform(sp, input, output)

  /* ── act one ─────────────────────────────────────────────────────────── */
  const packetA = pct(
    [ACTS.approach[0], ACTS.approach[1], ACTS.held[1], ACTS.release[1]],
    ['0%', '50%', '50%', '100%'],
  )
  // Node labels sit below their tiles; the middleman's label is absolutely
  // placed so the rail stays vertically centred on the endpoints.
  const packetAOpacity = val([0, 0.02, 0.38, 0.44], [0, 1, 1, 0])
  const scanOpacity = val([ACTS.held[0], ACTS.held[0] + 0.02, ACTS.held[1], ACTS.held[1] + 0.02], [0, 1, 1, 0])
  const scanY = pct([ACTS.held[0], ACTS.held[1]], ['-100%', '100%'])
  const chipsOpacity = val([0.16, 0.24, ACTS.strike[0], ACTS.strike[1]], [0, 1, 1, 0])

  /* ── the turn ────────────────────────────────────────────────────────── */
  const strikeScale = val([ACTS.strike[0], ACTS.strike[1]], [0, 1])
  const middleOpacity = val([ACTS.dissolve[0], ACTS.dissolve[1]], [1, 0])
  const middleScale = val([ACTS.dissolve[0], ACTS.dissolve[1]], [1, 0.82])
  // The two wire halves become one: the inner gap closes as the server leaves.
  const gapScale = val([ACTS.dissolve[0], ACTS.dissolve[1]], [0, 1])

  /* ── act two ─────────────────────────────────────────────────────────── */
  const packetB = pct([ACTS.clear[0], ACTS.clear[1]], ['0%', '100%'])
  const packetBOpacity = val([ACTS.clear[0] - 0.03, ACTS.clear[0], 0.95, 1], [0, 1, 1, 0])

  /* Strictly sequential, never overlapping: the first line is fully gone by
     0.52 and the second only starts at 0.55. Crossfading two lines of display
     type through each other renders both illegible for the whole handover —
     the reader sees a smear rather than a replacement. A small counter-motion
     on each makes it read as one line being swapped for another. */
  const titleAOpacity = val([0, 0.05, 0.46, 0.52], [0, 1, 1, 0])
  const titleAY = val([0.46, 0.52], [0, -motionTokens.distance.md])
  const titleBOpacity = val([0.55, 0.62], [0, 1])
  const titleBY = val([0.55, 0.62], [motionTokens.distance.md, 0])
  const verdictOpacity = val([0.72, 0.82], [0, 1])
  const verdictY = val([0.72, 0.82], [motionTokens.distance.lg, 0])

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      {/* Titles occupy one grid cell so swapping them never shifts the stage. */}
      <div className="grid min-h-[9rem] place-items-center text-center sm:min-h-[13rem]">
        <motion.div style={{ opacity: titleAOpacity, y: titleAY }} className="col-start-1 row-start-1">
          <p className="text-small font-medium text-titanium">Every other cloud</p>
          <h3 className="display-sm mt-3">Your file stops at their servers.</h3>
        </motion.div>
        <motion.div
          style={{ opacity: titleBOpacity, y: titleBY }}
          className="col-start-1 row-start-1 flex flex-col items-center"
        >
          <Wordmark size="xl" />
          <h3 className="display-sm mt-5">It goes straight to Telegram.</h3>
        </motion.div>
      </div>

      {/* ── the route ───────────────────────────────────────────────────
          One continuous rail with the middleman floating above it, rather than
          two rails either side of a node. The line is therefore already
          unbroken when the server dissolves — nothing grows to close a gap,
          and no layout property is animated to fake it. */}
      <div
        className={cn(
          'flex items-center',
          vertical ? 'mt-6 flex-col gap-0' : 'mt-14 gap-4 sm:mt-20 sm:gap-8',
        )}
      >
        <Node icon={Monitor} label="Your device" vertical={vertical} />

        <div className={cn('relative', vertical ? 'h-40 w-1' : 'min-w-0 flex-1')}>
          <div
            className={cn(
              'rounded-full bg-line',
              vertical ? 'mx-auto h-full w-1' : 'h-1 w-full',
            )}
          />
          {/* Healed rail: scales out from the centre as the middleman leaves. */}
          <motion.div
            style={vertical ? { scaleY: gapScale } : { scaleX: gapScale }}
            className={cn(
              'absolute origin-center rounded-full bg-signal/50',
              vertical ? 'inset-y-0 left-0 w-1' : 'inset-x-0 top-0 h-1',
            )}
          />

          <Packet pos={packetA} opacity={packetAOpacity} vertical={vertical} tone="graphite" />
          <Packet pos={packetB} opacity={packetBOpacity} vertical={vertical} tone="signal" />

          {/* The middleman, centred on the rail. */}
          <motion.div
            style={{ opacity: middleOpacity, scale: middleScale }}
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          >
            <div className={cn('relative flex items-center justify-center overflow-hidden rounded-3xl border-2 border-ink/25 bg-paper', vertical ? 'size-20' : 'size-24 sm:size-32')}>
              <Building2 className={cn('text-ink', vertical ? 'size-9' : 'size-10 sm:size-14')} strokeWidth={1.5} />
              <motion.span
                style={{ opacity: scanOpacity, y: scanY }}
                className="absolute inset-x-0 h-1 bg-ink/40"
              />
            </div>
            {/* Struck out before it goes — a removal you can see happen. */}
            <motion.span
              style={{ scaleX: strikeScale }}
              className="absolute left-0 top-1/2 h-1 w-full origin-left -translate-y-1/2 rounded-full bg-signal"
            />
            <p
              className={cn(
                'absolute whitespace-nowrap text-small font-medium text-ink sm:text-body',
                vertical
                  ? 'left-full top-1/2 ml-5 -translate-y-1/2'
                  : 'inset-x-0 top-full mt-3 text-center',
              )}
            >
              Their servers
            </p>
          </motion.div>
        </div>

        <Node icon={Cloud} label="Storage" vertical={vertical} />
      </div>

      {/* ── what happens in the middle ────────────────────────────────── */}
      <div className="mt-8 grid min-h-[5.5rem] place-items-center sm:mt-20 sm:min-h-[6rem]">
        <motion.ul
          style={{ opacity: chipsOpacity }}
          className="col-start-1 row-start-1 flex flex-wrap justify-center gap-3"
        >
          {['Scanned', 'Metered', 'Billed'].map((n) => (
            <li
              key={n}
              className="rounded-full border border-line bg-paper px-4 py-2.5 text-small text-graphite sm:px-6 sm:py-3 sm:text-body"
            >
              {n}
            </li>
          ))}
        </motion.ul>

        <motion.p
          style={{ opacity: verdictOpacity, y: verdictY }}
          className="col-start-1 row-start-1 measure text-center text-lead leading-relaxed text-graphite"
        >
          Nothing sits in the middle, because we run nothing in the middle. Your files never
          touch a machine we own.
        </motion.p>
      </div>
    </div>
  )
}

function Packet({
  pos,
  opacity,
  vertical,
  tone,
}: {
  pos: MotionValue<string>
  opacity: MotionValue<number>
  vertical: boolean
  tone: 'graphite' | 'signal'
}) {
  return (
    <motion.span
      style={vertical ? { top: pos, opacity } : { left: pos, opacity }}
      className={cn(
        'absolute z-20 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full',
        vertical ? 'left-1/2' : 'top-0.5',
        tone === 'signal'
          ? 'bg-signal shadow-[0_0_0_8px_rgba(10,108,255,0.18)]'
          : 'bg-graphite shadow-[0_0_0_6px_rgba(61,65,72,0.12)]',
      )}
    />
  )
}

function Node({
  icon: Icon,
  label,
  vertical,
}: {
  icon: typeof Monitor
  label: string
  vertical: boolean
}) {
  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-4', vertical && 'gap-3')}>
      <div className={cn('flex items-center justify-center rounded-3xl border-2 border-line bg-paper', vertical ? 'size-20' : 'size-24 sm:size-32')}>
        <Icon className={cn('text-graphite', vertical ? 'size-9' : 'size-10 sm:size-14')} strokeWidth={1.5} />
      </div>
      <span className="text-center text-small font-medium text-graphite sm:text-body">{label}</span>
    </div>
  )
}

/* Motion off: both outcomes, stated plainly, at full size. */
function StaticFallback() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      {[
        {
          label: 'Every other cloud',
          title: 'Your file stops at their servers.',
          body: 'It is scanned, metered and billed on the way through.',
          accent: false,
        },
        {
          label: 'Axiom',
          title: 'It goes straight to Telegram.',
          body: 'Nothing sits in the middle, because we run nothing in the middle.',
          accent: true,
        },
      ].map((r) => (
        <section
          key={r.label}
          className={cn(
            'mb-6 rounded-3xl border p-10',
            r.accent ? 'border-signal/35 bg-signal-soft/45' : 'border-line bg-mist/45',
          )}
        >
          <p className={cn('text-small font-medium', r.accent ? 'text-signal' : 'text-titanium')}>
            {r.label}
          </p>
          <h3 className="display-sm mt-3">{r.title}</h3>
          <p className="measure mt-4 text-lead leading-relaxed text-graphite">{r.body}</p>
        </section>
      ))}
    </div>
  )
}

export default HowItWorks
