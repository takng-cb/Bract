'use server'

import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logChanges } from '@/lib/changeLog'

export async function updateAccountStatus(id: string, status: string) {
  const { data: before } = await supabase
    .from('accounts').select('status').eq('id', id).single()

  const { error } = await supabase
    .from('accounts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await logChanges('account', id,
    { status: { label: 'ステータス', value: before?.status } },
    { status: { label: 'ステータス', value: status } },
  )
  revalidatePath(`/accounts/${id}`)
}

export async function createAccount(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('会社名は必須です')

  const annual_revenue = formData.get('annual_revenue') as string
  const employee_count = formData.get('employee_count') as string

  const { data, error } = await supabase.from('accounts').insert({
    name:           name.trim(),
    type:           (formData.get('type') as string) || null,
    industry:       (formData.get('industry') as string) || null,
    phone:          (formData.get('phone') as string) || null,
    website:        (formData.get('website') as string) || null,
    address:        (formData.get('address') as string) || null,
    annual_revenue: annual_revenue ? Number(annual_revenue) : null,
    employee_count: employee_count ? Number(employee_count) : null,
    description:    (formData.get('description') as string) || null,
    status:         (formData.get('status') as string) || 'active',
  }).select('id').single()

  if (error) throw new Error(error.message)
  redirect(`/accounts/${data.id}`)
}

export async function updateAccount(id: string, formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('会社名は必須です')

  const annual_revenue = formData.get('annual_revenue') as string
  const employee_count = formData.get('employee_count') as string
  const status         = (formData.get('status') as string) || 'active'
  const type           = (formData.get('type') as string) || null

  const { data: before } = await supabase
    .from('accounts')
    .select('name, status, type, industry, annual_revenue, employee_count')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('accounts').update({
    name:           name.trim(),
    type,
    industry:       (formData.get('industry') as string) || null,
    phone:          (formData.get('phone') as string) || null,
    website:        (formData.get('website') as string) || null,
    address:        (formData.get('address') as string) || null,
    annual_revenue: annual_revenue ? Number(annual_revenue) : null,
    employee_count: employee_count ? Number(employee_count) : null,
    description:    (formData.get('description') as string) || null,
    status,
    updated_at:     new Date().toISOString(),
  }).eq('id', id)

  if (error) throw new Error(error.message)

  if (before) {
    await logChanges('account', id,
      {
        name:           { label: '会社名',     value: before.name },
        status:         { label: 'ステータス', value: before.status },
        type:           { label: '種別',       value: before.type },
        industry:       { label: '業種',       value: before.industry },
        annual_revenue: { label: '年間売上',   value: before.annual_revenue },
        employee_count: { label: '従業員数',   value: before.employee_count },
      },
      {
        name:           { label: '会社名',     value: name.trim() },
        status:         { label: 'ステータス', value: status },
        type:           { label: '種別',       value: type },
        industry:       { label: '業種',       value: (formData.get('industry') as string) || null },
        annual_revenue: { label: '年間売上',   value: annual_revenue ? Number(annual_revenue) : null },
        employee_count: { label: '従業員数',   value: employee_count ? Number(employee_count) : null },
      },
    )
  }

  redirect(`/accounts/${id}`)
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  redirect('/accounts')
}
