'use client'

/**
 * 会話形式の AI 検索（REQ-0059 / REQ-0060）。QuickLauncher の検索から使う。
 *
 * ブック選択は不要: 発話から対象ブック（商談/ToDo/取引先…）も AI が推論する。
 * 左=会話、右=対象ブック＋条件チップ＋結果プレビュー（件数＋先頭8件）の2ペイン。
 * 「やっぱり ToDo で」のような会話での切り替え、右上のセレクトでの手動切替も可能。
 * 適用は従来どおり一覧ページのフィルタ（?f=）に流す draft-then-apply。
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Eye, X, Sparkles } from 'lucide-react'
import {
  aiSearchTurnAuto, previewAiSearch,
  type SearchCondition, type AiSearchTurnInput, type AiSearchPreview,
} from '@/app/actions/aiSearch'

const OP_LABEL: Record<string, string> = {
  contains: 'を含む', not_contains: 'を含まない', starts_with: 'で始まる',
  eq: '＝', neq: '≠', gte: '≧', lte: '≦',
}

export type AiSearchBook = { apiName: string; label: string; listHref: string }

type Props = {
  /** AI 検索対応かつ現在のユーザーがアクセスできるブック候補（QuickLauncher の nav データ由来） */
  books: AiSearchBook[]
  /** 一覧へ遷移（QuickLauncher の go を渡す: モーダルを閉じて router.push） */
  onNavigate: (href: string) => void
}

export default function AiSearchChat({ books, onNavigate }: Props) {
  const [turns, setTurns] = useState<AiSearchTurnInput[]>([])
  const [book, setBook] = useState<string | null>(null)
  const [conditions, setConditions] = useState<SearchCondition[]>([])
  const [preview, setPreview] = useState<AiSearchPreview | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const bookOf = (api: string | null) => books.find((b) => b.apiName === api) ?? null

  // 新しい発言で会話ログを最下部へ
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  const refreshPreview = async (api: string | null, conds: SearchCondition[]) => {
    if (!api) { setPreview(null); return }
    try {
      setPreview(await previewAiSearch(api, conds))
    } catch {
      setPreview(null)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const nextTurns: AiSearchTurnInput[] = [...turns, { role: 'user', text }]
    setTurns(nextTurns)
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const res = await aiSearchTurnAuto(nextTurns, conditions, book)
      setTurns([...nextTurns, { role: 'assistant', text: res.reply }])
      setBook(res.book)
      setConditions(res.conditions)
      await refreshPreview(res.book, res.conditions)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setTurns(nextTurns)  // エラー時は発話だけ残す（再送可能）
    } finally {
      setBusy(false)
    }
  }

  /** 右上のセレクトで対象ブックを手動切替（条件はブック固有のためリセット） */
  const switchBook = async (api: string) => {
    const next = api || null
    setBook(next)
    setConditions([])
    const label = bookOf(next)?.label
    if (label) setTurns((prev) => [...prev, { role: 'assistant', text: `対象を「${label}」にしました。条件をどうぞ。` }])
    await refreshPreview(next, [])
  }

  /** 条件チップを × で外す（AI を介さずローカル更新。履歴にも残して次ターンの文脈にする） */
  const removeCondition = async (idx: number) => {
    const removed = conditions[idx]
    const next = conditions.filter((_, i) => i !== idx)
    setConditions(next)
    setTurns((prev) => [...prev, { role: 'assistant', text: `条件「${removed.label} ${OP_LABEL[removed.op] ?? removed.op} ${removed.valueLabel ?? removed.value}」を外しました。` }])
    await refreshPreview(book, next)
  }

  const apply = () => {
    const target = bookOf(book)
    if (!target) return
    const params = new URLSearchParams()
    for (const c of conditions) params.append('f', `${c.field}|${c.op}|${c.value}`)
    const qs = params.toString()
    onNavigate(qs ? `${target.listHref}?${qs}` : target.listHref)
  }

  return (
    <div className="flex flex-col md:grid md:grid-cols-2 md:h-[62vh] border border-zinc-200 rounded-xl overflow-hidden">
      {/* ── 左: 会話 ─────────────────────────────── */}
      <div className="flex flex-col h-72 md:h-auto border-b md:border-b-0 md:border-r border-zinc-200">
        <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-zinc-50">
          {/* 初回ガイド */}
          {turns.length === 0 && (
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-1 shrink-0 text-violet-500" aria-hidden />
              <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                探したいものをそのまま話しかけてください。対象（商談・ToDo・取引先 など）も発話から判断します。
                <span className="block text-xs text-zinc-400 mt-1">例: 「交渉中で100万以上の商談」「今週期限の未完了ToDo」 → 「そのうち〜だけ」「やっぱり〜は外して」</span>
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                t.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-700'
              }`}>
                {t.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-400 inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> 条件を組み立て中…
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 px-1">{error}</p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-zinc-200 bg-white p-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
            placeholder={turns.length === 0 ? '例: 交渉中で100万以上の商談' : '条件を追加・変更…（例: そのうち今月分だけ）'}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            aria-label="AI検索の発話入力"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-50"
            aria-label="送信"
          >
            <Send className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* ── 右: 対象ブック・条件・結果プレビュー ───────────── */}
      <div className="flex flex-col h-80 md:h-auto">
        <div className="border-b border-zinc-100 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-zinc-500">対象</p>
            <select
              value={book ?? ''}
              onChange={(e) => switchBook(e.target.value)}
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 bg-white"
              aria-label="検索対象のブック"
            >
              <option value="">AI が判断（未確定）</option>
              {books.map((b) => <option key={b.apiName} value={b.apiName}>{b.label}</option>)}
            </select>
          </div>
          <p className="text-xs font-semibold text-zinc-500">適用中の条件</p>
          {conditions.length === 0 ? (
            <p className="text-xs text-zinc-400">まだありません（左の会話で指定してください）</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {conditions.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs text-violet-800">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-violet-400">{OP_LABEL[c.op] ?? c.op}</span>
                  <span className={c.valueLabel ? '' : 'font-mono'}>{c.valueLabel ?? c.value}</span>
                  <button onClick={() => removeCondition(i)} aria-label={`条件 ${c.label} を外す`} className="text-violet-300 hover:text-violet-700">
                    <X className="w-3 h-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {preview && book ? (
            <>
              <p className="text-xs text-zinc-500 mb-2">
                {bookOf(book)?.label} — 該当 <b className="text-zinc-800">{preview.total}</b> 件
                {preview.total > preview.rows.length ? `（先頭 ${preview.rows.length} 件を表示）` : ''}
              </p>
              {preview.rows.length === 0 ? (
                <p className="text-sm text-zinc-400">条件に一致するレコードがありません。</p>
              ) : (
                <ul className="space-y-1">
                  {preview.rows.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => onNavigate(r.href)}
                        className="w-full text-left rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:border-zinc-300 hover:bg-zinc-50"
                      >
                        <span className="block text-sm text-zinc-900 truncate">{r.title}</span>
                        {r.sub && <span className="block text-[11px] text-zinc-400 truncate">{r.sub}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-300 mt-6 text-center">結果はここに表示されます</p>
          )}
        </div>

        <div className="border-t border-zinc-100 p-3">
          <button
            onClick={apply}
            disabled={!book}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Eye className="w-4 h-4" aria-hidden />
            {book ? `${bookOf(book)?.label ?? ''}の一覧を開く` : 'この条件で一覧を開く'}
          </button>
        </div>
      </div>
    </div>
  )
}
