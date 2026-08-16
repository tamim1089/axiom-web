'use client'

import { motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ── reveal ───────────────────────────────────────────────────────────────
 * A section that arrives rather than simply being there.
 *
 * Deliberately restrained: a short rise and fade, once, on the way in. The
 * point is that scrolling feels like something is happening — not that every
 * element performs. Anything more elaborate on every block becomes noise you
 * have to scroll past rather than read.
 *
 * `once` matters. Re-animating on every pass punishes anyone who scrolls back
 * up, which is exactly what someone re-reading a claim is doing.
 * ──────────────────────────────────────────────────────────────────────── */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article'
}) {
  const reduced = useReducedMotion() ?? false
  const Tag = motion[as]

  return (
    <Tag
      initial={{ opacity: 0, y: reduced ? 0 : motionTokens.distance.lg }}
      whileInView={{ opacity: 1, y: 0 }}
      // A negative margin means the reveal fires slightly before the block is
      // fully on screen, so it has finished by the time it is being read.
      viewport={{ once: true, margin: '-12% 0px -8% 0px' }}
      transition={{
        duration: reduced ? motionTokens.duration.fast : motionTokens.duration.slow,
        ease: motionTokens.easing.smooth,
        delay: reduced ? 0 : delay,
      }}
      className={className}
    >
      {children}
    </Tag>
  )
}

/** Staggered children — used where a group should land in sequence. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
}: {
  children: React.ReactNode[]
  className?: string
  stagger?: number
}) {
  return (
    <div className={cn(className)}>
      {children.map((child, i) => (
        <Reveal key={i} delay={i * stagger}>
          {child}
        </Reveal>
      ))}
    </div>
  )
}

export default Reveal
