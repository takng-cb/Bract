import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// .env.local から DATABASE_URL を読む
const env = readFileSync('.env.local', 'utf-8')
const match = env.match(/DATABASE_URL=(.+)/)
if (!match) { console.error('DATABASE_URL not found'); process.exit(1) }

const sql = neon(match[1].trim())
await sql`ALTER TABLE saved_views ADD COLUMN IF NOT EXISTS sort_params text NOT NULL DEFAULT ''`
console.log('✅ sort_params column added to saved_views')
