/**
 * /help-embed/[page] — ヘルプポップアップ（iframe）用のマニュアル表示（REQ-0056）。
 *
 * (crm) レイアウトの外に置くことでサイドバー等のアプリ chrome を含めず、
 * 「?」ボタンのスライドパネル内 iframe から読み込む。ページ間リンクは
 * /help-embed/* に書き換えられるため、パネル内で編をまたいで読み回せる。
 * 認証は middleware（全パス対象）で担保される。
 */
import { notFound } from 'next/navigation'
import { isHelpPage, loadHelpContent } from '@/lib/helpManual'

export const dynamic = 'force-dynamic'

export default async function HelpEmbedPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params
  if (!isHelpPage(page)) notFound()
  const content = await loadHelpContent(page, '/help-embed')
  if (!content) notFound()

  return (
    <>
      {/* マニュアル共通スタイル（.bract-manual スコープ・静的版と共用） */}
      {/* eslint-disable-next-line @next/next/no-css-tags -- public 配下の静的 CSS をスタンドアロン版と共用するため */}
      <link rel="stylesheet" href="/manual/manual.css" />
      <div className="bract-manual">
        {/* パネル幅に合わせて余白は控えめにする */}
        <main style={{ padding: '16px 18px 60px' }} dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </>
  )
}
