'use client'

/**
 * デスクトップ用トップバー（Claude Design モックアップ再現 / REQ-0020）
 * グローバル検索ボックス＋通知ベル。design-system.css の .ds-topbar 等を使用。
 * （検索の実バックエンド配線は今後。現状は取引先一覧へ遷移するシンプル版）
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell } from 'lucide-react'

export default function Topbar() {
  const router = useRouter()
  const [q, setQ] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    // 当面は取引先一覧へ（将来グローバル検索に差し替え）
    router.push(`/accounts?q=${encodeURIComponent(term)}`)
  }

  return (
    <div className="ds-topbar hidden md:flex print:hidden">
      <form onSubmit={onSearch} className="contents">
        <div className="ds-searchbox">
          <Search className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索…（取引先・人物・商談 など）"
            aria-label="検索"
          />
        </div>
      </form>
      <div className="flex-1" />
      <button type="button" className="ds-icbtn" title="通知" aria-label="通知">
        <Bell className="w-[18px] h-[18px]" strokeWidth={2.25} aria-hidden />
        <span className="dot" />
      </button>
    </div>
  )
}
