import ListPageSkeleton from '@/components/ListPageSkeleton'

export default function PropertiesLoading() {
  // 物件・商品ページは「不動産 / その他商品」の 2 タブ構成
  return <ListPageSkeleton actionButtons={3} tabs={2} rows={10} />
}
