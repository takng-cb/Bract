'use client'

/**
 * レコード承認の設定エディタ v2（REQ-0037 / #85 Phase2）
 *
 * - 全ブック対応（typed＋カスタム）。ブックを選んで設定する。
 * - 1 ブックに複数ルール。各ルールのトリガーは:
 *     手動申請      … レコード詳細の「承認を申請」ボタンから起票
 *     ステータス遷移 … StageBar 等でステータスを変えようとした時に自動起票
 *       （from / to は空 = すべて。承認されると変更が自動適用される）
 * - 条件（任意）: フィールド × 演算子 × 値（値が空なら無条件）
 * - 承認ステップ: 多段。各ステップの承認者はユーザーまたはロール。
 *
 * 保存形式は specs/approvals.md の ApprovalConfig JSON（saveApprovalConfig が厳格検証）。
 */
import { useState } from 'react'
import { saveApprovalConfig } from '@/app/actions/approvals'
import type { ApprovalConfig, ApprovalOp } from '@/lib/approvalRules'
import type { ApprovalBookMeta, StatusOption } from '@/lib/approvalBookMeta'

type StepDraft = { type: 'user' | 'role'; ref: string }
type RuleDraft = {
  name: string
  trigger: 'manual' | 'transition'
  tField: string
  tFrom: string
  tTo: string
  condField: string
  condOp: ApprovalOp
  condValue: string
  steps: StepDraft[]
}
type Draft = { enabled: boolean; rules: RuleDraft[] }

type Props = {
  books: ApprovalBookMeta[]
  configs: Record<string, ApprovalConfig>
  users: { id: string; email: string }[]
  roles: string[]
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

function emptyRule(book: ApprovalBookMeta): RuleDraft {
  return {
    name: '', trigger: book.statusField ? 'transition' : 'manual',
    tField: book.statusField ?? 'status', tFrom: '', tTo: '',
    condField: '', condOp: '>=', condValue: '',
    steps: [{ type: 'role', ref: 'admin' }],
  }
}

function toDraft(book: ApprovalBookMeta, config: ApprovalConfig | undefined): Draft {
  if (!config) return { enabled: false, rules: [emptyRule(book)] }
  const rules: RuleDraft[] = config.rules.map((r) => {
    const cond = r.when?.all?.[0] ?? r.when?.any?.[0]
    const steps: StepDraft[] = r.steps.map((s) => {
      const a = s.approvers[0] ?? ''
      return a.startsWith('user:') ? { type: 'user', ref: a.slice(5) } : { type: 'role', ref: a.slice(5) }
    })
    return {
      name: r.name ?? '',
      trigger: r.transition ? 'transition' : 'manual',
      tField: r.transition?.field ?? book.statusField ?? 'status',
      tFrom: r.transition?.from ?? '',
      tTo: r.transition?.to ?? '',
      condField: cond?.field ?? '', condOp: cond?.op ?? '>=', condValue: cond?.value ?? '',
      steps: steps.length ? steps : [{ type: 'role', ref: 'admin' }],
    }
  })
  return { enabled: config.enabled, rules: rules.length ? rules : [emptyRule(book)] }
}

function toConfig(draft: Draft): ApprovalConfig {
  return {
    enabled: draft.enabled,
    rules: draft.rules
      .filter((r) => r.steps.some((s) => s.ref))
      .map((r) => ({
        ...(r.name.trim() ? { name: r.name.trim() } : {}),
        ...(r.trigger === 'transition'
          ? { transition: {
              field: r.tField.trim() || 'status',
              ...(r.tFrom.trim() ? { from: r.tFrom.trim() } : {}),
              ...(r.tTo.trim() ? { to: r.tTo.trim() } : {}),
            } }
          : {}),
        ...(r.condField.trim() && r.condValue.trim()
          ? { when: { all: [{ field: r.condField.trim(), op: r.condOp, value: r.condValue.trim() }] } }
          : {}),
        steps: r.steps.filter((s) => s.ref).map((s) => ({ approvers: [`${s.type}:${s.ref}`], mode: 'any' as const })),
      })),
  }
}

/** ステータス値の入力：既知の選択肢があれば select、無ければ自由入力 */
function StatusValueInput({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: StatusOption[]; placeholder: string
}) {
  if (options.length === 0) {
    return (
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      />
    )
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
      <option value="">（すべて）</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export default function ApprovalRulesEditor({ books, configs, users, roles }: Props) {
  const [bookApi, setBookApi] = useState(books[0]?.api ?? '')
  const book = books.find((b) => b.api === bookApi) ?? books[0]
  const [draft, setDraft] = useState<Draft>(() => toDraft(book, configs[book?.api]))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingBusy, setSavingBusy] = useState(false)

  const switchBook = (api: string) => {
    setBookApi(api)
    const b = books.find((x) => x.api === api)!
    setDraft(toDraft(b, configs[api]))
    setSaved(false); setError(null)
  }

  const patchRule = (i: number, patch: Partial<RuleDraft>) => {
    setDraft((d) => ({ ...d, rules: d.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }))
    setSaved(false)
  }
  const patchStep = (ri: number, si: number, patch: Partial<StepDraft>) => {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r, j) => j !== ri ? r : {
        ...r,
        steps: r.steps.map((s, k) => (k === si ? { ...s, ...patch, ...(patch.type ? { ref: '' } : {}) } : s)),
      }),
    }))
    setSaved(false)
  }

  const save = async () => {
    setSavingBusy(true); setError(null)
    try {
      await saveApprovalConfig(book.api, JSON.stringify(toConfig(draft)))
      // 保存後はローカルの configs 相当も更新された前提で saved 表示のみ
      setSaved(true)
    } catch (e) {
      setError((e as Error)?.message ?? '保存に失敗しました')
    } finally {
      setSavingBusy(false)
    }
  }

  if (!book) return null

  return (
    <div className="space-y-4">
      {/* ブック選択 ＋ 有効化 */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={bookApi} onChange={(e) => switchBook(e.target.value)} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm font-medium">
          {books.map((b) => (
            <option key={b.api} value={b.api}>
              {b.label}{configs[b.api]?.enabled ? '（承認 ON）' : ''}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={draft.enabled}
            onChange={(e) => { setDraft((d) => ({ ...d, enabled: e.target.checked })); setSaved(false) }}
            className="accent-blue-600 w-4 h-4"
          />
          <span className="text-sm font-medium text-zinc-800">{book.label}で承認を有効にする</span>
        </label>
      </div>

      {draft.enabled && (
        <div className="space-y-3">
          {draft.rules.map((r, ri) => (
            <div key={ri} className="rounded-md border border-zinc-200 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">{ri + 1}</span>
                <input
                  type="text" value={r.name} onChange={(e) => patchRule(ri, { name: e.target.value })}
                  placeholder="ルール名（任意・例: 高額値引きの承認）"
                  className="flex-1 min-w-40 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
                />
                {draft.rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setDraft((d) => ({ ...d, rules: d.rules.filter((_, j) => j !== ri) })); setSaved(false) }}
                    className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                  >
                    ルールを削除
                  </button>
                )}
              </div>

              {/* トリガー */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={r.trigger === 'transition'} onChange={() => patchRule(ri, { trigger: 'transition' })} className="accent-blue-600" />
                  ステータス遷移で承認
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={r.trigger === 'manual'} onChange={() => patchRule(ri, { trigger: 'manual' })} className="accent-blue-600" />
                  手動で承認を申請
                </label>
              </div>

              {r.trigger === 'transition' && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm">
                  <span className="text-xs text-zinc-500">フィールド</span>
                  <input
                    type="text" value={r.tField} onChange={(e) => patchRule(ri, { tField: e.target.value })}
                    className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono"
                  />
                  <StatusValueInput value={r.tFrom} onChange={(v) => patchRule(ri, { tFrom: v })} options={book.statusOptions} placeholder="変更前（空=すべて）" />
                  <span className="text-zinc-400">→</span>
                  <StatusValueInput value={r.tTo} onChange={(v) => patchRule(ri, { tTo: v })} options={book.statusOptions} placeholder="変更後（空=すべて）" />
                  <span className="text-[11px] text-zinc-400">この遷移をしようとすると承認が必要になります</span>
                </div>
              )}

              {/* 条件（任意） */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">条件（任意）</span>
                <input
                  type="text" list={`cond-fields-${book.api}`} value={r.condField}
                  onChange={(e) => patchRule(ri, { condField: e.target.value })}
                  placeholder="フィールド（例: amount）"
                  className="w-36 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono"
                />
                <datalist id={`cond-fields-${book.api}`}>
                  {book.conditionFields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
                </datalist>
                <select value={r.condOp} onChange={(e) => patchRule(ri, { condOp: e.target.value as ApprovalOp })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  type="text" value={r.condValue} onChange={(e) => patchRule(ri, { condValue: e.target.value })}
                  placeholder="値（空=条件なし）"
                  className="w-32 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
                />
              </div>

              {/* 承認ステップ（多段） */}
              <div>
                <p className="text-xs font-semibold text-zinc-600 mb-1.5">承認ステップ（上から順に承認）</p>
                <div className="space-y-1.5">
                  {r.steps.map((s, si) => (
                    <div key={si} className="flex flex-wrap items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600">{si + 1}</span>
                      <select value={s.type} onChange={(e) => patchStep(ri, si, { type: e.target.value as StepDraft['type'] })} className="rounded-md border border-zinc-300 px-2 py-1 text-sm">
                        <option value="user">ユーザー</option>
                        <option value="role">ロール</option>
                      </select>
                      <select value={s.ref} onChange={(e) => patchStep(ri, si, { ref: e.target.value })} className="min-w-44 rounded-md border border-zinc-300 px-2 py-1 text-sm">
                        <option value="">選択してください</option>
                        {s.type === 'user'
                          ? users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)
                          : roles.map((ro) => <option key={ro} value={ro}>{ro}</option>)}
                      </select>
                      {r.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => { patchRule(ri, { steps: r.steps.filter((_, k) => k !== si) }) }}
                          className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => patchRule(ri, { steps: [...r.steps, { type: 'role', ref: '' }] })}
                  className="mt-1.5 rounded-md border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  ＋ ステップを追加
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => { setDraft((d) => ({ ...d, rules: [...d.rules, emptyRule(book)] })); setSaved(false) }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ＋ ルールを追加
          </button>
          <p className="text-[11px] text-zinc-400">ルールは上から評価され、最初に当てはまったルールの承認ステップが使われます。</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button" onClick={save} disabled={savingBusy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {savingBusy ? '保存中…' : `${book.label}の承認設定を保存`}
        </button>
        {saved && <span className="text-sm text-green-600">✓ 保存しました</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
