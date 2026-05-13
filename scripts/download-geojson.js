/**
 * Entry point so `node scripts/download-geojson.js` works in this ESM package.
 * Implementation lives in download-geojson.cjs (CommonJS + https).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '..')
const r = spawnSync(process.execPath, [path.join(dir, 'download-geojson.cjs')], {
  stdio: 'inherit',
  cwd: root,
})
process.exit(r.status ?? 1)
