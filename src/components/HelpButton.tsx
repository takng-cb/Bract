'use client'

/**
 * ヘルプボタン（REQ-0055 / REQ-0056）。
 *
 * トップバーの通知ベルの横に「?」を表示し、現在のページに対応する
 * マニュアルの章を**右からのスライドパネル（ポップアップ）**で表示する。
 * ページを離れないので PWA（インストール版）でも迷子にならない。
 * パネル内は /help-embed/<page> の iframe（編をまたぐ閲覧も可能）。
 * じっくり読みたい時はパネル右上の「全画面で開く」→ /help/<page>。
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleHelp, ExternalLink, X } from 'lucide-react'

/** パス → マニュアルの章（先頭一致の正規表現を上から順に評価） */
const MANUAL_MAP: [RegExp, string][] = [
  // 管理者編
  [/^\/admin\/users/,          'admin#users'],
  [/^\/admin\/roles/,          'admin#roles'],
  [/^\/admin\/books/,          'admin#books'],
  [/^\/admin\/(modules|license)/, 'admin#modules'],
  [/^\/admin\/notifications/,  'admin#notifications'],
  [/^\/admin/,                 'admin'],
  [/^\/settings\/system/,      'admin#system'],
  [/^\/settings/,              'admin#settings'],
  // 板金・自動車整備編
  [/^\/maintenance/,           'auto-body#maintenance'],
  [/^\/customer-vehicles/,     'auto-body#customer-vehicles'],
  [/^\/vehicles/,              'auto-body#vehicles'],
  [/^\/parts/,                 'auto-body#parts'],
  [/^\/receivables/,           'auto-body#receivables'],
  // 不動産編
  [/^\/properties/,            'real-estate#properties'],
  // 人材手配編
  [/^\/assignments/,           'staffing#assignments'],
  [/^\/staff/,                 'staffing#staff'],
  [/^\/invoices/,              'staffing#invoices'],
  [/^\/quick\/staffing/,       'staffing#quick'],
  // 共通編
  [/^\/(accounts|contacts|books)\/[^/]+\/edit$/, 'common#create'],
  [/^\/(accounts|contacts|books)\/.+\/new$/,     'common#create'],
  [/^\/(accounts|contacts)\/new$/,               'common#create'],
  [/^\/(accounts|contacts)\/[^/]+/,              'common#detail'],
  [/^\/(accounts|contacts|books|tags)/,          'common#list'],
  [/^\/opportunities/,         'common#opportunity'],
  [/^\/forecast/,              'common#forecast'],
  [/^\/(activities|tasks)/,    'common#workspace'],
  [/^\/approvals/,             'common#approval'],
  [/^\/wiki/,                  'common#wiki'],
  [/^\/expenses/,              'common#expense'],
  [/^\/(products|warehouses|stock-movements)/, 'common#inventory'],
  [/^\/trash/,                 'common#trash'],
  [/^\/(dashboard|modules)/,   'common#layout'],
]

/** 現在の pathname に対応する章（'common#list' 形式）。対応が無ければ目次 */
export function manualSectionFor(pathname: string): string {
  const hit = MANUAL_MAP.find(([re]) => re.test(pathname))
  return hit ? hit[1] : 'index'
}

export default function HelpButton() {
  const pathname = usePathname() ?? '/'
  const [open, setOpen] = useState(false)

  const section = manualSectionFor(pathname)
  const embedSrc = `/help-embed/${section}`
  const fullHref = `/help/${section}`

  // Escape で閉じる
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ds-icbtn"
        title="このページの使い方（マニュアル）"
        aria-label="このページの使い方（マニュアル）"
        aria-expanded={open}
      >
        <CircleHelp className="w-4.5 h-4.5" strokeWidth={2.25} aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          {/* 右スライドパネル */}
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 shrink-0">
              <CircleHelp className="w-4 h-4 text-brand-700 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="text-sm font-bold text-zinc-800">操作マニュアル</span>
              <div className="flex-1" />
              <Link
                href={fullHref}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-800"
                title="全画面で開く"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden />全画面で開く
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="ml-1 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="w-4.5 h-4.5" aria-hidden />
              </button>
            </div>
            {/* 本文（/help-embed をそのまま表示。編をまたぐリンクもパネル内で完結） */}
            <iframe
              key={embedSrc}
              src={embedSrc}
              title="操作マニュアル"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </>
  )
}
