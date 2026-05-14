/**
 * リストページ用の汎用スケルトン。
 * 各 list 用 loading.tsx から呼んで実レイアウトに近い形でロード中表示。
 *
 * Phase A perceived performance 改善。
 */
type Props = {
  /** 見出し（ダミー） */
  title?: string
  /** 上部アクションボタン数（インポート / 新規作成等） */
  actionButtons?: number
  /** タブ表示の数（0 でタブなし） */
  tabs?: number
  /** 表示する空行数（テーブル風） */
  rows?: number
}

export default function ListPageSkeleton({
  title = '',
  actionButtons = 3,
  tabs = 0,
  rows = 10,
}: Props) {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      {/* ヘッダー: タイトル + アクションボタン群 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-8 w-32 bg-zinc-200 rounded mb-2">
            <span className="invisible">{title}</span>
          </div>
          <div className="h-4 w-20 bg-zinc-100 rounded" />
        </div>
        <div className="flex items-center gap-3">
          {Array.from({ length: actionButtons }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-zinc-200 rounded" />
          ))}
        </div>
      </div>

      {/* タブ */}
      {tabs > 0 && (
        <div className="flex gap-1 mb-4 border-b border-zinc-200">
          {Array.from({ length: tabs }).map((_, i) => (
            <div key={i} className="h-9 w-32 bg-zinc-100 rounded-t" />
          ))}
        </div>
      )}

      {/* Saved views パネル + ListViewToolbar */}
      <div className="h-10 w-full bg-zinc-100 rounded mb-3" />
      <div className="h-10 w-full bg-zinc-100 rounded mb-4" />

      {/* テーブル行（スケルトン） */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-zinc-100 rounded" />
        ))}
      </div>
    </div>
  )
}
