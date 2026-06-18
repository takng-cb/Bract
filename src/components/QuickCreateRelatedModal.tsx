'use client'

/**
 * 関連先の「新規作成」モーダル（REQ-0085 / ADR-0030）。
 * 「新規作成」→ ブック選択（作成権限のある標準＋カスタム）→ フィールド入力 → 即時作成。
 * 作成結果（object_api 単数 / record_id / ラベル）を onCreated で親に返す。
 * AiRelatedField・RelatedRecordsPicker から共用。z-[60] で QuickLauncher(z-50) の上に出す。
 */
import { useEffect, useState } from 'react'
import { X, ChevronLeft, Loader2, Plus } from 'lucide-react'
import {
  listCreatableRelatedBooks, getQuickCreateFields, createRecordForRelated,
  type RelatedCreatableBook, type QuickAiField, type CreatedRelatedRef,
} from '@/app/actions/quickAi'
import QuickFieldInput from '@/components/QuickFieldInput'

const NAME_LIKE = ['name', 'full_name', 'title', 'subject']

/**
 * 親は open 時のみマウントする（`{open && <QuickCreateRelatedModal .../>}`）。
 * マウントごとに状態が初期化され、ブック一覧を読み込む。
 */
export default function QuickCreateRelatedModal({
  onClose, onCreated, initialName = '',
}: {
  onClose: () => void
  onCreated: (ref: CreatedRelatedRef) => void
  initialName?: string
}) {
  const [books, setBooks] = useState<RelatedCreatableBook[] | null>(null)
  const [book, setBook] = useState<RelatedCreatableBook | null>(null)
  const [fields, setFields] = useState<QuickAiField[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // マウント時にブック一覧をロード
  useEffect(() => {
    let alive = true
    ;(async () => {
      const r = await listCreatableRelatedBooks()
      if (!alive) return
      if (!r.ok) { setError(r.error); setBooks([]); return }
      setBooks(r.data)
    })()
    return () => { alive = false }
  }, [])

  const pickBook = async (b: RelatedCreatableBook) => {
    setBusy(true); setError(null)
    try {
      const r = await getQuickCreateFields(b.apiName)
      if (!r.ok) { setError(r.error); return }
      const fs = r.data
      // 代表フィールド（name/title 等、無ければ先頭）に検索語をプリフィル
      let idx = fs.findIndex((f) => NAME_LIKE.includes(f.apiName))
      if (idx < 0) idx = 0
      const prefilled = fs.map((f, i) => (i === idx && initialName ? { ...f, value: initialName } : f))
      setBook(b); setFields(prefilled)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const setField = (apiName: string, v: string) =>
    setFields((p) => (p ? p.map((f) => (f.apiName === apiName ? { ...f, value: v } : f)) : p))

  const submit = async () => {
    if (!book || !fields) return
    setBusy(true); setError(null)
    try {
      const values: Record<string, string> = {}
      for (const f of fields) values[f.apiName] = f.value
      const r = await createRecordForRelated(book.apiName, values)
      if (!r.ok) { setError(r.error); return }
      onCreated(r.data)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={(e) => { e.stopPropagation(); onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-4 py-3">
          {book ? (
            <button onClick={() => { setBook(null); setFields(null); setError(null) }} className="text-zinc-400 hover:text-zinc-700" aria-label="戻る"><ChevronLeft className="w-5 h-5" /></button>
          ) : <span className="w-5" />}
          <h2 className="flex-1 text-base font-bold text-zinc-900 truncate">
            {book ? `${book.label}を新規作成` : '新規作成するブックを選択'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700" aria-label="閉じる"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">{error}</div>
          )}

          {/* ステップ1: ブック選択 */}
          {!book && (
            books === null ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> 読み込み中…</p>
            ) : books.length === 0 ? (
              <p className="text-sm text-zinc-500">作成できるブックがありません。</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {books.map((b) => (
                  <button key={b.apiName} onClick={() => pickBook(b)} disabled={busy}
                    className="flex min-h-14 flex-col items-start justify-center gap-1 rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50">
                    <span className="text-sm font-semibold text-zinc-900">{b.label}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {/* ステップ2: フィールド入力 */}
          {book && fields && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2.5">
                {fields.map((f) => (
                  <QuickFieldInput key={f.apiName} field={f} onChange={(v) => setField(f.apiName, v)} />
                ))}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={submit} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {busy ? '作成中…' : 'この内容で作成して紐づける'}
                </button>
                <button onClick={() => { setBook(null); setFields(null); setError(null) }} disabled={busy} className="text-sm text-zinc-500 hover:text-zinc-800">ブック選択に戻る</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
