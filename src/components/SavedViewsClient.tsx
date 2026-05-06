'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SavedView } from '@/lib/savedViews'

type Props = {
  views: SavedView[]
  basePath: string
  currentFilterRaw: string[]
  currentGroup: string
  persistParams?: Record<string, string>
  isAdmin: boolean
  userId: string | null
  createAction: (name: string, filterParams: string[], groupParams: string, scope: 'user' | 'system') => Promise<void>
  deleteAction: (id: string) => Promise<void>
  setDefaultAction: (id: string, scope: 'user' | 'system') => Promise<void>
  clearDefaultAction: (scope: 'user' | 'system') => Promise<void>
}

function buildViewUrl(basePath: string, view: SavedView, persistParams?: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(persistParams ?? {})) params.set(k, v)
  for (const f of view.filter_params) params.append('f', f)
  if (view.group_params) params.set('group', view.group_params)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function isViewActive(view: SavedView, currentFilterRaw: string[], currentGroup: string): boolean {
  if (view.group_params !== currentGroup) return false
  if (view.filter_params.length !== currentFilterRaw.length) return false
  const a = [...view.filter_params].sort()
  const b = [...currentFilterRaw].sort()
  return a.every((f, i) => f === b[i])
}

export default function SavedViewsClient({
  views, basePath, currentFilterRaw, currentGroup, persistParams, isAdmin, userId,
  createAction, deleteAction, setDefaultAction, clearDefaultAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveScope, setSaveScope] = useState<'user' | 'system'>('user')
  const [saveError, setSaveError] = useState('')

  const userViews   = views.filter((v) => v.scope === 'user')
  const systemViews = views.filter((v) => v.scope === 'system')
  const hasCurrentConditions = currentFilterRaw.length > 0 || currentGroup !== ''

  function handleClickView(view: SavedView) {
    router.push(buildViewUrl(basePath, view, persistParams))
  }

  function handleDelete(view: SavedView) {
    if (!confirm(`「${view.name}」を削除しますか？`)) return
    setPendingId(view.id)
    startTransition(async () => {
      await deleteAction(view.id)
      setPendingId(null)
    })
  }

  function handleToggleDefault(view: SavedView) {
    setPendingId(view.id)
    startTransition(async () => {
      if (view.is_default) {
        await clearDefaultAction(view.scope)
      } else {
        await setDefaultAction(view.id, view.scope)
      }
      setPendingId(null)
    })
  }

  function handleSave() {
    if (!saveName.trim()) { setSaveError('名前を入力してください'); return }
    setSaveError('')
    startTransition(async () => {
      await createAction(saveName.trim(), currentFilterRaw, currentGroup, saveScope)
      setSaveName('')
      setShowSaveForm(false)
    })
  }

  if (views.length === 0 && !hasCurrentConditions) return null

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
        <span className="text-xs text-zinc-400 shrink-0">ビュー:</span>

        {/* ユーザービュー */}
        {userViews.map((view) => {
          const active    = isViewActive(view, currentFilterRaw, currentGroup)
          const loading   = isPending && pendingId === view.id
          const canDelete = view.user_id === userId
          return (
            <span
              key={view.id}
              className={`inline-flex items-center gap-0.5 rounded-full border text-xs font-medium transition-colors ${loading ? 'opacity-50' : ''} ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:border-blue-400'
              }`}
            >
              <button
                type="button"
                onClick={() => handleClickView(view)}
                className="pl-2.5 pr-1 py-1"
              >
                {view.name}
              </button>
              <button
                type="button"
                onClick={() => handleToggleDefault(view)}
                title={view.is_default ? 'デフォルト解除' : 'デフォルトに設定'}
                className={`py-1 transition-colors ${
                  view.is_default
                    ? 'text-yellow-400'
                    : active ? 'text-blue-300 hover:text-yellow-300' : 'text-zinc-300 hover:text-yellow-400'
                }`}
              >
                ★
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(view)}
                  title="削除"
                  className={`pr-2 py-1 transition-colors ${
                    active ? 'text-blue-300 hover:text-white' : 'text-zinc-300 hover:text-red-500'
                  }`}
                >
                  ×
                </button>
              )}
            </span>
          )
        })}

        {/* システムビュー */}
        {systemViews.map((view) => {
          const active  = isViewActive(view, currentFilterRaw, currentGroup)
          const loading = isPending && pendingId === view.id
          return (
            <span
              key={view.id}
              className={`inline-flex items-center gap-0.5 rounded-full border text-xs font-medium transition-colors ${loading ? 'opacity-50' : ''} ${
                active
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400'
              }`}
            >
              <button
                type="button"
                onClick={() => handleClickView(view)}
                className="pl-2.5 pr-1 py-1 flex items-center gap-1"
              >
                <span className="text-xs">🌐</span>
                {view.name}
              </button>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleToggleDefault(view)}
                    title={view.is_default ? 'デフォルト解除（全員）' : 'システムデフォルトに設定（全員に適用）'}
                    className={`py-1 transition-colors ${
                      view.is_default
                        ? 'text-yellow-400'
                        : active ? 'text-violet-300 hover:text-yellow-300' : 'text-violet-300 hover:text-yellow-400'
                    }`}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(view)}
                    title="削除"
                    className={`pr-2 py-1 transition-colors ${
                      active ? 'text-violet-300 hover:text-white' : 'text-violet-300 hover:text-red-500'
                    }`}
                  >
                    ×
                  </button>
                </>
              )}
            </span>
          )
        })}

        {/* 保存ボタン（現在の条件がある場合のみ） */}
        {hasCurrentConditions && (
          <button
            type="button"
            onClick={() => setShowSaveForm((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-zinc-500 border border-dashed border-zinc-300 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            ＋ 保存
          </button>
        )}
      </div>

      {/* 保存フォーム */}
      {showSaveForm && (
        <div className="mt-2 flex flex-wrap items-center gap-2 px-3 py-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
          <input
            type="text"
            value={saveName}
            onChange={(e) => { setSaveName(e.target.value); setSaveError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="ビュー名を入力..."
            autoFocus
            className="w-48 px-2.5 py-1.5 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isAdmin && (
            <select
              value={saveScope}
              onChange={(e) => setSaveScope(e.target.value as 'user' | 'system')}
              className="px-2 py-1.5 text-sm border border-zinc-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">個人</option>
              <option value="system">🌐 システム全体</option>
            </select>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !saveName.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => { setShowSaveForm(false); setSaveName(''); setSaveError('') }}
            className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            キャンセル
          </button>
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
        </div>
      )}
    </div>
  )
}
