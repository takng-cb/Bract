'use client'

/**
 * Wiki 本文用 Markdown エディタ (Issue #78)。
 *
 * - md 以上: 左に編集・右にライブプレビューの2ペイン（リアルタイム反映）
 * - sm 以下: 「編集 / プレビュー」タブ切替（画面幅が狭いため）
 *
 * textarea は常に1つだけ DOM に存在し（name 重複を避ける）、モバイルの
 * プレビュー時は CSS で隠す（hidden でも値は送信される）。
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
  // モバイル用タブ（md 未満でのみ機能。md 以上は常に2ペイン表示）
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  return (
    <div className="border border-zinc-300 rounded-md overflow-hidden">
      {/* ツールバー */}
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
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
        </div>
        {/* デスクトップ用ラベル */}
        <span className="hidden md:flex items-center text-[11px] font-medium text-zinc-500">
          <span className="px-2">編集</span>
          <span className="px-2 border-l border-zinc-200">プレビュー（リアルタイム）</span>
        </span>
        <span className="ml-auto text-[11px] text-zinc-400">Markdown 記法・内部リンクは [[ページタイトル]]</span>
      </div>

      <div className="md:grid md:grid-cols-2 md:divide-x md:divide-zinc-200">
        {/* 編集ペイン（モバイルでプレビュー中は CSS で非表示だが値は送信される） */}
        <div className={mobileTab === 'preview' ? 'hidden md:block' : 'block'}>
          <textarea
            name={name}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={rows}
            className="w-full h-full px-3 py-2 text-sm font-mono focus:outline-none resize-y min-h-64"
            placeholder="# 見出し&#10;&#10;本文を Markdown で記述..."
          />
        </div>

        {/* プレビューペイン（モバイルで編集中は非表示） */}
        <div className={`min-h-64 overflow-auto px-3 py-2 ${mobileTab === 'edit' ? 'hidden md:block' : 'block'}`}>
          {body.trim() ? <MarkdownView body={body} /> : <p className="text-sm text-zinc-400">プレビューする内容がありません</p>}
        </div>
      </div>
    </div>
  )
}
