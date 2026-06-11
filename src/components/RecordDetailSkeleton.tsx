/**
 * レコード詳細ページ（新2カラムレイアウト）の読み込みスケルトン。
 * 各 [id]/loading.tsx から使う（体感パフォーマンス / CLAUDE.md 方針）。
 */
export default function RecordDetailSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-7xl animate-pulse">
      {/* パンくず + アクション行 */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-40 bg-zinc-200 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-zinc-200 rounded-md" />
          <div className="h-8 w-16 bg-zinc-100 rounded-md" />
        </div>
      </div>
      {/* タイトル行 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 bg-zinc-200 rounded-lg shrink-0" />
        <div className="space-y-2 min-w-0">
          <div className="h-6 w-64 max-w-full bg-zinc-200 rounded" />
          <div className="h-3.5 w-44 bg-zinc-100 rounded" />
        </div>
      </div>
      {/* ステータスバー */}
      <div className="h-12 bg-zinc-100 rounded-lg mb-5" />
      {/* KPI 帯 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200 rounded-xl overflow-hidden mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white px-4 py-3 space-y-2">
            <div className="h-3 w-16 bg-zinc-100 rounded" />
            <div className="h-6 w-24 bg-zinc-200 rounded" />
          </div>
        ))}
      </div>
      {/* 2カラム */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[340px_1fr] items-start">
        <div className="space-y-4">
          <div className="h-72 bg-zinc-100 border border-zinc-200 rounded-xl" />
          <div className="h-36 bg-zinc-100 border border-zinc-200 rounded-xl" />
        </div>
        <div className="h-[28rem] bg-zinc-100 border border-zinc-200 rounded-xl" />
      </div>
    </div>
  )
}
