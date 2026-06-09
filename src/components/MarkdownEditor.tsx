'use client'

/**
 * Wiki 本文用 Markdown エディタ (Issue #78)。
 * textarea ＋ ライブプレビュー（編集 / プレビュー トグル）。
 * 値は name 付き textarea でそのまま form 送信される。
 */
import { useState } from 'react'
import MarkdownView from './MarkdownView'

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
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  return (
    <div className="border border-zinc-300 rounded-md overflow-hidden">
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`px-3 py-1 text-xs font-medium rounded ${tab === 'edit' ? 'bg-white border border-zinc-300 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-3 py-1 text-xs font-medium rounded ${tab === 'preview' ? 'bg-white border border-zinc-300 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          プレビュー
        </button>
        <span className="ml-auto text-[11px] text-zinc-400">Markdown 記法・内部リンクは [[ページタイトル]]</span>
      </div>

      {tab === 'edit' ? (
        <textarea
          name={name}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={rows}
          className="w-full px-3 py-2 text-sm font-mono focus:outline-none resize-y"
          placeholder="# 見出し&#10;&#10;本文を Markdown で記述..."
        />
      ) : (
        <>
          {/* プレビュー中も値を保持するため hidden で送信値を維持 */}
          <input type="hidden" name={name} value={body} />
          <div className="px-3 py-2 min-h-[8rem]">
            {body.trim() ? <MarkdownView body={body} /> : <p className="text-sm text-zinc-400">プレビューする内容がありません</p>}
          </div>
        </>
      )}
    </div>
  )
}
