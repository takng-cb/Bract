/**
 * properties オブジェクトに対して migrate-properties-to-custom.mjs が登録した
 * schema 列の複製 book_fields と、それに連動する custom_field_values を削除する。
 *
 * 背景:
 *   migrate-properties-to-custom.mjs は properties テーブルの各列を
 *   book_fields に複製登録し、過去の物件 CRUD でその custom_field_values
 *   にも同じ値を書き込んでいた。結果として物件詳細ページで「専用 UI」と
 *   「カスタムフィールドカード」の両方に同じ情報が表示される二重表示バグの
 *   原因となっていた。
 *
 *   修正後のコードは properties に対して getCustomFieldsWithValues /
 *   saveCustomFieldValues を呼ばないため、DB に残った既存データを掃除する。
 *
 * 実行:
 *   npx tsx scripts/cleanup-properties-custom-fields.ts            (確認のみ)
 *   npx tsx scripts/cleanup-properties-custom-fields.ts --execute  (実削除)
 *
 * 安全策:
 *   - properties テーブルには一切触れない
 *   - book_definitions の 'properties' 行も削除しない（サイドバー・リレーション参照は維持）
 *   - 削除対象は book_fields (object_id = properties) と
 *     対応する custom_field_values (field_id IN ...) のみ
 *   - --execute を付けないとカウントだけ表示する dry-run モード
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL が .env.local に未設定です'); process.exit(1) }

const sql = neon(url)
const isExecute = process.argv.includes('--execute')

async function main() {
  console.log(isExecute ? '🚨 EXECUTE モード（実際に削除します）\n' : '🔍 DRY-RUN モード（カウントのみ）\n')

  // 'properties' object id を取得
  const objs = await sql`SELECT id FROM book_definitions WHERE api_name = 'properties' LIMIT 1`
  if (objs.length === 0) {
    console.log('book_definitions に properties が無いため、削除対象なし。終了。')
    return
  }
  const propertiesObjectId = objs[0].id as string
  console.log(`📍 properties object_id = ${propertiesObjectId}`)

  // 対象 book_fields を確認
  const fields = await sql`
    SELECT id, api_name, label
    FROM book_fields
    WHERE object_id = ${propertiesObjectId}
    ORDER BY sort_order, created_at
  `
  console.log(`\n📋 削除対象 book_fields: ${fields.length} 件`)
  for (const f of fields) {
    console.log(`   - ${f.api_name} (${f.label})`)
  }

  if (fields.length === 0) {
    console.log('\n✅ book_fields が無いため削除対象なし。終了。')
    return
  }

  // 対応する custom_field_values の件数を確認
  // neon の sql は Record<string, any>[] を返すため、型キャストで参照する。
  const fieldIds = (fields as Array<{ id: string }>).map((f) => f.id)
  const valueCount = await sql`
    SELECT COUNT(*)::int AS count FROM custom_field_values
    WHERE field_id = ANY(${fieldIds})
  `
  const total = valueCount[0]?.count ?? 0
  console.log(`\n💾 削除対象 custom_field_values: ${total} 行`)

  if (!isExecute) {
    console.log('\n🔍 これは dry-run です。実削除するには --execute を付けてください。')
    return
  }

  // 実削除
  console.log('\n🗑️  custom_field_values を削除中...')
  await sql`DELETE FROM custom_field_values WHERE field_id = ANY(${fieldIds})`

  console.log('🗑️  book_fields を削除中...')
  await sql`DELETE FROM book_fields WHERE object_id = ${propertiesObjectId}`

  console.log('\n✅ 削除完了')
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1) })
