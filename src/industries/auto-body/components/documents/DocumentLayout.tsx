'use client'

/**
 * 帳票印刷用の共通レイアウト。
 *
 * - 画面上部に 印刷ボタン + 戻るリンク（@media print で非表示）
 * - 本体は A4 想定の固定幅 (210mm)、中央寄せ
 * - 印刷時は不要な chrome / ナビ / ボタンを隠す
 *
 * 子コンポーネントから渡された children を A4 サイズの白い「紙」枠に
 * そのまま流す。複数枚に渡る場合は内部で page-break-after を入れる。
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

type Props = {
  /** 表示用タイトル（プリント時はヘッダ右上にも表示） */
  title: string
  /** 元の整備レコード ID（戻るリンク用） */
  maintenanceId: string
  children: ReactNode
}

export default function DocumentLayout({ title, maintenanceId, children }: Props) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">
      {/* 印刷時には消える操作バー */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-zinc-600 hover:text-blue-600"
          >
            ← 戻る
          </button>
          <span className="text-zinc-300">|</span>
          <Link href={`/maintenance/${maintenanceId}`} className="text-sm text-zinc-600 hover:text-blue-600">
            整備ページへ
          </Link>
          <span className="text-zinc-300">|</span>
          <Link href={`/maintenance/${maintenanceId}/documents`} className="text-sm text-zinc-600 hover:text-blue-600">
            帳票一覧
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700">{title}</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm"
          >
            🖨️ 印刷 / PDF 保存
          </button>
        </div>
      </div>

      {/* 印刷用ヒント（画面のみ） */}
      <div className="print:hidden text-center text-xs text-zinc-500 py-2 px-4">
        ブラウザの「印刷」ダイアログから「PDF として保存」を選ぶと PDF 化できます。用紙: A4 縦 / 余白: 標準
      </div>

      {/* A4 用紙風の本体 */}
      <div className="flex justify-center px-4 print:px-0 print:py-0 pb-12">
        <div
          className="bg-white shadow-lg print:shadow-none my-4 print:my-0 p-12 print:p-8 text-zinc-900"
          style={{
            width:    '210mm',
            minHeight:'297mm',
          }}
        >
          {children}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 14mm;
          }
          html, body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
