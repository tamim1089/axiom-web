import { useEffect, useState } from 'react'
import { useLibrary } from '@/store/library'
import { useTransfers } from '@/store/transfers'
import { kindOf } from '@/lib/format'
import type { AxiomFile } from '@/lib/storage'
import { Workspace } from './Workspace'

/* ── design harness ───────────────────────────────────────────────────────
 * Reachable only at #demo in a dev build (`import.meta.env.DEV` gates the
 * import, so none of this reaches production). It exists because the
 * workspace is otherwise unreachable without a phone in hand, which makes
 * iterating on layout, density, and empty states needlessly slow.
 *
 * The files are fabricated but the shapes are real AxiomFile records, so the
 * grid, sorting, search, and selection all run their actual code paths.
 * ──────────────────────────────────────────────────────────────────────── */

const SEED: [string, string, number][] = [
  ['Reykjavik 2026.jpg', 'image/jpeg', 4_812_000],
  ['Lease agreement.pdf', 'application/pdf', 2_140_000],
  ['Q3 budget.xlsx', 'application/vnd.ms-excel', 86_000],
  ['Iceland roadtrip.mp4', 'video/mp4', 1_842_000_000],
  ['Thesis draft.docx', 'application/msword', 46_000],
  ['Passport scan.pdf', 'application/pdf', 310_000],
  ['site-backup.zip', 'application/zip', 640_000_000],
  ['Voice memo.m4a', 'audio/mp4', 3_200_000],
  ['Kitchen renovation.png', 'image/png', 8_900_000],
  ['Tax return 2025.pdf', 'application/pdf', 1_020_000],
  ['Interview recording.mp3', 'audio/mpeg', 62_000_000],
  ['Sunset over Vik.jpg', 'image/jpeg', 6_300_000],
  ['notes.md', 'text/markdown', 8_400],
  ['Wedding toast.mov', 'video/quicktime', 512_000_000],
  ['archive-2024.7z', 'application/x-7z-compressed', 2_100_000_000],
  ['Insurance policy.pdf', 'application/pdf', 890_000],
]

function makeFiles(count: number): AxiomFile[] {
  return Array.from({ length: count }, (_, i) => {
    const [baseName, mime, rawSize] = SEED[i % SEED.length]
    const round = Math.floor(i / SEED.length)
    const name = round === 0 ? baseName : baseName.replace(/(\.[^.]+)$/, ` ${round + 1}$1`)
    // Every fourth file is split, so the harness exercises the multipart path
    // — including the incomplete state, which is otherwise hard to reach.
    const size = Math.round(rawSize * (0.6 + ((i * 37) % 80) / 100))
    const split = i % 9 === 4
    const partCount = split ? 3 : 1
    const partSize = Math.ceil(size / partCount)
    return {
      id: `demo-${i}`,
      name,
      mime,
      // Deterministic sizes and dates — a harness that reshuffles on every
      // reload makes it impossible to tell a layout change from noise.
      size,
      date: new Date(Date.now() - i * 5.5 * 3_600_000),
      kind: kindOf(mime, name),
      parts: Array.from({ length: partCount }, (_, k) => ({
        index: k,
        offset: k * partSize,
        size: Math.min(partSize, size - k * partSize),
        messageId: 10_000 - i * 4 - k,
        media: undefined,
      })),
      complete: true,
    }
  })
}

export default function DemoWorkspace() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Replace load() so the real history scan never runs in the harness.
    useLibrary.setState({
      files: makeFiles(240),
      loading: false,
      error: undefined,
      load: async () => {},
    })
    // Exposed so the screenshot driver can put the transfer dock into states
    // that would otherwise need a real upload to reach.
    ;(window as unknown as { __axiom: unknown }).__axiom = { useLibrary, useTransfers }
    setReady(true)
  }, [])

  if (!ready) return <div className="min-h-screen bg-paper" />

  return (
    <Workspace
      user={{ displayName: 'Design Harness', username: 'demo', id: 0 }}
      onSignOut={() => {
        window.location.hash = ''
        window.location.reload()
      }}
    />
  )
}
