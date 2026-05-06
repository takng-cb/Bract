import { getSavedViews } from '@/lib/savedViews'
import { getCurrentUserId, isAdmin as getIsAdmin } from '@/lib/auth'
import {
  createSavedView,
  deleteSavedView,
  setDefaultView,
  clearDefaultView,
} from '@/app/actions/savedViews'
import SavedViewsClient from './SavedViewsClient'

type Props = {
  objectType: string
  basePath: string
  currentFilterRaw: string[]
  currentGroup: string
  persistParams?: Record<string, string>
}

export default async function SavedViewsPanel({
  objectType,
  basePath,
  currentFilterRaw,
  currentGroup,
  persistParams,
}: Props) {
  const [userId, admin] = await Promise.all([getCurrentUserId(), getIsAdmin()])
  const views = await getSavedViews(objectType, userId)

  // ────── inline server actions（objectType / basePath をクロージャで束縛） ──────

  async function createAction(
    name: string,
    filterParams: string[],
    groupParams: string,
    scope: 'user' | 'system',
  ) {
    'use server'
    await createSavedView(objectType, name, filterParams, groupParams, scope, basePath)
  }

  async function deleteAction(id: string) {
    'use server'
    await deleteSavedView(id, basePath)
  }

  async function setDefaultAction(id: string, scope: 'user' | 'system') {
    'use server'
    await setDefaultView(id, objectType, scope, basePath)
  }

  async function clearDefaultAction(scope: 'user' | 'system') {
    'use server'
    await clearDefaultView(objectType, scope, basePath)
  }

  // ビューなし かつ 現在の条件もなし → 何も表示しない
  if (views.length === 0 && currentFilterRaw.length === 0 && !currentGroup) return null

  return (
    <SavedViewsClient
      views={views}
      basePath={basePath}
      currentFilterRaw={currentFilterRaw}
      currentGroup={currentGroup}
      persistParams={persistParams}
      isAdmin={admin}
      userId={userId}
      createAction={createAction}
      deleteAction={deleteAction}
      setDefaultAction={setDefaultAction}
      clearDefaultAction={clearDefaultAction}
    />
  )
}
