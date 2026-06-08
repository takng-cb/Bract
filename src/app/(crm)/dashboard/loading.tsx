/**
 * ダッシュボードのスケルトン。
 * - ヘッダ + 期間ボタン群
 * - KPI 4 枚 (取引先 / ToDo / 商談 / 想定売上)
 * - 期間内ToDo + 期間内活動 の 2 カラム
 * - 期間内商談
 * - 最近更新されたレコード
 */
export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      {/* ヘッダ */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="h-8 w-40 bg-zinc-200 rounded mb-2" />
          <div className="h-4 w-32 bg-zinc-100 rounded" />
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-16 bg-zinc-200 rounded" />
          ))}
          <div className="h-9 w-32 bg-zinc-200 rounded ml-2" />
          <div className="h-9 w-32 bg-zinc-200 rounded" />
          <div className="h-9 w-16 bg-zinc-200 rounded" />
        </div>
      </div>

      {/* KPI 4 枚 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
            <div className="h-3 w-24 bg-zinc-100 rounded mb-2" />
            <div className="h-8 w-16 bg-zinc-200 rounded mb-2" />
            <div className="h-3 w-20 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* 期間内 ToDo + 活動 (2 カラム) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {Array.from({ length: 2 }).map((_, c) => (
          <div key={c}>
            <div className="h-5 w-24 bg-zinc-200 rounded mb-3" />
            <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 w-full bg-zinc-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 期間内 商談 */}
      <div className="mb-6">
        <div className="h-5 w-24 bg-zinc-200 rounded mb-3" />
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 text-center">
          <div className="h-4 w-48 bg-zinc-100 rounded mx-auto" />
        </div>
      </div>

      {/* 最近更新されたレコード */}
      <div>
        <div className="h-5 w-40 bg-zinc-200 rounded mb-3" />
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-zinc-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
