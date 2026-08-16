'use client'

import { useEffect } from 'react'
import type { AxiomFile } from '@/lib/storage'

/* ── video player ─────────────────────────────────────────────────────────
 * Built on Media Chrome rather than the browser's default controls, and
 * rather than a pre-styled player.
 *
 * The default controls are a different shape in every browser and cannot be
 * themed at all. A batteries-included player brings its own visual language,
 * which then sits in the middle of ours looking borrowed. Media Chrome ships
 * only behaviour, buffering state, scrubbing, fullscreen, picture-in-picture,
 * keyboard, screen-reader labelling, time formatting. And leaves every pixel
 * to CSS, which is exactly the split we want.
 *
 * The elements are web components, so React 19 sets attributes on them
 * directly. That also sidesteps the React 18 peer requirement every wrapped
 * React player library still carries.
 * ──────────────────────────────────────────────────────────────────────── */

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'media-controller': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> &
        Record<string, unknown>
      'media-control-bar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> &
        Record<string, unknown>
      'media-play-button': Record<string, unknown>
      'media-seek-backward-button': Record<string, unknown>
      'media-seek-forward-button': Record<string, unknown>
      'media-time-range': Record<string, unknown>
      'media-time-display': Record<string, unknown>
      'media-duration-display': Record<string, unknown>
      'media-mute-button': Record<string, unknown>
      'media-volume-range': Record<string, unknown>
      'media-playback-rate-button': Record<string, unknown>
      'media-pip-button': Record<string, unknown>
      'media-fullscreen-button': Record<string, unknown>
      'media-loading-indicator': Record<string, unknown>
      'media-poster-image': Record<string, unknown>
    }
  }
}

export function VideoPlayer({
  file,
  src,
  onError,
}: {
  file: AxiomFile
  src: string
  onError?: (message: string) => void
}) {
  // Loaded on demand: the custom elements are only needed once a video is
  // actually opened, and registering them is a side effect of the import.
  useEffect(() => {
    void import('media-chrome')
  }, [])

  return (
    <media-controller
      class="axiom-player"
      style={{
        // Tokens Media Chrome reads for its own internals, mapped onto ours so
        // the player cannot drift from the rest of the interface.
        '--media-primary-color': '#ffffff',
        '--media-secondary-color': 'rgba(255,255,255,0.16)',
        '--media-accent-color': 'var(--color-signal)',
        '--media-text-color': '#ffffff',
        '--media-control-background': 'transparent',
        '--media-control-hover-background': 'rgba(255,255,255,0.14)',
        '--media-range-track-height': '5px',
        '--media-range-thumb-height': '15px',
        '--media-range-thumb-width': '15px',
        '--media-range-thumb-border-radius': '9999px',
        '--media-range-track-border-radius': '9999px',
        '--media-range-bar-color': 'var(--color-signal)',
        '--media-range-track-background': 'rgba(255,255,255,0.24)',
        '--media-preview-time-text-shadow': 'none',
        '--media-loading-indicator-icon-height': '56px',
        '--media-tooltip-display': 'none',
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        aspectRatio: 'auto',
      } as React.CSSProperties}
    >
      <video
        slot="media"
        src={src}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onError={() =>
          onError?.(
            `This browser can't play ${file.mime || 'this format'}. The file itself is fine, so downloading it and opening it in any player will work.`,
          )
        }
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />

      <media-loading-indicator slot="centered-chrome" noautohide="true" />

      <media-control-bar class="axiom-bar">
        <media-play-button />
        <media-seek-backward-button seekoffset="10" />
        <media-seek-forward-button seekoffset="10" />
        <media-time-display showduration="true" />
        <media-time-range />
        <media-mute-button />
        <media-volume-range />
        <media-playback-rate-button rates="0.5 1 1.25 1.5 2" />
        <media-pip-button />
        <media-fullscreen-button />
      </media-control-bar>
    </media-controller>
  )
}

export default VideoPlayer
