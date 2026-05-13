const https = require('https')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const GEO_DIR = path.join(ROOT, 'public', 'geojson')

/** Only remove target district bundles (keeps gadm_extract and other assets). */
function wipeTargetDistrictFiles() {
  for (const name of ['ap_districts.geojson', 'tg_districts.geojson']) {
    const full = path.join(GEO_DIR, name)
    if (fs.existsSync(full)) {
      fs.unlinkSync(full)
      console.log('[cleanup] Removed', path.relative(ROOT, full))
    }
  }
}

const SOURCES = [
  {
    name: 'AP Districts',
    urls: [
      // datameet moved state GeoJSON; try Census_2011 bundle paths if added later
      'https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/Andhra_Pradesh.geojson',
      'https://raw.githubusercontent.com/datameet/maps/master/Districts/Andhra_Pradesh.geojson',
      'https://raw.githubusercontent.com/nightwarrior-xxx/india-geo-json/master/states/Andhra%20Pradesh.json',
    ],
    output: path.join(ROOT, 'public/geojson/ap_districts.geojson'),
    minFeatures: 20,
    gadmState: 'AP',
  },
  {
    name: 'TG Districts',
    urls: [
      'https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/Telangana.geojson',
      'https://raw.githubusercontent.com/datameet/maps/master/Districts/Telangana.geojson',
      'https://raw.githubusercontent.com/nightwarrior-xxx/india-geo-json/master/states/Telangana.json',
    ],
    output: path.join(ROOT, 'public/geojson/tg_districts.geojson'),
    minFeatures: 25,
    gadmState: 'TG',
  },
]

const download = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          if (!loc) {
            reject(new Error('Redirect without Location'))
            return
          }
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href
          return download(next).then(resolve).catch(reject)
        }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('Invalid JSON from ' + url))
          }
        })
      })
      .on('error', reject)
  })

const ensureDir = (p) => {
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function normName1(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '')
}

function extractFromBundledGadm(state) {
  const gadmPath = path.join(ROOT, 'public/geojson/gadm_extract/gadm41_IND_2.json')
  if (!fs.existsSync(gadmPath)) {
    console.error('[GADM fallback] Missing', path.relative(ROOT, gadmPath))
    return false
  }
  const j = JSON.parse(fs.readFileSync(gadmPath, 'utf8'))
  const features = j.features.filter((f) => {
    const n1 = normName1(f.properties?.NAME_1)
    if (state === 'TG') return n1.includes('telangana')
    return n1.includes('andhra') && !n1.includes('telangana')
  })
  if (features.length < 6) {
    console.error('[GADM fallback] Too few features for', state, features.length)
    return false
  }
  const out =
    state === 'AP'
      ? path.join(ROOT, 'public/geojson/ap_districts.geojson')
      : path.join(ROOT, 'public/geojson/tg_districts.geojson')
  ensureDir(out)
  fs.writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))
  console.warn(
    `[GADM fallback] Wrote ${features.length} ${state} districts to ${path.relative(ROOT, out)} (legacy GADM — replace with datameet files when URLs work).`,
  )
  return true
}

;(async () => {
  wipeTargetDistrictFiles()
  for (const src of SOURCES) {
    let success = false
    for (const url of src.urls) {
      try {
        console.log(`[${src.name}] Trying: ${url}`)
        const data = await download(url)
        const count = data.features?.length || 0
        console.log(`[${src.name}] Got ${count} features`)
        if (count >= src.minFeatures) {
          ensureDir(src.output)
          fs.writeFileSync(src.output, JSON.stringify(data))
          console.log(`[${src.name}] ✓ Saved to ${path.relative(ROOT, src.output)}`)
          const props = data.features[0]?.properties || {}
          console.log(`[${src.name}] Property keys:`, Object.keys(props))
          console.log(`[${src.name}] Sample:`, JSON.stringify(props))
          success = true
          break
        } else {
          console.log(`[${src.name}] Too few features (${count} < ${src.minFeatures}), trying next URL`)
        }
      } catch (e) {
        console.log(`[${src.name}] Failed: ${e.message}`)
      }
    }
    if (!success) {
      console.error(`[${src.name}] ALL REMOTE SOURCES FAILED — trying bundled GADM extract.`)
      extractFromBundledGadm(src.gadmState)
    }
  }
})()
