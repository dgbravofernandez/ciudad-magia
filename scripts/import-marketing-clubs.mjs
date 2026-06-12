// Importa los 628 clubes desde data/marketing-clubs.json a Supabase
// Uso: node scripts/import-marketing-clubs.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const sb = createClient(url, key)
const clubs = JSON.parse(readFileSync('data/marketing-clubs.json', 'utf-8'))
console.log(`Importando ${clubs.length} clubes a ${url}...`)

let ok = 0, dup = 0, err = 0
const chunkSize = 100
for (let i = 0; i < clubs.length; i += chunkSize) {
  const chunk = clubs.slice(i, i + chunkSize).map(c => ({
    name: c.name,
    email: c.email,
    location: c.location || null,
    federation: c.federation || null,
  }))
  const { data, error } = await sb.from('marketing_clubs').upsert(chunk, { onConflict: 'email', ignoreDuplicates: true }).select('id')
  if (error) {
    console.error('Error chunk', i, ':', error.message)
    err += chunk.length
  } else {
    ok += data?.length ?? 0
    dup += chunk.length - (data?.length ?? 0)
  }
  process.stdout.write(`  ${i + chunk.length}/${clubs.length}\r`)
}
console.log(`\nOK: ${ok} insertados, ${dup} ya existían, ${err} errores`)
