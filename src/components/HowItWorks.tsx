'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { Wordmark } from '@/components/Mark'
import { motionTokens, springs } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ── how it works ─────────────────────────────────────────────────────────
 * The previous version animated an abstract dot along a line. It looked like
 * motion for its own sake because it was. Nobody has ever seen a packet, so
 * watching one move taught nobody anything.
 *
 * This makes the same claim concretely. One real file, with a name and a size,
 * is uploaded both ways at once, and you watch the cost accumulate on one side
 * while the same ledger stays empty on the other: a copy on someone else's
 * server, contents read, storage billed.
 *
 * Counters and words are legible in a way a moving dot is not, and the gap
 * between the two columns is the entire product.
 * ──────────────────────────────────────────────────────────────────────── */

type Step = {
  /** Fraction of the sequence at which this line lands. */
  at: number
  other: { label: string; detail: string }
  axiom: { label: string; detail: string }
}

const STEPS: Step[] = [
  {
    at: 0.14,
    other: { label: 'Copied onto their servers', detail: 'A copy you do not control' },
    axiom: { label: 'Sent straight to your Telegram', detail: 'No copy anywhere else' },
  },
  {
    at: 0.36,
    other: { label: 'Scanned and indexed', detail: 'Contents read to classify them' },
    axiom: { label: 'Never read by us', detail: 'Nothing of ours is in the path' },
  },
  {
    at: 0.58,
    other: { label: 'Counted against your plan', detail: 'Storage and bandwidth billed' },
    axiom: { label: 'Costs nothing', detail: 'We pay for neither' },
  },
]

const FILE = { name: 'Iceland roadtrip.mp4', size: '4.2 GB' }
const RUN_MS = 4200

export function HowItWorks() {
  const reduced = useReducedMotion() ?? false
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(reduced ? 1 : 0)

  /* Runs once, when the section is actually reached, then stays finished.
     Driving it from raw scroll position meant the story ran backwards when you
     scrolled up, which reads as a glitch rather than a rewind. */
  useEffect(() => {
    if (reduced || !ref.current) return
    const el = ref.current
    let raf = 0
    let started = 0

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return
        started = performance.now()
        const tick = (now: number) => {
          const p = Math.min(1, (now - started) / RUN_MS)
          setProgress(p)
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        io.disconnect()
      },
      { threshold: 0.3 },
    )

    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  const pct = Math.round(Math.min(1, progress / 0.7) * 100)

  return (
    <div ref={ref} className="mx-auto w-full max-w-6xl">
      {/* The file itself, named once, so both columns describe the same
          concrete thing instead of an abstraction. */}
      <div className="mx-auto mb-12 max-w-md rounded-2xl border border-line bg-mist/50 p-5 sm:mb-16">
        <div className="flex items-baseline justify-between gap-4">
          <p className="truncate text-body font-medium">{FILE.name}</p>
          <p className="shrink-0 text-small tabular-nums text-titanium">{FILE.size}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full bg-signal"
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.2, ease: motionTokens.easing.linear }}
          />
        </div>
        <p className="mt-2.5 text-small tabular-nums text-titanium">
          {pct < 100 ? `Uploading, ${pct}%` : 'Uploaded'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
        <Column
          heading="Every other cloud"
          tone="other"
          progress={progress}
          reduced={reduced}
          pick={(s) => s.other}
          tally="Copies on a machine you do not own: one, forever."
        />
        <Column
          tone="axiom"
          progress={progress}
          reduced={reduced}
          pick={(s) => s.axiom}
          tally="Copies on a machine we own: zero."
        />
      </div>
    </div>
  )
}

function Column({
  heading,
  tone,
  progress,
  reduced,
  pick,
  tally,
}: {
  heading?: string
  tone: 'other' | 'axiom'
  progress: number
  reduced: boolean
  pick: (s: Step) => { label: string; detail: string }
  tally: string
}) {
  const axiom = tone === 'axiom'

  return (
    <section
      aria-label={heading ?? 'Axiom'}
      className={cn(
        'rounded-3xl border p-6 sm:p-8',
        axiom ? 'border-signal/35 bg-signal-soft/40' : 'border-line bg-mist/40',
      )}
    >
      <header className="flex min-h-14 items-center">
        {axiom ? (
          <Wordmark size="md" />
        ) : (
          <h3 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-graphite">{heading}</h3>
        )}
      </header>

      <ul className="mt-6 space-y-3">
        {STEPS.map((s, i) => {
          const shown = reduced || progress >= s.at
          const item = pick(s)
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: reduced ? 0 : motionTokens.distance.md }}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: motionTokens.distance.md }}
              transition={springs.gentle}
              className={cn(
                'flex items-start gap-3.5 rounded-2xl border bg-paper p-4',
                axiom ? 'border-signal/25' : 'border-line',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                  axiom ? 'bg-signal-soft text-signal' : 'bg-mist',
                )}
              >
                {axiom ? (
                  <Check className="size-4" strokeWidth={2.5} />
                ) : (
                  <span className="block size-2 rounded-full bg-graphite/60" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-body font-medium leading-snug">{item.label}</span>
                <span className="mt-0.5 block text-small leading-snug text-titanium">
                  {item.detail}
                </span>
              </span>
            </motion.li>
          )
        })}
      </ul>

      {/* The tally. One line, and it is the whole argument. */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: reduced || progress > 0.78 ? 1 : 0 }}
        transition={{ duration: motionTokens.duration.slow }}
        className={cn('mt-6 text-body', axiom ? 'font-medium text-signal' : 'text-graphite')}
      >
        {tally}
      </motion.p>
    </section>
  )
}

export default HowItWorks
