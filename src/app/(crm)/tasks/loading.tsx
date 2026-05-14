import ListPageSkeleton from '@/components/ListPageSkeleton'

export default function TasksLoading() {
  return <ListPageSkeleton actionButtons={3} tabs={0} rows={10} />
}
