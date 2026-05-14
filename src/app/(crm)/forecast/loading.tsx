/**
 * 売上予測ページのスケルトン。
 * - ヘッダ + 期間ボタン
 * - KPI 4 枚 (想定売上 / 受注済 / 経費 / 想定粗利)
 * - グラフ 2 枚 (折れ線 + 積み上げ棒)
 * - 担当者別サマリー
 * - 対象商談 + 経費
 */
export default function ForecastLoading() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      {/* ヘッダ */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="h-8 w-32 bg-zinc-200 rounded mb-2" />
          <div className="h-4 w-48 bg-zinc-100 rounded" />
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
          <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="h-3 w-20 bg-zinc-100 rounded mb-2" />
            <div className="h-8 w-24 bg-zinc-200 rounded mb-2" />
            <div className="h-3 w-16 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* グラフ 2 枚 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="h-5 w-32 bg-zinc-200 rounded mb-3" />
            <div className="h-64 w-full bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* 担当者別サマリー */}
      <div className="mb-6">
        <div className="h-5 w-32 bg-zinc-200 rounded mb-3" />
        <div className="bg-white border border-zinc-200 rounded-lg p-6 text-center">
          <div className="h-4 w-40 bg-zinc-100 rounded mx-auto" />
        </div>
      </div>

      {/* 対象商談 + 経費 (2 カラム) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i}>
            <div className="h-5 w-24 bg-zinc-200 rounded mb-3" />
            <div className="bg-white border border-zinc-200 rounded-lg p-6 text-center">
              <div className="h-4 w-48 bg-zinc-100 rounded mx-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
