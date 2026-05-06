import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// .env.local から DATABASE_URL を読む
const env = readFileSync('.env.local', 'utf-8')
const match = env.match(/DATABASE_URL=(.+)/)
if (!match) { console.error('DATABASE_URL not found'); process.exit(1) }

const sql = neon(match[1].trim())

// 1. relationship_definitions テーブル作成
await sql`
  CREATE TABLE IF NOT EXISTS relationship_definitions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_object_type  text NOT NULL,
    target_object_type  text NOT NULL,
    label               text NOT NULL,
    reverse_label       text,
    cardinality         text NOT NULL DEFAULT 'many_to_many',
    created_at          timestamptz DEFAULT now(),
    UNIQUE (source_object_type, target_object_type, label)
  )
`
console.log('✅ relationship_definitions table created')

// 2. relationship_values テーブル作成
await sql`
  CREATE TABLE IF NOT EXISTS relationship_values (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id   uuid NOT NULL REFERENCES relationship_definitions(id) ON DELETE CASCADE,
    source_record_id  uuid NOT NULL,
    target_record_id  uuid NOT NULL,
    created_at        timestamptz DEFAULT now(),
    UNIQUE (relationship_id, source_record_id, target_record_id)
  )
`
console.log('✅ relationship_values table created')

// 3. インデックス作成
await sql`CREATE INDEX IF NOT EXISTS rv_source_idx ON relationship_values (relationship_id, source_record_id)`
await sql`CREATE INDEX IF NOT EXISTS rv_target_idx ON relationship_values (relationship_id, target_record_id)`
console.log('✅ indexes created')

// 4. 初期データ: 物件 ↔ 商談 の多対多
await sql`
  INSERT INTO relationship_definitions (source_object_type, target_object_type, label, reverse_label, cardinality)
  VALUES ('properties', 'opportunities', '関連商談', '関連物件', 'many_to_many')
  ON CONFLICT DO NOTHING
`
console.log('✅ seeded: properties ↔ opportunities relationship')

console.log('\n🎉 Migration complete!')
