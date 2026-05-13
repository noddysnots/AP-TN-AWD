import { useCallback, useEffect, useState } from 'react'

import type { DistrictCollection, DistrictProperties, GeoJsonFetchSource } from '../types'
import {
  LOCAL_AP_DISTRICTS_GEOJSON,
  LOCAL_AP_MANDALS_GEOJSON,
  LOCAL_TG_DISTRICTS_GEOJSON,
  LOCAL_TG_MANDALS_GEOJSON,
} from '../utils/constants'
import { isValidFeatureCollection, tagCollection } from '../utils/geo'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

const MIN_AP_DISTRICT_FEATURES = 15
const MIN_TG_DISTRICT_FEATURES = 25
const MIN_TG_MANDAL_FEATURES = 350
const MIN_AP_MANDAL_FEATURES = 600

const MANDAL_SOURCES: Record<'AP' | 'TG', { url: string; cacheKey: string; minFeatures: number }> = {
  AP: { url: LOCAL_AP_MANDALS_GEOJSON, cacheKey: 'ap-mandals-local-v1', minFeatures: MIN_AP_MANDAL_FEATURES },
  TG: { url: LOCAL_TG_MANDALS_GEOJSON, cacheKey: 'tg-mandals-local-v2', minFeatures: MIN_TG_MANDAL_FEATURES },
}

const DISTRICTS_CACHE_KEY = 'districts-both-local-v11'

export interface UseGeoJsonState {
  data: DistrictCollection | null
  status: LoadStatus
  error: string | null
  source: GeoJsonFetchSource | null
  featureCount: number
  retry: () => void
}

export interface DistrictBundleState {
  apData: DistrictCollection | null
  tgData: DistrictCollection | null
  status: LoadStatus
  error: string | null
  apFeatureCount: number
  tgFeatureCount: number
  retry: () => void
}

interface DistrictCacheEntry {
  ap: DistrictCollection
  tg: DistrictCollection
}

interface MandalCacheEntry {
  data: DistrictCollection
  source: GeoJsonFetchSource
}

const cacheRef: Record<string, DistrictCacheEntry | MandalCacheEntry> = {}

function asDistrictCollection(raw: unknown): DistrictCollection | null {
  if (!isValidFeatureCollection(raw)) return null
  return raw as DistrictCollection
}

function hasEnoughDistricts(fc: DistrictCollection | null | undefined, min: number): boolean {
  return !!fc && Array.isArray(fc.features) && fc.features.length >= min
}

/** Single Promise.all load: only `/geojson/ap_districts.geojson` and `/geojson/tg_districts.geojson`. */
async function loadBothDistrictCollections(): Promise<DistrictCacheEntry> {
  const [apRes, tgRes] = await Promise.all([
    fetch(LOCAL_AP_DISTRICTS_GEOJSON),
    fetch(LOCAL_TG_DISTRICTS_GEOJSON),
  ])
  if (!apRes.ok) throw new Error(`AP districts HTTP ${apRes.status}`)
  if (!tgRes.ok) throw new Error(`TG districts HTTP ${tgRes.status}`)

  const apData = (await apRes.json()) as DistrictCollection
  const tgData = (await tgRes.json()) as DistrictCollection

  for (const f of apData.features) {
    const p = (f.properties ?? {}) as DistrictProperties
    p._state = 'AP'
    const name =
      (typeof p.dtname === 'string' && p.dtname.trim()) ||
      (typeof p.district_name === 'string' && p.district_name.trim()) ||
      (typeof (p as DistrictProperties & { NEW_DIST?: string }).NEW_DIST === 'string' &&
        (p as DistrictProperties & { NEW_DIST?: string }).NEW_DIST!.trim()) ||
      (typeof p.NAME_2 === 'string' && p.NAME_2.trim()) ||
      (typeof p.DISTRICT === 'string' && p.DISTRICT.trim()) ||
      (typeof p.name === 'string' && p.name.trim()) ||
      'Unknown'
    p.dtname = name
    f.properties = p
  }

  for (const f of tgData.features) {
    const p = (f.properties ?? {}) as DistrictProperties
    p._state = 'TG'
    f.properties = p
  }

  const apFc = asDistrictCollection(apData)
  const tgFc = asDistrictCollection(tgData)
  const apN = apFc?.features?.length ?? 0
  const tgN = tgFc?.features?.length ?? 0
  if (!hasEnoughDistricts(apFc, MIN_AP_DISTRICT_FEATURES)) {
    throw new Error(`AP has ${apN} districts (need ≥ ${MIN_AP_DISTRICT_FEATURES}). Check public/geojson/ap_districts.geojson.`)
  }
  if (!hasEnoughDistricts(tgFc, MIN_TG_DISTRICT_FEATURES)) {
    throw new Error(`TG has ${tgN} districts (need ≥ ${MIN_TG_DISTRICT_FEATURES}). Check public/geojson/tg_districts.geojson.`)
  }

  console.log('AP loaded:', apN, 'districts')
  console.log('TG loaded:', tgN, 'districts')

  const apTagged = tagCollection(apFc!, 'AP', 'district')
  const tgTagged = tagCollection(tgFc!, 'TG', 'district')

  return { ap: apTagged, tg: tgTagged }
}

export function useDistrictGeoJSON(enabled = true): DistrictBundleState {
  const [retryKey, setRetryKey] = useState(0)
  const [apData, setApData] = useState<DistrictCollection | null>(null)
  const [tgData, setTgData] = useState<DistrictCollection | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    const cached = cacheRef[DISTRICTS_CACHE_KEY] as DistrictCacheEntry | undefined
    if (cached?.ap && cached?.tg) {
      setApData(cached.ap)
      setTgData(cached.tg)
      setStatus('success')
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const used = await loadBothDistrictCollections()
      cacheRef[DISTRICTS_CACHE_KEY] = used
      setApData(used.ap)
      setTgData(used.tg)
      setStatus('success')
    } catch (e) {
      setStatus('error')
      setError('Failed to load district data. Check public/geojson/ folder.')
      console.error(e)
      setApData(null)
      setTgData(null)
    }
  }, [enabled])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load, retryKey])

  const retry = useCallback(() => {
    delete cacheRef[DISTRICTS_CACHE_KEY]
    setRetryKey((k) => k + 1)
  }, [])

  return {
    apData,
    tgData,
    status,
    error,
    apFeatureCount: apData?.features.length ?? 0,
    tgFeatureCount: tgData?.features.length ?? 0,
    retry,
  }
}

export interface MandalLoadState extends UseGeoJsonState {
  remoteFailed: boolean
}

export function useMandalLayer(state: 'AP' | 'TG', shouldLoad: boolean): MandalLoadState {
  const [retryKey, setRetryKey] = useState(0)
  const [data, setData] = useState<DistrictCollection | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<GeoJsonFetchSource | null>(null)

  const load = useCallback(async () => {
    if (!shouldLoad) return
    const cfg = MANDAL_SOURCES[state]
    const cached = cacheRef[cfg.cacheKey] as MandalCacheEntry | undefined
    if (cached) {
      setData(cached.data)
      setSource(cached.source)
      setStatus('success')
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch(cfg.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rawLocal = await res.json()
      if (!isValidFeatureCollection(rawLocal)) throw new Error('Invalid local GeoJSON')
      const fc = asDistrictCollection(rawLocal)
      const n = fc?.features?.length ?? 0
      if (n < cfg.minFeatures) {
        throw new Error(`${cfg.url} has ${n} features (need ≥ ${cfg.minFeatures}).`)
      }
      const tagged = tagCollection(fc!, state, 'mandal')
      const used: MandalCacheEntry = { data: tagged, source: 'local' }
      cacheRef[cfg.cacheKey] = used
      setData(used.data)
      setSource(used.source)
      setStatus('success')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Load failed')
      setData(null)
      setSource(null)
    }
  }, [shouldLoad, state])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load, retryKey])

  const retry = useCallback(() => {
    delete cacheRef[MANDAL_SOURCES[state].cacheKey]
    setRetryKey((k) => k + 1)
  }, [state])

  return {
    data,
    status,
    error,
    source,
    featureCount: data?.features.length ?? 0,
    retry,
    remoteFailed: false,
  }
}
