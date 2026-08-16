export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'doc' | 'code' | 'other'

/** Binary units, because that is what Telegram's own limits are quoted in. */
export function bytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ', '
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export function rate(bytesPerSecond: number): string {
  return `${bytes(bytesPerSecond)}/s`
}

/** Coarse buckets. A countdown that reads "1m 4s" is precise noise. */
export function eta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ', '
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}

/** Relative for the recent past, absolute once "3 weeks ago" stops helping. */
export function when(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

const ARCHIVE = /\.(zip|rar|7z|tar|gz|bz2|xz)$/i
/* Source and config files get their own kind so the library can collect them
   and the tile can show a code mark rather than a blank page. */
const CODE =
  /\.(js|mjs|cjs|jsx|ts|mts|cts|tsx|py|pyw|rb|go|rs|php|java|kt|swift|dart|scala|c|h|cpp|cc|cxx|hpp|cs|sh|bash|zsh|ps1|lua|pl|r|ex|exs|clj|sql|html|htm|css|scss|less|vue|svelte|json|jsonc|xml|yml|yaml|toml|ini|cfg|conf|env|gradle|dockerfile|makefile)$/i

export function kindOf(mime: string, name: string): FileKind {
  if (ARCHIVE.test(name)) return 'archive'
  // Checked before the MIME branches: servers label .ts as video/mp2t and .json
  // as application/json, both of which would send source files elsewhere.
  if (CODE.test(name) || /^(dockerfile|makefile|\.gitignore|\.env)$/i.test(name)) return 'code'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  if (
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('presentation')
  )
    return 'doc'
  return 'other'
}

/** Uppercase stub for the tile badge: "PDF", "MP4", "XLSX". */
export function ext(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name)
  return m ? m[1].toUpperCase() : 'FILE'
}
