import ListPageSkeleton from '@/components/ListPageSkeleton'

export default function AdminAuditLogLoading() {
  // 監査ログはフィルタフォームを最初に表示 + 行
  return <ListPageSkeleton actionButtons={0} tabs={0} rows={12} />
}
