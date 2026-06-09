/**
 * 添付ファイルセクション (汎用) — #46 関連
 *
 * 親オブジェクト (account / contact / opportunity / activity /
 * maintenance / customer_vehicle) の詳細ページに埋め込む。
 *
 * - 画像 (image/*) はサムネイル表示
 * - その他は 📄 アイコン + ファイル名
 * - editor 以上のロールならアップロード / 削除可能
 *
 * Server Component として使い、削除/アップロードはバインド済 Server
 * Action を props 経由で受け取る (parent 側で id を closure に閉じる)。
 */
import AuthGuard from '@/components/AuthGuard'
import { NavIcon } from '@/lib/navIcon'

type Attachment = {
  id:           string
  file_name:    string
  storage_path: string
  file_size:    number | null
  content_type: string | null
  created_at:   Date | string | null
}

type Props = {
  attachments:    Attachment[]
  supabaseUrl:    string         // 既存と同様、public URL を組み立てる
  uploadAction:   (fd: FormData) => Promise<void>
  deleteAction:   (fd: FormData) => Promise<void>
  /** 見出しの語尾 — 「整備」「車両」など。デフォルト「添付ファイル」 */
  heading?:       string
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function AttachmentsSection({
  attachments, supabaseUrl, uploadAction, deleteAction, heading = '添付ファイル',
}: Props) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-800">
          <NavIcon icon="📎" className="w-4 h-4" />{heading} <span className="text-zinc-400 font-normal text-sm">({attachments.length})</span>
        </h2>
      </div>
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {attachments.length > 0 && (
          <div className="divide-y divide-zinc-100">
            {attachments.map((f) => {
              const url     = `${supabaseUrl}/storage/v1/object/public/attachments/${f.storage_path}`
              const isImage = (f.content_type ?? '').startsWith('image/')
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  {isImage ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={f.file_name}
                        className="w-12 h-12 object-cover rounded border border-zinc-200 bg-zinc-50"
                      />
                    </a>
                  ) : (
                    <NavIcon icon="📄" className="w-6 h-6 shrink-0 text-zinc-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {f.file_name}
                    </a>
                    <p className="text-xs text-zinc-400">
                      {formatFileSize(f.file_size)}
                      {f.created_at && ` · ${new Date(f.created_at).toLocaleDateString('ja-JP')}`}
                      {f.content_type && ` · ${f.content_type}`}
                    </p>
                  </div>
                  <AuthGuard minRole="editor">
                    <form action={deleteAction}>
                      <input type="hidden" name="attach_id"    value={f.id} />
                      <input type="hidden" name="storage_path" value={f.storage_path} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
                    </form>
                  </AuthGuard>
                </div>
              )
            })}
          </div>
        )}
        <AuthGuard minRole="editor">
          <form action={uploadAction} className="px-4 py-3 border-t border-zinc-100 flex items-center gap-3">
            <input
              type="file"
              name="file"
              className="flex-1 text-sm text-zinc-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shrink-0"
            >
              アップロード
            </button>
          </form>
        </AuthGuard>
      </div>
    </section>
  )
}
