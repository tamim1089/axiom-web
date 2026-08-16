import type { LanguageSupport, StreamParser } from '@codemirror/language'

/* ── language detection ───────────────────────────────────────────────────
 * Which highlighter to load for a given filename.
 *
 * Every grammar is a dynamic import, so opening a Python file never downloads
 * the C++ grammar. A file manager has to be ready for any extension, but a
 * given person opens one or two kinds, and shipping twenty parsers to everyone
 * to cover that is how a viewer ends up slower than the editor it replaces.
 * ──────────────────────────────────────────────────────────────────────── */

type Loader = () => Promise<LanguageSupport | StreamParser<unknown> | null>

const js = () => import('@codemirror/lang-javascript')

/** Extension to loader. Grouped by family so related types stay together. */
const BY_EXTENSION: Record<string, Loader> = {
  // JavaScript and TypeScript, including the JSX variants.
  js: async () => (await js()).javascript(),
  mjs: async () => (await js()).javascript(),
  cjs: async () => (await js()).javascript(),
  jsx: async () => (await js()).javascript({ jsx: true }),
  ts: async () => (await js()).javascript({ typescript: true }),
  mts: async () => (await js()).javascript({ typescript: true }),
  cts: async () => (await js()).javascript({ typescript: true }),
  tsx: async () => (await js()).javascript({ jsx: true, typescript: true }),

  json: async () => (await import('@codemirror/lang-json')).json(),
  jsonc: async () => (await import('@codemirror/lang-json')).json(),

  py: async () => (await import('@codemirror/lang-python')).python(),
  pyw: async () => (await import('@codemirror/lang-python')).python(),

  html: async () => (await import('@codemirror/lang-html')).html(),
  htm: async () => (await import('@codemirror/lang-html')).html(),
  svelte: async () => (await import('@codemirror/lang-html')).html(),
  vue: async () => (await import('@codemirror/lang-html')).html(),

  css: async () => (await import('@codemirror/lang-css')).css(),
  scss: async () => (await import('@codemirror/lang-css')).css(),
  less: async () => (await import('@codemirror/lang-css')).css(),

  md: async () => (await import('@codemirror/lang-markdown')).markdown(),
  markdown: async () => (await import('@codemirror/lang-markdown')).markdown(),
  mdx: async () => (await import('@codemirror/lang-markdown')).markdown(),

  sql: async () => (await import('@codemirror/lang-sql')).sql(),
  rs: async () => (await import('@codemirror/lang-rust')).rust(),
  go: async () => (await import('@codemirror/lang-go')).go(),
  php: async () => (await import('@codemirror/lang-php')).php(),

  java: async () => (await import('@codemirror/lang-java')).java(),
  kt: async () => (await import('@codemirror/lang-java')).java(),

  // The C family shares one grammar; close enough for reading.
  c: async () => (await import('@codemirror/lang-cpp')).cpp(),
  h: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cpp: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cc: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cxx: async () => (await import('@codemirror/lang-cpp')).cpp(),
  hpp: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cs: async () => (await import('@codemirror/lang-cpp')).cpp(),

  xml: async () => (await import('@codemirror/lang-xml')).xml(),
  svg: async () => (await import('@codemirror/lang-xml')).xml(),
  plist: async () => (await import('@codemirror/lang-xml')).xml(),

  yml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  yaml: async () => (await import('@codemirror/lang-yaml')).yaml(),
}

/** Files whose whole name identifies them, extension or not. */
const BY_FILENAME: Record<string, Loader> = {
  dockerfile: async () => null,
  makefile: async () => null,
  '.gitignore': async () => null,
  '.env': async () => null,
  'package.json': BY_EXTENSION.json,
  'tsconfig.json': BY_EXTENSION.json,
}

/** Extensions we will open as text even though they have no grammar. */
const PLAIN_TEXT = new Set([
  'txt', 'log', 'ini', 'cfg', 'conf', 'toml', 'env', 'properties',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'rb', 'pl', 'lua', 'r', 'swift', 'dart', 'scala', 'clj', 'ex', 'exs',
  'gitignore', 'gitattributes', 'editorconfig', 'lock', 'csv', 'tsv', 'srt', 'vtt',
])

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** True when this file should open in the code viewer rather than download. */
export function isTextFile(name: string, mime: string): boolean {
  const ext = extensionOf(name)
  const lower = name.toLowerCase()
  if (lower in BY_FILENAME) return true
  if (ext in BY_EXTENSION || PLAIN_TEXT.has(ext)) return true
  // Trust an explicit text MIME even for an extension we do not know.
  return mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml'
}

/** A human label for the status bar. */
export function languageLabel(name: string): string {
  const ext = extensionOf(name)
  const LABELS: Record<string, string> = {
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript (JSX)',
    ts: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript', tsx: 'TypeScript (TSX)',
    py: 'Python', pyw: 'Python', rs: 'Rust', go: 'Go', php: 'PHP', java: 'Java',
    kt: 'Kotlin', cs: 'C#', c: 'C', h: 'C header', cpp: 'C++', cc: 'C++', cxx: 'C++',
    hpp: 'C++ header', rb: 'Ruby', swift: 'Swift', dart: 'Dart', lua: 'Lua',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell',
    html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less',
    json: 'JSON', xml: 'XML', svg: 'SVG', yml: 'YAML', yaml: 'YAML',
    md: 'Markdown', markdown: 'Markdown', sql: 'SQL', toml: 'TOML',
    csv: 'CSV', log: 'Log', txt: 'Plain text',
  }
  return LABELS[ext] ?? (ext ? ext.toUpperCase() : 'Plain text')
}

/** Load the grammar for a file, or null when it has none. */
export async function loadLanguage(name: string) {
  const lower = name.toLowerCase()
  const loader = BY_FILENAME[lower] ?? BY_EXTENSION[extensionOf(name)]
  if (!loader) return null
  try {
    return await loader()
  } catch {
    // A grammar that fails to load is not worth failing the whole view for;
    // the file still opens, just without colour.
    return null
  }
}
