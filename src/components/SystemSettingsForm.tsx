'use client'

import { useActionState } from 'react'
import { saveSystemSettings } from '@/app/actions/settings'
import { NavIcon } from '@/lib/navIcon'
import { useActionToast } from '@/components/Toast'

const TIMEZONES = [
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Bangkok',
  'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Europe/London', 'Europe/Paris',
  'America/New_York', 'America/Los_Angeles', 'UTC',
] as const

type Props = {
  current: {
    company_name:            string
    password_min_length:     string
    session_timeout_minutes: string
    allow_self_registration: string
    fiscal_year_start:       string
    timezone:                string
  }
}

export default function SystemSettingsForm({ current }: Props) {
  const [state, formAction, pending] = useActionState(saveSystemSettings, null)
  // 保存結果はトーストで通知（REQ-0057。フォームが縦長で inline 成功表示は保存ボタンから見えないため廃止。エラーは残す）
  useActionToast(pending, state, { success: 'システム設定を保存しました' })

  const errorMsg = state?.startsWith('error:') ? state.slice(6) : null

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
      <h2 className="text-sm font-bold text-zinc-700 mb-1">
        システム設定
      </h2>
      <p className="text-xs text-zinc-400 mb-5">全ユーザーに影響する設定です</p>

      <form action={formAction} className="space-y-6">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {errorMsg}
          </div>
        )}

        {/* 基本設定 */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-zinc-600 border-b border-zinc-100 pb-2 inline-flex items-center gap-1.5"><NavIcon icon="🏢" className="w-3.5 h-3.5" /> 基本情報</p>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">会社名・サービス名</label>
            <input
              type="text"
              name="company_name"
              defaultValue={current.company_name}
              placeholder="Bract"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-400 mt-1">サイドバーのロゴ下に表示されます</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">会計年度開始月</label>
            <select
              name="fiscal_year_start"
              defaultValue={current.fiscal_year_start}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>{i + 1}月</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">タイムゾーン</label>
            <select
              name="timezone"
              defaultValue={current.timezone}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <p className="text-xs text-zinc-400 mt-1">作成日時・活動日時などの表示に使うタイムゾーンです（既定: Asia/Tokyo）</p>
          </div>
        </div>

        {/* セキュリティ設定 */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-zinc-600 border-b border-zinc-100 pb-2 inline-flex items-center gap-1.5"><NavIcon icon="🔒" className="w-3.5 h-3.5" /> セキュリティ</p>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">パスワード最低文字数</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="password_min_length"
                defaultValue={current.password_min_length}
                min={6}
                max={128}
                className="w-24 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-500">文字以上（6〜128）</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              セッションタイムアウト
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="session_timeout_minutes"
                defaultValue={current.session_timeout_minutes}
                min={0}
                className="w-24 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-500">分（0 = タイムアウトなし）</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              指定した時間操作がない場合、自動的にログアウトします。設定変更は次回ログイン時から有効です。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">ユーザー自己登録</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allow_self_registration"
                id="allow_self_registration"
                defaultChecked={current.allow_self_registration === 'true'}
                value="true"
                className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="allow_self_registration" className="text-sm text-zinc-700">
                ユーザーが自分でアカウントを登録できるようにする
              </label>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              無効の場合、管理者がSupabaseダッシュボードからユーザーを追加してください
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-md hover:bg-zinc-900 transition-colors disabled:opacity-50"
        >
          {pending ? '保存中...' : 'システム設定を保存'}
        </button>
      </form>
    </div>
  )
}
