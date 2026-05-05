'use client'

import TextImportModal from './TextImportModal'

type Props = {
  exportUrl:    string
  importUrl:    string
  label:        string
  csvFormat:    string   // インポートモーダル内に表示するフォーマット文字列
  showImport?:  boolean
}

export default function CsvToolbar({
  exportUrl,
  importUrl,
  label,
  csvFormat,
  showImport = true,
}: Props) {
  return (
    <div className="hidden md:flex items-center gap-2">
      {/* エクスポート */}
      <a
        href={exportUrl}
        download
        className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
      >
        ↓ エクスポート
      </a>

      {/* インポート（ファイル／テキスト統一モーダル） */}
      {showImport && (
        <TextImportModal
          importUrl={importUrl}
          title={`${label}をインポート`}
          csvFormat={csvFormat}
        />
      )}
    </div>
  )
}
