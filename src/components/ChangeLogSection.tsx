import { supabase } from '@/lib/supabase'
import { formatLogValue } from '@/lib/changeLog'

type Props = {
  objectType: string
  objectId: string
}

export default async function ChangeLogSection({ objectType, objectId }: Props) {
  const { data: logs } = await supabase
    .from('change_logs')
    .select('id, field_label, field_name, old_value, new_value, changed_at')
    .eq('object_type', objectType)
    .eq('object_id', objectId)
    .order('changed_at', { ascending: false })
    .limit(30)

  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-4">変更履歴がありません</p>
    )
  }

  return (
    <div className="divide-y divide-zinc-100">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 py-2.5 px-1">
          {/* タイムライン点 */}
          <div className="mt-1.5 w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium text-zinc-700">{log.field_label}</span>
              <span className="text-xs text-zinc-400">を変更</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs">
              {log.old_value != null ? (
                <span className="text-zinc-400 line-through">
                  {formatLogValue(log.field_name, log.old_value)}
                </span>
              ) : (
                <span className="text-zinc-300">—</span>
              )}
              <span className="text-zinc-300">→</span>
              <span className="text-zinc-800 font-medium">
                {formatLogValue(log.field_name, log.new_value)}
              </span>
            </div>
          </div>
          <span className="text-xs text-zinc-400 whitespace-nowrap shrink-0 mt-0.5">
            {new Date(log.changed_at).toLocaleDateString('ja-JP', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
      ))}
    </div>
  )
}
