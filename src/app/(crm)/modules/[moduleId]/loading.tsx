/** モジュール別ダッシュボードの読み込みスケルトン（状況ボードの DB 取得中の体感パフォーマンス）。 */
export default function ModuleDashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-pulse">
      <div className="h-7 w-40 bg-zinc-200 rounded mb-6" />
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="h-24 bg-zinc-100 rounded-lg" />
        <div className="h-24 bg-zinc-100 rounded-lg" />
      </div>
      <div className="h-48 bg-zinc-100 rounded-lg mb-8" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-zinc-100 rounded-xl" />)}
      </div>
    </div>
  )
}
