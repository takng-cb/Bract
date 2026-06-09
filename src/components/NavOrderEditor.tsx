'use client'

import { useState, useTransition } from 'react'
import {
  saveUserNavOrder,
  resetUserNavOrder,
  saveSystemNavOrder,
  resetSystemNavOrder,
} from '@/app/actions/navSettings'
import { type NavItem, ALL_NAV_ITEMS } from '@/lib/navItems'
import { NavIcon } from '@/lib/navIcon'

type Props = {
  /** 現在のユーザー設定順序（null = 設定なし） */
  userOrder:    string[] | null
  /** 現在のシステム設定順序（null = 設定なし） */
  systemOrder:  string[] | null
  /** カスタムオブジェクトのナビアイテム */
  customItems?: NavItem[]
}

function buildItems(order: string[] | null, extraItems: NavItem[]): NavItem[] {
  const allItems       = [...ALL_NAV_ITEMS, ...extraItems]
  const map            = new Map(allItems.map((i) => [i.href, i]))
  const effectiveOrder = order ?? allItems.map((i) => i.href)
  const ordered        = effectiveOrder.filter((h) => map.has(h)).map((h) => map.get(h)!)
  const missing        = allItems.filter((i) => !effectiveOrder.includes(i.href))
  return [...ordered, ...missing]
}

export default function NavOrderEditor({ userOrder, systemOrder, customItems = [] }: Props) {
  const [items, setItems]     = useState<NavItem[]>(() => buildItems(userOrder ?? systemOrder, customItems))
  const [saved, setSaved]     = useState<'user' | 'system' | null>(null)
  const [isPending, startTransition] = useTransition()

  function move(index: number, dir: -1 | 1) {
    const next = [...items]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setItems(next)
    setSaved(null)
  }

  function handleSaveUser() {
    startTransition(async () => {
      await saveUserNavOrder(items.map((i) => i.href))
      setSaved('user')
    })
  }

  function handleSaveSystem() {
    startTransition(async () => {
      await saveSystemNavOrder(items.map((i) => i.href))
      setSaved('system')
    })
  }

  function handleResetUser() {
    startTransition(async () => {
      await resetUserNavOrder()
      setItems(buildItems(systemOrder, customItems))
      setSaved(null)
    })
  }

  function handleResetSystem() {
    startTransition(async () => {
      await resetSystemNavOrder()
      setItems(buildItems(null, customItems))
      setSaved(null)
    })
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <h2 className="text-sm font-bold text-zinc-700 mb-1">
        ナビゲーション順序
      </h2>
      <p className="text-xs text-zinc-400 mb-4">
        ↑↓ で項目を並び替えて保存してください。
      </p>

      {/* 並び替えリスト */}
      <ul className="space-y-2 mb-6">
        {items.map((item, i) => {
          const isCustom = item.href.startsWith('/objects/')
          return (
            <li
              key={item.href}
              className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5"
            >
              <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-zinc-800">{item.label}</span>
              {isCustom && (
                <span className="text-xs text-violet-500 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 shrink-0">
                  カスタム
                </span>
              )}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || isPending}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-500 transition-colors"
                  aria-label="上に移動"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1 || isPending}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-500 transition-colors"
                  aria-label="下に移動"
                >
                  ▼
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* 保存完了メッセージ */}
      {saved && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-md inline-flex items-center gap-1.5">
          <NavIcon icon="✅" className="w-4 h-4 shrink-0" /> {saved === 'user' ? 'マイ設定として' : 'システムデフォルトとして'}保存しました
        </div>
      )}

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
