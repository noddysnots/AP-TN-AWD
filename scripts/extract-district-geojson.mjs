/**
 * Build public/geojson/ap_districts.geojson and tg_districts.geojson.
 * Run from project root: node scripts/extract-district-geojson.mjs
 *
 * Requires:
 *   - public/geojson/india_districts_raw.geojson (curl geohacker india district file)
 *   - public/geojson/gadm_extract/gadm41_IND_2.json (optional; unzip GADM IND level 2)
 *
 * Andhra Pradesh: NAME_1 === "Andhra Pradesh" (excludes Arunachal Pradesh).
 * Telangana: NAME_1 === "Telangana" from raw India if present; else GADM NAME_1 === "Telangana".
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const geoDir = path.join(root, 'public', 'geojson')
const rawIndia = path.join(geoDir, 'india_districts_raw.geojson')
const gadmPath = path.join(geoDir, 'gadm_extract', 'gadm41_IND_2.json')
const outAp = path.join(geoDir, 'ap_districts.geojson')
const outTg = path.join(geoDir, 'tg_districts.geojson')

function main() {
  if (!fs.existsSync(rawIndia)) {
    console.error('Missing', rawIndia, '— curl it first (see README).')
    process.exit(1)
  }
  const india = JSON.parse(fs.readFileSync(rawIndia, 'utf8'))
  if (india.type !== 'FeatureCollection' || !Array.isArray(india.features)) {
    console.error('Invalid India GeoJSON')
    process.exit(1)
  }

  const apFeatures = india.features.filter((f) => {
    const n = String(f.properties?.NAME_1 ?? '')
      .trim()
      .toLowerCase()
    return n === 'andhra pradesh'
  })

  let tgFeatures = india.features.filter((f) => {
    const n = String(f.properties?.NAME_1 ?? f.properties?.ST_NM ?? '')
      .trim()
      .toLowerCase()
    return n === 'telangana' || n === 'telegana'
  })

  if (tgFeatures.length < 25 && fs.existsSync(gadmPath)) {
    const gadm = JSON.parse(fs.readFileSync(gadmPath, 'utf8'))
    const fromGadm = gadm.features.filter((f) => f.properties?.NAME_1 === 'Telangana')
    console.log('India file Telangana count:', tgFeatures.length, '— supplementing from GADM:', fromGadm.length)
    tgFeatures = fromGadm
  }

  fs.writeFileSync(outAp, JSON.stringify({ type: 'FeatureCollection', features: apFeatures }))
  fs.writeFileSync(outTg, JSON.stringify({ type: 'FeatureCollection', features: tgFeatures }))

  console.log('Wrote', outAp, 'features:', apFeatures.length)
  console.log('Wrote', outTg, 'features:', tgFeatures.length)
  if (apFeatures.length < 20) console.warn('⚠ AP count looks low; check india_districts_raw source.')
  if (tgFeatures.length < 25) console.warn('⚠ TG count looks low; replace with a full Telangana district file if needed.')
}

main()
