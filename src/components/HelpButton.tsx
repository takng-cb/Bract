'use client'

/**
 * ヘルプボタン（REQ-0055 / REQ-0056）。
 *
 * トップバーの通知ベルの横に「?」を表示し、現在のページに対応する
 * アプリ内マニュアル（/help/<page>#章）へ遷移する。
 * アプリ内遷移なので PWA（インストール版）でも戻れる。対応の無いページは目次へ。
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleHelp } from 'lucide-react'

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

export function manualHrefFor(pathname: string): string {
  const hit = MANUAL_MAP.find(([re]) => re.test(pathname))
  return `/help/${hit ? hit[1] : 'index'}`
}

export default function HelpButton() {
  const pathname = usePathname() ?? '/'
  // /help 内では現在ページではなく目次へ
  const href = pathname.startsWith('/help') ? '/help/index' : manualHrefFor(pathname)
  return (
    <Link
      href={href}
      className="ds-icbtn"
      title="このページの使い方（マニュアル）"
      aria-label="このページの使い方（マニュアル）"
    >
      <CircleHelp className="w-4.5 h-4.5" strokeWidth={2.25} aria-hidden />
    </Link>
  )
}
