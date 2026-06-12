'use client'

/**
 * デスクトップ用トップバー（Claude Design モックアップ再現 / REQ-0020）
 * グローバル検索ボックス（横断ライブ検索ドロップダウン）＋クイック操作＋通知ベル。
 *
 * 検索は globalSearch サーバアクション（取引先・人物・商談＋有効モジュールの主要ブック）。
 * デバウンスして呼び出し、グループ別の結果を出す。Enter で先頭ヒットへ遷移。
 */
import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Sprout, Loader2 } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import { globalSearch, type SearchGroup } from '@/app/actions/search'
import NotificationsBell from '@/components/NotificationsBell'
import HelpButton from '@/components/HelpButton'

export default function Topbar() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const boxRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  // デバウンス検索（同期 setState を避けるため、クリアも setTimeout 内で行う）
  useEffect(() => {
    const term = q.trim()
    const myId = ++reqId.current
    const t = setTimeout(() => {
      if (reqId.current !== myId) return
      if (term.length < 1) { setGroups([]); setOpen(false); return }
      startTransition(async () => {
        const res = await globalSearch(term)
        if (reqId.current !== myId) return // 古いレスポンスは破棄
        setGroups(res)
        setOpen(true)
      })
    }, term.length < 1 ? 0 : 250)
    return () => clearTimeout(t)
  }, [q])

  // 外側クリックで閉じる
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const firstHref = groups[0]?.hits[0]?.href
  const totalHits = groups.reduce((n, g) => n + g.hits.length, 0)

  const go = (href: string) => {
    setOpen(false)
    setQ('')
    setGroups([])
    router.push(href)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (firstHref) go(firstHref)
  }

  return (
    <div className="ds-topbar hidden md:flex print:hidden">
      <div ref={boxRef} className="relative">
        <form onSubmit={onSubmit} className="contents">
          <div className="ds-searchbox">
            {pending
              ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-zinc-400" aria-hidden />
              : <Search className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (groups.length) setOpen(true) }}
              placeholder="検索…（取引先・人物・商談 など）"
              aria-label="検索"
            />
          </div>
        </form>

        {open && (
          <div className="absolute left-0 top-full mt-1.5 w-104 max-h-[70vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg z-50 py-1.5">
            {totalHits === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-400">
                {pending ? '検索中…' : `「${q.trim()}」に一致するレコードはありません`}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.type} className="px-1.5 py-1">
                  <p className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                    <NavIcon icon={g.icon} className="w-3.5 h-3.5" /> {g.label}
                  </p>
                  {g.hits.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); go(h.href) }}
                      className="w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-zinc-900 truncate">{h.label}</span>
                        {h.sub && <span className="block text-[11px] text-zinc-400 truncate">{h.sub}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* クイック操作（グローバル検索の横）。モーダルは QuickLauncher がイベントで開く */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('bract:quick-open'))}
        data-testid="quick-launcher-open"
        title="クイック操作"
        className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        <Sprout className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="hidden lg:inline">クイック</span>
      </button>
      <div className="flex-1" />
      {/* 現在ページのマニュアル章へ（REQ-0055） */}
      <HelpButton />
      <NotificationsBell />
    </div>
  )
}
