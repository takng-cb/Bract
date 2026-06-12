'use client'

/**
 * ヘルプボタン（REQ-0055）。
 *
 * トップバーの通知ベルの横に「?」を表示し、現在のページに対応する
 * 操作マニュアル（/manual/ 配下の静的 HTML）の章へ新規タブで飛ぶ。
 * 対応の無いページは目次（index.html）へ。
 */
import { usePathname } from 'next/navigation'
import { CircleHelp } from 'lucide-react'

/** パス → マニュアルの章（先頭一致の正規表現を上から順に評価） */
const MANUAL_MAP: [RegExp, string][] = [
  // 管理者編
  [/^\/admin\/users/,          'admin.html#users'],
  [/^\/admin\/roles/,          'admin.html#roles'],
  [/^\/admin\/books/,          'admin.html#books'],
  [/^\/admin\/(modules|license)/, 'admin.html#modules'],
  [/^\/admin\/notifications/,  'admin.html#notifications'],
  [/^\/admin/,                 'admin.html'],
  [/^\/settings\/system/,      'admin.html#system'],
  [/^\/settings/,              'admin.html#settings'],
  // 板金・自動車整備編
  [/^\/maintenance/,           'auto-body.html#maintenance'],
  [/^\/customer-vehicles/,     'auto-body.html#customer-vehicles'],
  [/^\/vehicles/,              'auto-body.html#vehicles'],
  [/^\/parts/,                 'auto-body.html#parts'],
  [/^\/receivables/,           'auto-body.html#receivables'],
  // 不動産編
  [/^\/properties/,            'real-estate.html#properties'],
  // 人材手配編
  [/^\/assignments/,           'staffing.html#assignments'],
  [/^\/staff/,                 'staffing.html#staff'],
  [/^\/invoices/,              'staffing.html#invoices'],
  [/^\/quick\/staffing/,       'staffing.html#quick'],
  // 共通編
  [/^\/(accounts|contacts|books)\/[^/]+\/edit$/, 'common.html#create'],
  [/^\/(accounts|contacts|books)\/.+\/new$/,     'common.html#create'],
  [/^\/(accounts|contacts)\/new$/,               'common.html#create'],
  [/^\/(accounts|contacts)\/[^/]+/,              'common.html#detail'],
  [/^\/(accounts|contacts|books|tags)/,          'common.html#list'],
  [/^\/opportunities/,         'common.html#opportunity'],
  [/^\/forecast/,              'common.html#forecast'],
  [/^\/(activities|tasks)/,    'common.html#workspace'],
  [/^\/approvals/,             'common.html#approval'],
  [/^\/wiki/,                  'common.html#wiki'],
  [/^\/expenses/,              'common.html#expense'],
  [/^\/(products|warehouses|stock-movements)/, 'common.html#inventory'],
  [/^\/trash/,                 'common.html#trash'],
  [/^\/(dashboard|modules)/,   'common.html#layout'],
]

export function manualHrefFor(pathname: string): string {
  const hit = MANUAL_MAP.find(([re]) => re.test(pathname))
  return `/manual/${hit ? hit[1] : 'index.html'}`
}

export default function HelpButton() {
  const pathname = usePathname() ?? '/'
  return (
    <a
      href={manualHrefFor(pathname)}
      target="_blank"
      rel="noopener noreferrer"
      className="ds-icbtn"
      title="このページの使い方（マニュアル）"
      aria-label="このページの使い方（マニュアル）"
    >
      <CircleHelp className="w-4.5 h-4.5" strokeWidth={2.25} aria-hidden />
    </a>
  )
}
