import { cn } from '@/lib/utils'

/* ── the mark ─────────────────────────────────────────────────────────────
 * Served as a 128px WebP (4.5 KB), not the 512px PNG (96 KB) used for the
 * favicon and share card. The header renders it at 40-48px, so the large file
 * was ~20x more bytes than any display could use — and while it was in flight
 * the browser showed an empty box where the logo should be.
 *
 * width/height are explicit for the same reason they are on every other image
 * here: without them the element has no intrinsic size, so it collapses to
 * nothing until the bytes arrive and then shoves the layout sideways.
 * ──────────────────────────────────────────────────────────────────────── */
export function Mark({
  className,
  priority = false,
}: {
  className?: string
  /** Set on the header lockup, which is above the fold on every page. */
  priority?: boolean
}) {
  return (
    <img
      src="/logo.webp"
      alt=""
      width={128}
      height={128}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('object-contain', className)}
      draggable={false}
    />
  )
}

/**
 * Mark plus wordmark. The lockup, used wherever the product needs to say who
 * it is — header, footer, and the moment in the scroll sequence where the
 * alternative to "every other cloud" turns out to be us.
 */
export function Wordmark({
  className,
  size = 'md',
  priority = false,
}: {
  className?: string
  size?: 'md' | 'lg' | 'xl'
  priority?: boolean
}) {
  const scale = {
    md: { mark: 'size-11', text: 'text-[1.5rem]' },
    lg: { mark: 'size-14', text: 'text-[2rem]' },
    // Display size: this is a statement, not a label.
    xl: { mark: 'size-16 sm:size-20', text: 'text-[clamp(2.5rem,6vw,4rem)]' },
  }[size]

  return (
    <span className={cn('flex items-center gap-3', className)}>
      <Mark className={scale.mark} priority={priority} />
      <span className={cn(scale.text, 'font-semibold leading-none tracking-[-0.035em]')}>
        Axiom
      </span>
    </span>
  )
}

export default Mark
