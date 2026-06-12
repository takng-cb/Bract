'use client'

import { useState, useTransition } from 'react'
import {
  saveUserNavOrder,
  resetUserNavOrder,
  saveSystemNavOrder,
  resetSystemNavOrder,
} from '@/app/actions/navSettings'
import {
  applyNavOrderToGroups,
  OTHER_GROUP_ID,
  type NavGroup,
  type NavOrderV2,
} from '@/lib/navOrder'
import { NavIcon } from '@/lib/navIcon'
import { showToast } from '@/components/Toast'

type Props = {
  /** 既定順のナビグループ（buildNavGroups で構築。dashboard は含めない） */
  groups: NavGroup[]
  /** 現在のユーザー設定順序（null = 設定なし） */
  userOrder:   NavOrderV2 | string[] | null
  /** 現在のシステム設定順序（null = 設定なし） */
  systemOrder: NavOrderV2 | string[] | null
}

/** 編集中のグループ配列 → 保存形式 v2 */
function toOrderV2(groups: NavGroup[]): NavOrderV2 {
  return {
    v: 2,
    modules: groups.map((g) => g.id),
    books: Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.href)])),
  }
}

export default function NavOrderEditor({ groups: defaultGroups, userOrder, systemOrder }: Props) {
  const [groups, setGroups] = useState<NavGroup[]>(
    () => applyNavOrderToGroups(defaultGroups, userOrder ?? systemOrder),
  )
  const [isPending, startTransition] = useTransition()

  function moveGroup(index: number, dir: -1 | 1) {
    const next = [...groups]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setGroups(next)
  }

  function moveItem(groupIndex: number, index: number, dir: -1 | 1) {
    const next = groups.map((g) => ({ ...g, items: [...g.items] }))
    const items = next[groupIndex].items
    const swap = index + dir
    if (swap < 0 || swap >= items.length) return
    ;[items[index], items[swap]] = [items[swap], items[index]]
    setGroups(next)
  }

  // 保存完了はグローバルトーストで通知（REQ-0057。inline の完了表示は廃止）
  function handleSaveUser() {
    startTransition(async () => {
      await saveUserNavOrder(toOrderV2(groups))
      showToast('ナビゲーション順序をマイ設定として保存しました')
    })
  }

  function handleSaveSystem() {
    startTransition(async () => {
      await saveSystemNavOrder(toOrderV2(groups))
      showToast('ナビゲーション順序をシステムデフォルトとして保存しました')
    })
  }

  function handleResetUser() {
    startTransition(async () => {
      await resetUserNavOrder()
      setGroups(applyNavOrderToGroups(defaultGroups, systemOrder))
    })
  }

  function handleResetSystem() {
    startTransition(async () => {
      await resetSystemNavOrder()
      setGroups(defaultGroups)
    })
  }

  const arrowBtn = 'w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-500 transition-colors'

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <h2 className="text-sm font-bold text-zinc-700 mb-1">
        ナビゲーション順序
      </h2>
      <p className="text-xs text-zinc-400 mb-4">
        ↑↓ でモジュールの並びと、各モジュール内のブックの並びを変えて保存してください。
      </p>

      {/* モジュール（グループ）ごとの並び替え */}
      <div className="space-y-3 mb-6">
        {groups.map((g, gi) => (
          <section key={g.id} className="border border-zinc-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 bg-zinc-100/80 px-4 py-2.5 border-b border-zinc-200">
              <span className="flex-1 text-sm font-semibold text-zinc-800">{g.name}</span>
              {g.id !== OTHER_GROUP_ID && (
                <span className="text-[11px] text-zinc-400 font-mono shrink-0">{g.id}</span>
              )}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => moveGroup(gi, -1)}
                  disabled={gi === 0 || isPending}
                  className={arrowBtn}
                  aria-label={`${g.name}を上に移動`}
                >
                  ▲
                </button>
                <button
                  onClick={() => moveGroup(gi, 1)}
                  disabled={gi === groups.length - 1 || isPending}
                  className={arrowBtn}
                  aria-label={`${g.name}を下に移動`}
                >
                  ▼
                </button>
              </div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {g.items.map((item, i) => {
                const isCustom = item.href.startsWith('/books/')
                return (
                  <li key={item.href} className="flex items-center gap-3 px-4 py-2 bg-white">
                    <span className="w-6 flex items-center justify-center shrink-0 text-zinc-500"><NavIcon icon={item.icon} className="w-4.5 h-4.5" /></span>
                    <span className="flex-1 text-sm font-medium text-zinc-800">{item.label}</span>
                    {isCustom && (
                      <span className="text-xs text-violet-500 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 shrink-0">
                        カスタム
                      </span>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => moveItem(gi, i, -1)}
                        disabled={i === 0 || isPending}
                        className={arrowBtn}
                        aria-label={`${item.label}を上に移動`}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(gi, i, 1)}
                        disabled={i === g.items.length - 1 || isPending}
                        className={arrowBtn}
                        aria-label={`${item.label}を下に移動`}
                      >
                        ▼
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* ユーザー設定 */}
      <div className="border border-zinc-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-zinc-600 mb-3 inline-flex items-center gap-1.5"><NavIcon icon="👤" className="w-3.5 h-3.5" /> マイ設定</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveUser}
            disabled={isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            マイ設定として保存
          </button>
          {userOrder && (
            <button
              onClick={handleResetUser}
              disabled={isPending}
              className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              マイ設定をリセット
            </button>
          )}
        </div>
        {userOrder
          ? <p className="text-xs text-zinc-400 mt-2">現在マイ設定が有効です</p>
          : <p className="text-xs text-zinc-400 mt-2">設定なし（システムデフォルトを使用中）</p>
        }
      </div>

      {/* システム設定 */}
      <div className="border border-zinc-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-zinc-600 mb-1 inline-flex items-center gap-1.5"><NavIcon icon="🌐" className="w-3.5 h-3.5" /> システムデフォルト</p>
        <p className="text-xs text-zinc-400 mb-3">マイ設定がないユーザー全員に適用されます</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveSystem}
            disabled={isPending}
            className="px-3 py-1.5 bg-zinc-700 text-white text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            システムデフォルトとして保存
          </button>
          {systemOrder && (
            <button
              onClick={handleResetSystem}
              disabled={isPending}
              className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-sm rounded-md hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              システム設定をリセット
            </button>
          )}
        </div>
        {systemOrder
          ? <p className="text-xs text-zinc-400 mt-2">現在カスタムデフォルトが設定されています</p>
          : <p className="text-xs text-zinc-400 mt-2">設定なし（出荷時デフォルトを使用中）</p>
        }
      </div>
    </div>
  )
}
