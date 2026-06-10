import type { ReactNode } from 'react'

/**
 * 新規作成・編集フォームのセクションカード（design_handoff/Bract *Form.html 準拠）。
 *
 * - 1 セクション = 1 カード（白・border-zinc-200・rounded-xl・shadow-xs）。
 * - 見出しは「バー＋タイトル＋ルール」（detail ページの EditableInfoCard と同系統）。
 * - `action` でセクション右側に補助操作（FormFillModal / バッジ等）を置ける。
 *
 * server component（フック無し）。client フォームからも入れ子で利用可。
 */
export default function FormSection({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`bg-white border border-zinc-200 rounded-xl shadow-xs p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-brand-500 shrink-0" />
        <h3 className="text-sm font-bold text-zinc-700 tracking-wide">{title}</h3>
        <div className="flex-1 h-px bg-zinc-200" />
        {action}
      </div>
      {children}
    </section>
  )
}
