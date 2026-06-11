'use client'

/**
 * 承認設定の最小ルールエディタ（REQ-0023 / #85 Phase1）
 *
 * Phase1 スコープ：1 ブック × 1 ルール（条件は任意フィールド1つ・無条件可）× 多段ステップ
 * （各ステップ承認者1名＝ユーザー or ロール）。Phase2 で複数ルール・複数承認者/mode に拡張。
 * 保存形式は specs/approvals.md の ApprovalConfig JSON（拡張しても後方互換）。
 */
import { useState } from 'react'
import { saveApprovalConfig } from '@/app/actions/approvals'
import type { ApprovalConfig, ApprovalOp } from '@/lib/approvalRules'

type ConditionField = { name: string; label: string }
type StepDraft = { type: 'user' | 'role'; ref: string }

type Props = {
  bookApi: string
  bookLabel: string
  conditionFields: ConditionField[]
  users: { id: string; email: string }[]
  roles: string[]
  initial: ApprovalConfig | null
}

const OPS: { value: ApprovalOp; label: string }[] = [
  { value: '>=', label: '以上' },
  { value: '>',  label: 'より大きい' },
  { value: '<=', label: '以下' },
  { value: '<',  label: 'より小さい' },
  { value: '=',  label: '等しい' },
  { value: '!=', label: '等しくない' },
  { value: 'contains', label: 'を含む' },
]

function initialSteps(initial: ApprovalConfig | null): StepDraft[] {
  const steps = initial?.rules?.[0]?.steps ?? []
  const drafts: StepDraft[] = []
  for (const s of steps) {
    const a = s.approvers[0]
    if (!a) continue
    if (a.startsWith('user:')) drafts.push({ type: 'user', ref: a.slice(5) })
    else if (a.startsWith('role:')) drafts.push({ type: 'role', ref: a.slice(5) })
  }
  return drafts.length ? drafts : [{ type: 'role', ref: 'admin' }]
}

export default function ApprovalConfigEditor({ bookApi, bookLabel, conditionFields, users, roles, initial }: Props) {
  const cond = initial?.rules?.[0]?.when?.all?.[0]
  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [steps, setSteps] = useState<StepDraft[]>(() => initialSteps(initial))
  const [saved, setSaved] = useState(false)

  const updateStep = (i: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch, ...(patch.type ? { ref: '' } : {}) } : s)))
    setSaved(false)
  }

  return (
    <form
      action={async (fd) => { await saveApprovalConfig(bookApi, fd); setSaved(true) }}
      className="space-y-4"
    >
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox" name="enabled" checked={enabled}
          onChange={(e) => { setEnabled(e.target.checked); setSaved(false) }}
          className="accent-blue-600 w-4 h-4"
        />
        <span className="text-sm font-medium text-zinc-800">{bookLabel}で承認を有効にする</span>
      </label>

      {enabled && (
        <>
          {/* 条件（任意） */}
          <div className="rounded-md border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-600 mb-2">承認が必要になる条件（値が空なら全レコードが対象）</p>
            <div className="flex flex-wrap items-center gap-2">
              <select name="cond_field" defaultValue={cond?.field ?? conditionFields[0]?.name} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                {conditionFields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
              </select>
              <select name="cond_op" defaultValue={cond?.op ?? '>='} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                type="text" name="cond_value" defaultValue={cond?.value ?? ''} placeholder="例: 100000"
                className="w-36 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* 多段ステップ */}
          <div className="rounded-md border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-600 mb-2">承認ステップ（上から順に承認されます）</p>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">{i + 1}</span>
                  <select
                    name={`step_type_${i + 1}`} value={s.type}
                    onChange={(e) => updateStep(i, { type: e.target.value as StepDraft['type'] })}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="user">ユーザー</option>
                    <option value="role">ロール</option>
                  </select>
                  <select
                    name={`step_ref_${i + 1}`} value={s.ref}
                    onChange={(e) => updateStep(i, { ref: e.target.value })}
                    className="min-w-44 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">選択してください</option>
                    {s.type === 'user'
                      ? users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)
                      : roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => { setSteps((prev) => prev.filter((_, j) => j !== i)); setSaved(false) }}
                      className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setSteps((prev) => [...prev, { type: 'role', ref: '' }]); setSaved(false) }}
              className="mt-2 rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
            >
              ＋ ステップを追加
            </button>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          保存
        </button>
        {saved && <span className="text-sm text-green-600">✓ 保存しました</span>}
      </div>
    </form>
  )
}
