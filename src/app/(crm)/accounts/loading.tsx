export default function AccountsLoading() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-8 w-24 bg-zinc-200 rounded mb-2" />
          <div className="h-4 w-16 bg-zinc-100 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 bg-zinc-200 rounded" />
          <div className="h-9 w-24 bg-zinc-200 rounded" />
        </div>
      </div>
      <div className="h-10 w-full bg-zinc-100 rounded mb-3" />
      <div className="h-10 w-full bg-zinc-100 rounded mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-zinc-100 rounded" />
        ))}
      </div>
    </div>
  )
}
