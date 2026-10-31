/**
 * Tipos TypeScript generados desde el contrato de la API (docs/api/openapi.json).
 *
 *   npm run api:types         -> regenera src/api/schema.d.ts
 *   npm run api:types:check   -> falla si schema.d.ts no coincide con openapi.json (CI)
 *
 * openapi.json lo exporta el Backend (python -m scripts.export_openapi): si cambia un
 * endpoint, se regeneran los dos archivos en el mismo commit.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import openapiTS, { astToString } from 'openapi-typescript'
import { format, resolveConfig } from 'prettier'

const CONTRACT = new URL('../../docs/api/openapi.json', import.meta.url)
const TARGET = fileURLToPath(new URL('../src/api/schema.d.ts', import.meta.url))
const HEADER = `/**
 * ARCHIVO GENERADO: no lo edites a mano.
 * Fuente: docs/api/openapi.json. Regenerar con: npm run api:types
 */

`

async function generate() {
  // Un campo con valor por defecto es opcional al enviarlo (department en UserCreate...)
  const ast = await openapiTS(CONTRACT, { defaultNonNullable: false })
  const options = (await resolveConfig(TARGET)) ?? {}
  return format(HEADER + astToString(ast), { ...options, filepath: TARGET })
}

const expected = await generate()

if (process.argv.includes('--check')) {
  const current = await readFile(TARGET, 'utf8').catch(() => '')
  if (current.replace(/\r\n/g, '\n') !== expected) {
    console.error(
      'src/api/schema.d.ts no coincide con docs/api/openapi.json: ejecuta npm run api:types',
    )
    process.exit(1)
  }
  console.log('src/api/schema.d.ts coincide con docs/api/openapi.json')
} else {
  await writeFile(TARGET, expected)
  console.log('Tipos generados en src/api/schema.d.ts')
}
