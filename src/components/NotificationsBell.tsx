'use client'

/**
 * 通知ベル（REQ-0040・既読タイムスタンプ方式）
 *
 * - マウント時に fetchNotifications で集計（自分が承認すべき承認待ち＋期限ToDo）
 * - 未読（最終閲覧より新しい項目）があれば赤ドット
 * - 開いたら markNotificationsSeen で全既読（ドット消灯）。項目クリックで該当レコードへ
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ShieldAlert, CalendarClock, Loader2 } from 'lucide-react'
import { fetchNotifications, markNotificationsSeen, type NotificationItem } from '@/app/actions/notifications'

export default function NotificationsBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unseen, setUnseen] = useState(0)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pending, startTransition] = useTransition()
  const boxRef = useRef<HTMLDivElement>(null)

  // 初回マウント時にドット用の集計を取得
  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await fetchNotifications()
        setItems(res.items)
        setUnseen(res.unseenCount)
        setLoaded(true)
      } catch { /* 未ログイン等は無視 */ }
    })
  }, [])

  // 外側クリックで閉じる
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      // 開いたら最新を再取得しつつ既読化（ドット消灯）
      startTransition(async () => {
        try {
          const res = await fetchNotifications()
          setItems(res.items)
          await markNotificationsSeen()
          setUnseen(0)
        } catch { /* ignore */ }
      })
    }
  }

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={toggle} className="ds-icbtn" title="通知" aria-label="通知" aria-expanded={open}>
        <Bell className="w-4.5 h-4.5" strokeWidth={2.25} aria-hidden />
        {loaded && unseen > 0 && <span className="dot" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-88 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg z-50 py-1.5">
          <p className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">通知</p>
          {pending && items.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> 読み込み中…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">対応が必要な通知はありません</p>
          ) : (
            items.map((n, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go(n.href) }}
                className="w-full text-left flex items-start gap-2.5 px-3.5 py-2 hover:bg-zinc-50"
              >
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${n.kind === 'approval' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                  {n.kind === 'approval'
                    ? <ShieldAlert className="w-4 h-4" strokeWidth={2.25} aria-hidden />
                    : <CalendarClock className="w-4 h-4" strokeWidth={2.25} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900">{n.label}</span>
                  {n.sub && <span className="block truncate text-[11px] text-zinc-400">{n.sub}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
