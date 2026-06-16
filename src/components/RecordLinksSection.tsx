/**
 * 関連先（汎用リンク）セクション（REQ-0078・サーバコンポーネント）。
 * 詳細ページに `<RecordLinksSection selfApi="opportunity" selfId={id} />` と置くだけで、
 * 横断検索の選択肢と既存リンクを解決して RecordLinksEditor を描画する。
 */
import { Link2 } from 'lucide-react'
import RecordLinksEditor from '@/components/RecordLinksEditor'
import { getRecordLinks } from '@/lib/recordLinks'
import { getRelatedRecordsPickerData } from '@/lib/relatedRecordsPicker'

type Props = { selfApi: string; selfId: string; className?: string }

export default async function RecordLinksSection({ selfApi, selfId, className }: Props) {
  const [{ objectTypes }, links] = await Promise.all([
    getRelatedRecordsPickerData('activities'),
    getRecordLinks({ object_api: selfApi, record_id: selfId }),
  ])

  return (
    <section className={`bg-white border border-zinc-200 rounded-lg shadow-xs p-5 ${className ?? ''}`}>
      <h2 className="text-sm font-bold text-zinc-700 mb-3 inline-flex items-center gap-1.5">
        <Link2 className="w-4 h-4 text-zinc-400" aria-hidden /> 関連先
      </h2>
      <RecordLinksEditor
        selfApi={selfApi}
        selfId={selfId}
        objectTypes={objectTypes}
        initialLinks={links}
      />
    </section>
  )
}
