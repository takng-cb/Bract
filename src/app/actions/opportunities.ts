'use server'

import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logChanges } from '@/lib/changeLog'

export async function updateOpportunityStage(id: string, stage: string) {
  // 変更前の値を取得
  const { data: before } = await supabase
    .from('opportunities')
    .select('stage')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('opportunities')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await logChanges('opportunity', id,
    { stage: { label: 'ステージ', value: before?.stage } },
    { stage: { label: 'ステージ', value: stage } },
  )

  revalidatePath(`/opportunities/${id}`)
}

export async function createOpportunity(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('商談名は必須です')

  const amount      = formData.get('amount') as string
  const close_date  = formData.get('close_date') as string
  const probability = formData.get('probability') as string

  const { data, error } = await supabase.from('opportunities').insert({
    name:        name.trim(),
    account_id:  (formData.get('account_id') as string) || null,
    stage:       (formData.get('stage') as string) || 'prospecting',
    amount:      amount ? Number(amount) : null,
    close_date:  close_date || null,
    probability: probability ? Number(probability) : null,
    description: (formData.get('description') as string) || null,
  }).select('id').single()

  if (error) throw new Error(error.message)
  redirect(`/opportunities/${data.id}`)
}

export async function updateOpportunity(id: string, formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('商談名は必須です')

  const amount      = formData.get('amount') as string
  const close_date  = formData.get('close_date') as string
  const probability = formData.get('probability') as string
  const stage       = (formData.get('stage') as string) || 'prospecting'

  // 変更前の値を取得
  const { data: before } = await supabase
    .from('opportunities')
    .select('name, stage, amount, close_date, probability')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('opportunities').update({
    name:        name.trim(),
    account_id:  (formData.get('account_id') as string) || null,
    stage,
    amount:      amount ? Number(amount) : null,
    close_date:  close_date || null,
    probability: probability ? Number(probability) : null,
    description: (formData.get('description') as string) || null,
    updated_at:  new Date().toISOString(),
  }).eq('id', id)

  if (error) throw new Error(error.message)

  if (before) {
    await logChanges('opportunity', id,
      {
        name:        { label: '商談名',     value: before.name },
        stage:       { label: 'ステージ',   value: before.stage },
        amount:      { label: '金額',       value: before.amount },
        close_date:  { label: '完了予定日', value: before.close_date },
        probability: { label: '確度',       value: before.probability },
      },
      {
        name:        { label: '商談名',     value: name.trim() },
        stage:       { label: 'ステージ',   value: stage },
        amount:      { label: '金額',       value: amount ? Number(amount) : null },
        close_date:  { label: '完了予定日', value: close_date || null },
        probability: { label: '確度',       value: probability ? Number(probability) : null },
      },
    )
  }

  redirect(`/opportunities/${id}`)
}

export async function deleteOpportunity(id: string) {
  const { error } = await supabase.from('opportunities').delete().eq('id', id)
  if (error) throw new Error(error.message)
  redirect('/opportunities')
}
