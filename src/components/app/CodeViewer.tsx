'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { Check, Copy, WrapText } from 'lucide-react'
import { languageLabel, loadLanguage } from '@/lib/code-languages'
import { cn } from '@/lib/utils'

/* ── code viewer ──────────────────────────────────────────────────────────
 * A real editor surface rather than a <pre> block: line numbers, code
 * folding, bracket matching, find-in-file, and selection that behaves the way
 * it does in an editor. Read-only by default, because opening a file from
 * storage should never risk changing it by accident.
 *
 * The theme is written against our own tokens instead of importing a stock
 * one. A borrowed VS Code theme drops a different grey, a different mono
 * stack and a different blue into the middle of the app, and the seam shows.
 * ──────────────────────────────────────────────────────────────────────── */

/** Syntax colours, derived from the product palette rather than a stock theme. */
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#9a3fd8' },
  { tag: [t.definitionKeyword, t.modifier], color: '#9a3fd8' },
  { tag: [t.string, t.special(t.string)], color: '#1a7f4b' },
  { tag: [t.number, t.bool, t.null], color: '#b3541e' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6b7280', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#0a6cff' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: '#0a0a0b' },
  { tag: [t.typeName, t.className, t.namespace], color: '#0b6f8f' },
  { tag: [t.propertyName, t.attributeName], color: '#3d4148' },
  { tag: [t.tagName], color: '#9a3fd8' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: '#6b7280' },
  { tag: [t.link, t.url], color: '#0a6cff', textDecoration: 'underline' },
  { tag: [t.heading], color: '#0a0a0b', fontWeight: '600' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: '600' },
  { tag: [t.invalid], color: '#c0392b' },
])

const theme = EditorView.theme({
  '&': {
    fontSize: '0.9375rem',
    backgroundColor: 'var(--color-paper)',
    color: 'var(--color-ink)',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, monospace",
    lineHeight: '1.7',
    padding: '1.25rem 0',
  },
  '.cm-content': { caretColor: 'var(--color-signal)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-paper)',
    color: 'var(--color-titanium)',
    border: 'none',
    paddingRight: '0.75rem',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-ink)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-signal) 5%, transparent)' },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--color-signal) 20%, transparent) !important',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in srgb, var(--color-signal) 14%, transparent)',
  },
  '.cm-foldGutter span': { color: 'var(--color-titanium)' },
  '&.cm-focused': { outline: 'none' },
}, { dark: false })

export function CodeViewer({ name, text }: { name: string; text: string }) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const [language, setLanguage] = useState<LanguageSupport | null>(null)

  const stats = useMemo(() => {
    const lines = text.split('\n')
    return {
      lines: lines.length,
      chars: text.length,
      // Warn rather than hang: CodeMirror handles long documents well, but a
      // minified bundle on one line will still fight the wrap toggle.
      longest: lines.reduce((m, l) => Math.max(m, l.length), 0),
    }
  }, [text])

  useEffect(() => {
    let live = true
    void loadLanguage(name).then((lang) => {
      if (!live || !lang) return
      setLanguage(
        lang instanceof LanguageSupport
          ? lang
          : new LanguageSupport(StreamLanguage.define(lang as never)),
      )
    })
    return () => {
      live = false
    }
  }, [name])

  useEffect(() => {
    if (!host.current) return

    const extensions: Extension[] = [
      lineNumbers(),
      foldGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      syntaxHighlighting(highlight),
      theme,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      // Read-only, but still selectable and searchable. A viewer that cannot
      // be selected is worse than a textarea.
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      ...(wrap ? [EditorView.lineWrapping] : []),
      ...(language ? [language] : []),
    ]

    const v = new EditorView({
      state: EditorState.create({ doc: text, extensions }),
      parent: host.current,
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
  }, [text, wrap, language])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* Clipboard can be blocked; the text is selectable either way. */
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="text-small font-medium text-graphite">{languageLabel(name)}</span>
        <span className="text-small tabular-nums text-titanium">
          {stats.lines.toLocaleString()} lines
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setWrap((w) => !w)}
            aria-pressed={wrap}
            className={cn(
              'tap gap-2 rounded-lg px-3 text-small transition-colors',
              wrap ? 'bg-signal-soft text-signal' : 'text-titanium hover:bg-mist hover:text-ink',
            )}
          >
            <WrapText className="size-4.5" strokeWidth={1.75} />
            Wrap
          </button>
          <button
            onClick={copy}
            className="tap gap-2 rounded-lg px-3 text-small text-titanium transition-colors hover:bg-mist hover:text-ink"
          >
            {copied ? (
              <Check className="size-4.5 text-signal" strokeWidth={2} />
            ) : (
              <Copy className="size-4.5" strokeWidth={1.75} />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div ref={host} className="min-h-0 flex-1 overflow-auto" />
    </div>
  )
}

export default CodeViewer
