'use client'

/**
 * Wiki 本文用 Markdown エディタ (Issue #78 / REQ-0045)。
 *
 * - md 以上: 左に編集・右にライブプレビューの2ペイン（リアルタイム反映）
 * - sm 以下: 「編集 / プレビュー」タブ切替（画面幅が狭いため）
 * - Markdown 記法を覚えていなくても使えるよう、挿入ツールバーつき
 *   （見出し/太字/斜体/取り消し線/リスト/チェック/引用/コード/リンク/表/内部リンク）
 *
 * textarea は常に1つだけ DOM に存在し（name 重複を避ける）、モバイルの
 * プレビュー時は CSS で隠す（hidden でも値は送信される）。
 */
import { useRef, useState, type ReactNode } from 'react'
import {
  Heading2, Bold, Italic, Strikethrough, List, ListOrdered, ListChecks,
  Quote, Code, Link2, Table, FileSymlink, Minus,
} from 'lucide-react'
import MarkdownView from './MarkdownView'

/** ツールバー定義（純データ。動作は runTool でディスパッチ） */
const TOOL_DEFS: { id: string; icon: ReactNode; title: string }[] = [
  { id: 'h2',     icon: <Heading2 className="w-4 h-4" />,      title: '見出し' },
  { id: 'bold',   icon: <Bold className="w-4 h-4" />,          title: '太字' },
  { id: 'italic', icon: <Italic className="w-4 h-4" />,        title: '斜体' },
  { id: 'strike', icon: <Strikethrough className="w-4 h-4" />, title: '取り消し線' },
  { id: 'ul',     icon: <List className="w-4 h-4" />,          title: '箇条書き' },
  { id: 'ol',     icon: <ListOrdered className="w-4 h-4" />,   title: '番号付きリスト' },
  { id: 'check',  icon: <ListChecks className="w-4 h-4" />,    title: 'チェックリスト' },
  { id: 'quote',  icon: <Quote className="w-4 h-4" />,         title: '引用' },
  { id: 'code',   icon: <Code className="w-4 h-4" />,          title: 'コード' },
  { id: 'link',   icon: <Link2 className="w-4 h-4" />,         title: 'リンク' },
  { id: 'wiki',   icon: <FileSymlink className="w-4 h-4" />,   title: '内部リンク（Wikiページ）' },
  { id: 'table',  icon: <Table className="w-4 h-4" />,         title: '表' },
  { id: 'hr',     icon: <Minus className="w-4 h-4" />,         title: '区切り線' },
]

export default function MarkdownEditor({
  name,
  defaultValue = '',
  rows = 16,
}: {
  name: string
  defaultValue?: string
  rows?: number
}) {
  const [body, setBody] = useState(defaultValue)
  // モバイル用タブ（md 未満でのみ機能。md 以上は常に2ペイン表示）
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const taRef = useRef<HTMLTextAreaElement>(null)

  /** 選択範囲を before/after で囲む（未選択なら placeholder を挿入して選択状態に） */
  function wrapSelection(before: string, after = '', placeholder = 'テキスト') {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = body.slice(start, end) || placeholder
    const next = body.slice(0, start) + before + sel + after + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }

  /** 選択中の各行（未選択ならカーソル行）の先頭に prefix を付ける */
  function prefixLines(prefix: string | ((i: number) => string)) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const lineStart = body.lastIndexOf('\n', start - 1) + 1
    const lineEndIdx = body.indexOf('\n', end)
    const lineEnd = lineEndIdx === -1 ? body.length : lineEndIdx
    const block = body.slice(lineStart, lineEnd)
    const prefixed = block.split('\n').map((l, i) => `${typeof prefix === 'function' ? prefix(i) : prefix}${l}`).join('\n')
    const next = body.slice(0, lineStart) + prefixed + body.slice(lineEnd)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(lineStart, lineStart + prefixed.length)
    })
  }

  /** カーソル位置にブロックを挿入（前後に空行を確保） */
  function insertBlock(block: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const needsNL = start > 0 && body[start - 1] !== '\n'
    const text = `${needsNL ? '\n' : ''}${block}\n`
    const next = body.slice(0, start) + text + body.slice(ta.selectionEnd)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + text.length, start + text.length)
    })
  }

  /** ツールバーのディスパッチャ（クリック時のみ実行＝レンダー中に ref へ触れない） */
  function runTool(id: string) {
    switch (id) {
      case 'h2':     prefixLines('## '); break
      case 'bold':   wrapSelection('**', '**'); break
      case 'italic': wrapSelection('*', '*'); break
      case 'strike': wrapSelection('~~', '~~'); break
      case 'ul':     prefixLines('- '); break
      case 'ol':     prefixLines((i) => `${i + 1}. `); break
      case 'check':  prefixLines('- [ ] '); break
      case 'quote':  prefixLines('> '); break
      case 'code':   wrapSelection('\n```\n', '\n```\n', 'コード'); break
      case 'link':   wrapSelection('[', '](https://)', 'リンク文字'); break
      case 'wiki':   wrapSelection('[[', ']]', 'ページタイトル'); break
      case 'table':  insertBlock('| 見出し1 | 見出し2 |\n|---|---|\n| 値1 | 値2 |'); break
      case 'hr':     insertBlock('---'); break
    }
  }

  return (
    <div className="border border-zinc-300 rounded-md overflow-hidden">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        {/* モバイルのみタブを表示 */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('edit')}
            className={`px-3 py-1 text-xs font-medium rounded ${mobileTab === 'edit' ? 'bg-white border border-zinc-300 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`px-3 py-1 text-xs font-medium rounded ${mobileTab === 'preview' ? 'bg-white border border-zinc-300 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            プレビュー
          </button>
          <span className="mx-1 h-4 border-l border-zinc-200" />
        </div>

        {/* Markdown 挿入ツール（記法を覚えていなくても使える） */}
        <div className="flex flex-wrap items-center gap-0.5">
          {TOOL_DEFS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.title}
              aria-label={t.title}
              onClick={() => runTool(t.id)}
              className="grid h-7 w-7 place-items-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 transition-colors"
            >
              {t.icon}
            </button>
          ))}
        </div>

        <span className="ml-auto hidden lg:inline text-[11px] text-zinc-400">Markdown 記法・内部リンクは [[ページタイトル]]</span>
      </div>

      <div className="md:grid md:grid-cols-2 md:divide-x md:divide-zinc-200">
        {/* 編集ペイン（モバイルでプレビュー中は CSS で非表示だが値は送信される） */}
        <div className={mobileTab === 'preview' ? 'hidden md:block' : 'block'}>
          <textarea
            ref={taRef}
            name={name}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={rows}
            className="w-full h-full px-3 py-2 text-sm font-mono focus:outline-none resize-y min-h-64"
            placeholder="# 見出し&#10;&#10;本文を Markdown で記述..."
          />
        </div>

        {/* プレビューペイン（モバイルで編集中は非表示） */}
        <div className={`min-h-64 overflow-auto px-4 py-3 ${mobileTab === 'edit' ? 'hidden md:block' : 'block'}`}>
          {body.trim() ? <MarkdownView body={body} /> : <p className="text-sm text-zinc-400">プレビューする内容がありません</p>}
        </div>
      </div>
    </div>
  )
}
