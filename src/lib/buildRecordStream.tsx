/**
 * レコード詳細「アクティビティ」タブのストリーム（活動 / ToDo / 経費 / 変更履歴）を
 * 組み立てる共通ヘルパ。各詳細ページに約36行ずつコピペされていたものを集約（#design）。
 *
 * サーバーコンポーネントから呼ぶ。toggleTask は各ページの 'use server' 関数
 * （revalidate パスがページ毎に異なるため呼び出し側が持つ）。
 */
import Link from 'next/link'
import { Check } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { Badge, type BadgeTone } from '@/components/record/RecordUI'
import type { StreamEvent } from '@/components/record/ActivityStream'

export const PRIORITY_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: '高', tone: 'danger' }, medium: { label: '中', tone: 'warn' }, low: { label: '低', tone: 'pos' },
}

type ActivityRow = { id: string; type: string; subject: string; body: string | null; occurred_at: Date | string | null; created_at: Date | string | null }
type TaskRow     = { id: string; title: string; done: boolean; priority: string; created_at: Date | string | null }
type ExpenseRow  = { id: string; title: string; amount: unknown; expense_date: string | null; created_at: Date | string | null }
type ChangeLog   = { id: string; field_label: string; old_value: string | null; new_value: string | null; changed_at: Date | string | null }

export function buildRecordStream({
  activities, tasks, expenses, changeLogs, activityTypeLabels, toggleTask,
}: {
  activities: ActivityRow[]
  tasks: TaskRow[]
  expenses: ExpenseRow[]
  changeLogs: ChangeLog[]
  activityTypeLabels: Record<string, string>
  toggleTask: (formData: FormData) => Promise<void>
}): { stream: (StreamEvent & { sort: number })[]; interactionCount: number } {
  const NOW = Date.now()
  const dayLabel = (d: Date) => {
    const t0 = new Date(NOW); t0.setHours(0, 0, 0, 0); const d0 = new Date(d); d0.setHours(0, 0, 0, 0)
    const diff = Math.round((t0.getTime() - d0.getTime()) / 86400000)
    if (diff === 0) return '今日'; if (diff === 1) return '昨日'
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
  }
  const hm = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const stream: (StreamEvent & { sort: number })[] = []
  for (const a of activities) {
    const d = a.occurred_at ? new Date(a.occurred_at) : a.created_at ? new Date(a.created_at) : null
    if (!d) continue
    stream.push({ id: `a-${a.id}`, kind: 'act', typeLabel: activityTypeLabels[a.type] ?? a.type, time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <><Link href={`/activities/${a.id}`} className="font-semibold text-zinc-900 hover:text-brand-700">{a.subject}</Link>{a.body && <span className="block text-zinc-500 text-[12.5px] mt-0.5 line-clamp-2">{a.body}</span>}</> })
  }
  for (const t of tasks) {
    const d = t.created_at ? new Date(t.created_at) : null
    if (!d) continue
    const pr = PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.medium
    stream.push({ id: `t-${t.id}`, kind: 'todo', typeLabel: 'ToDo', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      leading: <AuthGuard minRole="editor"><form action={toggleTask}><input type="hidden" name="task_id" value={t.id} /><input type="hidden" name="done" value={(!t.done).toString()} /><button type="submit" className={`w-4.5 h-4.5 rounded-md border-[1.5px] grid place-items-center ${t.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-zinc-300 hover:border-brand-400'}`}>{t.done && <Check className="w-3 h-3" strokeWidth={3} aria-hidden />}</button></form></AuthGuard>,
      body: <div className="flex items-center gap-2 flex-wrap"><Link href={`/tasks/${t.id}`} className={`font-semibold hover:text-brand-700 ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{t.title}</Link><Badge tone={pr.tone}>{pr.label}</Badge></div> })
  }
  for (const e of expenses) {
    const d = e.expense_date ? new Date(e.expense_date) : e.created_at ? new Date(e.created_at) : null
    if (!d) continue
    stream.push({ id: `e-${e.id}`, kind: 'exp', typeLabel: '経費', day: dayLabel(d), sort: d.getTime(),
      body: <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-2"><span className="font-semibold text-zinc-900">{e.title}</span><span className="font-bold text-zinc-900 shrink-0">¥{Number(e.amount).toLocaleString()}</span></Link> })
  }
  for (const c of changeLogs) {
    const d = c.changed_at ? new Date(c.changed_at) : null
    if (!d) continue
    stream.push({ id: `c-${c.id}`, kind: 'his', typeLabel: '履歴', time: hm(d), day: dayLabel(d), sort: d.getTime(),
      body: <span className="text-zinc-600">{c.field_label}を <span className="text-zinc-900 font-medium">{c.old_value ?? '—'}</span> → <span className="text-zinc-900 font-medium">{c.new_value ?? '—'}</span> に変更</span> })
  }
  stream.sort((a, b) => b.sort - a.sort)
  return { stream, interactionCount: activities.length + tasks.length + expenses.length }
}
