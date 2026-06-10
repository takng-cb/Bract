'use client'

/**
 * アクティビティ・タイムライン上部のインライン・クイック登録（#design）。
 * 「活動・メモを記録…」を押すと画面遷移せず、その場で活動／ToDo／経費を登録できる。
 * 保存後は revalidate で当ページのストリームが更新され、フォームは閉じる。
 */
import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Phone, SquareCheckBig, Receipt, X } from 'lucide-react'

type Mode = 'collapsed' | 'activity' | 'todo' | 'expense'

const CATEGORIES = ['交通費', '接待費', '通信費', '消耗品費', '広告費', '外注費', 'その他']
const INPUT = 'w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none'

export default function InlineComposer({
  relatedToken,
  revalidate,
  activityTypes,
  createActivity,
  createTask,
  createExpense,
}: {
  relatedToken: string
  revalidate: string
  activityTypes: { value: string; label: string }[]
  /** @deprecated アバター廃止につき未使用（呼び出し側互換のため optional で残置） */
  userInitial?: string
  createActivity: (fd: FormData) => Promise<void>
  createTask: (fd: FormData) => Promise<void>
  createExpense: (fd: FormData) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>('collapsed')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('related_records', relatedToken)
    fd.set('revalidate', revalidate)
    const action = mode === 'todo' ? createTask : mode === 'expense' ? createExpense : createActivity
    setError(null)
    start(async () => {
      try {
        await action(fd)
        form.reset()
        setMode('collapsed')
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存に失敗しました')
      }
    })
  }

  if (mode === 'collapsed') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50">
        <button type="button" onClick={() => setMode('activity')} className="flex-1 h-9 border border-zinc-300 rounded-md bg-white flex items-center px-3 text-sm text-zinc-400 hover:border-zinc-400 transition-colors min-w-0 text-left">活動・メモを記録…</button>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => setMode('activity')} title="活動" className="w-8 h-8 rounded-md border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-brand-50 hover:text-brand-700"><Phone className="w-4 h-4" /></button>
          <button type="button" onClick={() => setMode('todo')} title="ToDo" className="w-8 h-8 rounded-md border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-brand-50 hover:text-brand-700"><SquareCheckBig className="w-4 h-4" /></button>
          <button type="button" onClick={() => setMode('expense')} title="経費" className="w-8 h-8 rounded-md border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-brand-50 hover:text-brand-700"><Receipt className="w-4 h-4" /></button>
        </div>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
      {/* モード切替 */}
      <div className="flex items-center gap-1 mb-3">
        <ModeTab on={mode === 'activity'} onClick={() => setMode('activity')} icon={<Phone className="w-3.5 h-3.5" />}>活動</ModeTab>
        <ModeTab on={mode === 'todo'} onClick={() => setMode('todo')} icon={<SquareCheckBig className="w-3.5 h-3.5" />}>ToDo</ModeTab>
        <ModeTab on={mode === 'expense'} onClick={() => setMode('expense')} icon={<Receipt className="w-3.5 h-3.5" />}>経費</ModeTab>
        <button type="button" onClick={() => { setMode('collapsed'); setError(null) }} className="ml-auto text-zinc-400 hover:text-zinc-700" aria-label="閉じる"><X className="w-4 h-4" /></button>
      </div>

      {mode === 'activity' && (
        <div className="space-y-2">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <select name="type" defaultValue={activityTypes[0]?.value ?? 'note'} className={INPUT}>
              {activityTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input name="subject" required placeholder="件名" className={INPUT} autoFocus />
          </div>
          <textarea name="body" rows={2} placeholder="内容・メモ" className={INPUT} />
        </div>
      )}

      {mode === 'todo' && (
        <div className="space-y-2">
          <input name="title" required placeholder="タイトル" className={INPUT} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="block text-[11px] text-zinc-500 mb-1">期限</span><input type="date" name="due_date" className={INPUT} /></label>
            <label className="block"><span className="block text-[11px] text-zinc-500 mb-1">優先度</span>
              <select name="priority" defaultValue="medium" className={INPUT}>
                <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {mode === 'expense' && (
        <div className="space-y-2">
          <input name="title" required placeholder="件名" className={INPUT} autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" name="amount" required placeholder="金額" className={INPUT} />
            <select name="category" defaultValue="その他" className={INPUT}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" name="expense_date" className={INPUT} />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-3">
        <button type="submit" disabled={pending} className="px-3.5 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 disabled:opacity-50">{pending ? '保存中…' : '記録する'}</button>
        <button type="button" onClick={() => { setMode('collapsed'); setError(null) }} className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">取消</button>
      </div>
    </form>
  )
}

function ModeTab({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] font-semibold transition-colors ${on ? 'bg-brand-600 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
      {icon}{children}
    </button>
  )
}
