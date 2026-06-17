'use client'

/**
 * ロール管理 UI（RBAC: REQ-0031 / ADR-0023）。
 * - ロール一覧（system は権限固定・削除不可）
 * - カスタムロールの作成・削除・権限マトリクス（既定 '*' 行＋ブック別上書き行）編集
 * - ユーザーへのロール割当
 */
import { useState, useTransition } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { createRole, deleteRole, saveRolePermissions } from '@/app/actions/roles'

type Scope = 'all' | 'own'
type PermRow = {
  book_api: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean
  read_scope: Scope; write_scope: Scope
}
type RoleItem = {
  id: string; name: string; description: string | null; is_system: boolean
  assignedUsers: number; permissions: PermRow[]
}
type Book = { api: string; label: string }
type UserRow = { id: string; email: string; role: string; role_id: string | null }

const OPS = [
  { key: 'can_create' as const, label: '作成' },
  { key: 'can_read' as const, label: '閲覧' },
  { key: 'can_update' as const, label: '更新' },
  { key: 'can_delete' as const, label: '削除' },
]

// レコードスコープ（REQ-0083）。read_scope=閲覧範囲 / write_scope=作成・更新・削除の範囲。
const SCOPE_FIELDS = [
  { key: 'read_scope' as const, label: '閲覧範囲' },
  { key: 'write_scope' as const, label: '編集範囲' },
]
const SCOPE_SELECT = 'border border-zinc-300 rounded px-1.5 py-1 text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50'

const INPUT = 'border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function RoleManager({
  roles, books, scopeBooks, users, assignAction,
}: {
  roles: RoleItem[]
  books: Book[]
  /** レコードスコープ（自分の担当のみ）の強制が実装済みの book_api 集合（REQ-0083） */
  scopeBooks: string[]
  users: UserRow[]
  assignAction: (userId: string, roleId: string) => Promise<void>
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  function submitCreate() {
    setError(null)
    const fd = new FormData()
    fd.set('name', newName)
    fd.set('description', newDesc)
    start(async () => {
      try {
        await createRole(fd)
        setCreating(false); setNewName(''); setNewDesc('')
      } catch (e) { setError(e instanceof Error ? e.message : '作成に失敗しました') }
    })
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-2.5 rounded-md">{error}</div>}

      {/* ロール一覧 */}
      <div className="space-y-3">
        {roles.map((r) => (
          <RoleCard key={r.id} role={r} books={books} scopeBooks={scopeBooks} onError={setError} />
        ))}
      </div>

      {/* 新規ロール作成 */}
      {!creating ? (
        <button type="button" onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
          <Plus className="w-4 h-4" strokeWidth={2.5} />新規ロール
        </button>
      ) : (
        <div className="bg-white border border-brand-300 rounded-xl shadow-xs p-4 space-y-3">
          <p className="text-sm font-bold text-zinc-700">新規ロール</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ロール名（例: 営業 / 経理 / 工場）" className={INPUT} />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="説明（任意）" className={INPUT} />
          </div>
          <p className="text-xs text-zinc-400">作成直後は「全ブック閲覧のみ」。作成後にマトリクスで権限を設定してください。</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={submitCreate} disabled={pending || !newName.trim()}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 disabled:opacity-50">
              {pending ? '作成中…' : '作成'}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50">取消</button>
          </div>
        </div>
      )}

      {/* ユーザーへの割当 */}
      <section className="bg-white border border-zinc-200 rounded-xl shadow-xs p-5">
        <h2 className="text-sm font-bold text-zinc-700 mb-1">ユーザーへのロール割当</h2>
        <p className="text-xs text-zinc-400 mb-4">ロールを変更すると即時反映されます（反映まで最大60秒キャッシュ）。</p>
        <div className="divide-y divide-zinc-100">
          {users.map((u) => <UserAssignRow key={u.id} user={u} roles={roles} assignAction={assignAction} onError={setError} />)}
        </div>
      </section>
    </div>
  )
}

function UserAssignRow({ user, roles, assignAction, onError }: {
  user: UserRow; roles: RoleItem[]
  assignAction: (userId: string, roleId: string) => Promise<void>
  onError: (msg: string) => void
}) {
  const [pending, start] = useTransition()
  // role_id 未設定（移行前）は users.role と同名 system ロールを現在値として表示
  const current = user.role_id ?? roles.find((r) => r.is_system && r.name === user.role)?.id ?? ''
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-zinc-800 truncate min-w-0">{user.email}</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value
          if (!v) return
          start(async () => {
            try { await assignAction(user.id, v) } catch (err) { onError(err instanceof Error ? err.message : '割当に失敗しました') }
          })
        }}
        className="shrink-0 border border-zinc-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {!current && <option value="">— 未割当 —</option>}
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_system ? '（標準）' : ''}</option>)}
      </select>
    </div>
  )
}

function RoleCard({ role, books, scopeBooks, onError }: { role: RoleItem; books: Book[]; scopeBooks: string[]; onError: (m: string) => void }) {
  const scopeSupported = (bookApi: string) => bookApi === '*' || scopeBooks.includes(bookApi)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  // マトリクスの編集状態: '*' 行 + ブック別上書き行
  const initialMap = new Map(role.permissions.map((p) => [p.book_api, p]))
  const [rows, setRows] = useState<Map<string, PermRow>>(initialMap)
  const [dirty, setDirty] = useState(false)

  const wildcard: PermRow = rows.get('*') ?? { book_api: '*', can_create: false, can_read: true, can_update: false, can_delete: false, read_scope: 'all', write_scope: 'all' }

  function toggle(bookApi: string, key: (typeof OPS)[number]['key']) {
    if (role.is_system) return
    setRows((prev) => {
      const next = new Map(prev)
      const base = next.get(bookApi)
        ?? (bookApi === '*' ? { ...wildcard } : { ...wildcard, book_api: bookApi })  // 個別行が無ければ既定から複製
      const updated = { ...base, book_api: bookApi, [key]: !base[key] }
      next.set(bookApi, updated)
      return next
    })
    setDirty(true)
  }

  function setScope(bookApi: string, which: (typeof SCOPE_FIELDS)[number]['key'], value: Scope) {
    if (role.is_system) return
    setRows((prev) => {
      const next = new Map(prev)
      const base = next.get(bookApi)
        ?? (bookApi === '*' ? { ...wildcard } : { ...wildcard, book_api: bookApi })
      next.set(bookApi, { ...base, book_api: bookApi, [which]: value })
      return next
    })
    setDirty(true)
  }

  const scopeCell = (bookApi: string, perm: PermRow) => {
    if (!scopeSupported(bookApi)) {
      return (
        <td className="px-2 py-2">
          <span className="text-[11px] text-zinc-300" title="このブックは担当者スコープ未対応（owner なし）">—</span>
        </td>
      )
    }
    return (
      <td className="px-2 py-2">
        <div className="flex flex-col gap-1 items-start">
          {SCOPE_FIELDS.map((sf) => (
            <label key={sf.key} className="flex items-center gap-1 text-[11px] text-zinc-500">
              <span className="w-10 shrink-0">{sf.label}</span>
              <select value={perm[sf.key]} disabled={role.is_system || pending}
                onChange={(e) => setScope(bookApi, sf.key, e.target.value as Scope)} className={SCOPE_SELECT}>
                <option value="all">全件</option>
                <option value="own">自分の担当のみ</option>
              </select>
            </label>
          ))}
        </div>
      </td>
    )
  }

  function clearOverride(bookApi: string) {
    if (role.is_system || bookApi === '*') return
    setRows((prev) => { const next = new Map(prev); next.delete(bookApi); return next })
    setDirty(true)
  }

  function save() {
    const fd = new FormData()
    fd.set('permissions', JSON.stringify(Array.from(rows.values())))
    start(async () => {
      try { await saveRolePermissions(role.id, fd); setDirty(false) }
      catch (e) { onError(e instanceof Error ? e.message : '保存に失敗しました') }
    })
  }

  function remove() {
    if (!confirm(`ロール「${role.name}」を削除しますか？割当中のユーザーは標準ロール（旧設定）に戻ります。`)) return
    start(async () => {
      try { await deleteRole(role.id) }
      catch (e) { onError(e instanceof Error ? e.message : '削除に失敗しました') }
    })
  }

  const permFor = (bookApi: string): { perm: PermRow; overridden: boolean } => {
    const own = rows.get(bookApi)
    return own ? { perm: own, overridden: true } : { perm: wildcard, overridden: false }
  }

  return (
    <section className={`rounded-xl border shadow-xs overflow-hidden ${role.is_system ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-200 bg-white'}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-50">
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
          <span className="font-semibold text-zinc-900">{role.name}</span>
          {role.is_system && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600"><Lock className="w-3 h-3" />標準（固定）</span>}
          {role.description && <span className="text-xs text-zinc-400 truncate">{role.description}</span>}
        </div>
        <span className="shrink-0 text-xs text-zinc-400">{role.assignedUsers} 名に割当</span>
      </button>

      {open && (
        <div className="border-t border-zinc-100 p-4 space-y-3">
          {/* マトリクス */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-y border-zinc-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">ブック</th>
                  {OPS.map((op) => <th key={op.key} className="px-2 py-2 text-xs font-semibold text-zinc-500 w-14 text-center">{op.label}</th>)}
                  <th className="px-2 py-2 text-xs font-semibold text-zinc-500 text-left">レコード範囲</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {/* 既定（ワイルドカード）行 */}
                <tr className="bg-amber-50/40">
                  <td className="px-3 py-2 font-medium text-zinc-800">すべてのブック（既定）</td>
                  {OPS.map((op) => (
                    <td key={op.key} className="px-2 py-2 text-center">
                      <input type="checkbox" checked={wildcard[op.key]} disabled={role.is_system || pending} onChange={() => toggle('*', op.key)} className="accent-blue-600 w-4 h-4" />
                    </td>
                  ))}
                  {scopeCell('*', wildcard)}
                  <td></td>
                </tr>
                {/* ブック別行 */}
                {books.map((b) => {
                  const { perm, overridden } = permFor(b.api)
                  return (
                    <tr key={b.api} className={overridden ? 'bg-blue-50/40' : ''}>
                      <td className="px-3 py-2 text-zinc-700">
                        {b.label}
                        <span className="ml-2 text-[11px] text-zinc-400 font-mono">{b.api}</span>
                        {!overridden && <span className="ml-2 text-[10px] text-zinc-400">（既定）</span>}
                      </td>
                      {OPS.map((op) => (
                        <td key={op.key} className="px-2 py-2 text-center">
                          <input type="checkbox" checked={perm[op.key]} disabled={role.is_system || pending} onChange={() => toggle(b.api, op.key)} className="accent-blue-600 w-4 h-4" />
                        </td>
                      ))}
                      {scopeCell(b.api, perm)}
                      <td className="px-2 py-2 text-right">
                        {overridden && !role.is_system && (
                          <button type="button" onClick={() => clearOverride(b.api)} className="text-[11px] text-zinc-400 hover:text-zinc-700 underline">既定に戻す</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!role.is_system && (
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={remove} disabled={pending}
                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />ロールを削除
              </button>
              <div className="flex items-center gap-2">
                {dirty && <span className="text-xs text-amber-700">未保存の変更があります</span>}
                <button type="button" onClick={save} disabled={pending || !dirty}
                  className="px-4 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 disabled:opacity-50">
                  {pending ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
