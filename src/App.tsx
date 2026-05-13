import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MapContainer } from './components/MapContainer'
import { MapDistrictStatus } from './components/MapDistrictStatus'
import { Sidebar } from './components/Sidebar'
import {
  type TopBarDropdownDistrict,
  type TopBarDropdownMandal,
  type TopBarSelectedState,
  TopBar,
} from './components/TopBar'
import { Toast } from './components/Toast'
import { type Mandal, normalizeDistrictForMandals, resolveDistrictName } from './data/mandals'
import { getMandalCoords } from './data/mandal_coords'
import { useDistrictGeoJSON, useMandalLayer } from './hooks/useGeoJSON'
import { useDistance } from './hooks/useDistance'
import { useToast } from './hooks/useToast'
import { useSelection } from './hooks/useSelection'
import type {
  AutoDistanceState,
  DistrictCollection,
  DistrictFeature,
  LayerMode,
  StateView,
} from './types'
import { distanceKm as geoDistanceKm, getDistrictLabel, mergeCollections } from './utils/geo'
import { flyToFeatureBounds } from './utils/mapNavigation'

function flyToMandalCoordsIfAny(
  map: L.Map | null,
  mandalName: string,
  district: string,
  state: 'AP' | 'TG',
): boolean {
  const c = getMandalCoords(mandalName, district, state)
  if (!c || !map) return false
  map.flyTo([c.lat, c.lon], 11, { duration: 0.8 })
  return true
}

function useScreenLayout(): 'desktop' | 'tablet' | 'mobile' {
  const [layout, setLayout] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'desktop'
    const w = window.innerWidth
    if (w < 768) return 'mobile'
    if (w < 1024) return 'tablet'
    return 'desktop'
  })
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      setLayout(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop')
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return layout
}

export default function App() {
  const layout = useScreenLayout()
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setSidebarOpen(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const [selectedStateTop, setSelectedStateTop] = useState<TopBarSelectedState>('ALL')
  const stateView: StateView = selectedStateTop === 'ALL' ? 'both' : selectedStateTop

  const [dropdownDistrict, setDropdownDistrict] = useState<TopBarDropdownDistrict | null>(null)
  const [dropdownMandal, setDropdownMandal] = useState<TopBarDropdownMandal | null>(null)

  /** Map layers: always show district polygons; TG mandal polygons when data exists (unchanged behavior). */
  const layerMode: LayerMode = 'district'

  const mapRef = useRef<L.Map | null>(null)
  const districtGroupRef = useRef<L.FeatureGroup | null>(null)

  const districts = useDistrictGeoJSON(true)
  const tgMandals = useMandalLayer('TG', true)
  const apMandals = useMandalLayer('AP', true)

  const { message: toastMessage, show: showToast, dismiss: dismissToast } = useToast()
  const { items, toggleFeature, addFeature, removeById, clearAll: clearSelection } = useSelection()

  const colorById = useMemo(
    () => new Map(items.map((i) => [i.id, i.color])),
    [items],
  )

  const mandalMerged = useMemo(
    () => mergeCollections(apMandals.data, tgMandals.data),
    [apMandals.data, tgMandals.data],
  )

  const distance = useDistance()

  const [autoDistance, setAutoDistance] = useState<AutoDistanceState>(null)
  const [autoPairHint, setAutoPairHint] = useState<string | null>(null)

  const clearAutoDistance = useCallback(() => {
    setAutoDistance(null)
    setAutoPairHint(null)
  }, [])

  const handleAutoMeasure = useCallback(() => {
    const mandalsInOrder = items.filter((i) => i.layer === 'mandal')
    if (mandalsInOrder.length !== 2) return
    const a = mandalsInOrder[0]
    const b = mandalsInOrder[1]
    const keyA = `${a.state}:${normalizeDistrictForMandals(String(a.feature.properties?.district ?? ''))}`
    const keyB = `${b.state}:${normalizeDistrictForMandals(String(b.feature.properties?.district ?? ''))}`
    if (keyA === keyB) return

    const da = String(a.feature.properties?.district ?? '')
    const db = String(b.feature.properties?.district ?? '')
    const ca = getMandalCoords(a.name, da, a.state)
    const cb = getMandalCoords(b.name, db, b.state)
    if (!ca || !cb) {
      setAutoDistance({ ok: false, error: 'Could not find coordinates for one or both mandals.' })
      return
    }
    distance.clear()
    setAutoPairHint(null)
    const ll = (lat: number, lon: number) => ({ lat, lng: lon })
    const km = geoDistanceKm(ll(ca.lat, ca.lon), ll(cb.lat, cb.lon))
    const segment = {
      positions: [
        [ca.lat, ca.lon],
        [cb.lat, cb.lon],
      ] as [[number, number], [number, number]],
      km,
    }
    setAutoDistance({
      ok: true,
      pairIds: [a.id, b.id],
      km,
      segment,
      displayA: { mandalName: a.name, district: da, state: a.state },
      displayB: { mandalName: b.name, district: db, state: b.state },
    })
  }, [distance, items])

  useEffect(() => {
    queueMicrotask(() => {
      if (!autoDistance) return
      const mandalsInOrder = items.filter((i) => i.layer === 'mandal')
      const pairEligible =
        mandalsInOrder.length === 2 &&
        `${mandalsInOrder[0].state}:${normalizeDistrictForMandals(String(mandalsInOrder[0].feature.properties?.district ?? ''))}` !==
          `${mandalsInOrder[1].state}:${normalizeDistrictForMandals(String(mandalsInOrder[1].feature.properties?.district ?? ''))}`

      if (autoDistance.ok === false) {
        if (!pairEligible) setAutoDistance(null)
        return
      }
      if (!pairEligible) {
        setAutoDistance(null)
        setAutoPairHint('Select 2 mandals to measure distance')
        return
      }
      const idSet = new Set(items.map((i) => i.id))
      const samePair = idSet.has(autoDistance.pairIds[0]) && idSet.has(autoDistance.pairIds[1])
      if (!samePair) {
        setAutoDistance(null)
        setAutoPairHint('Select 2 mandals to measure distance')
      }
    })
  }, [items, autoDistance])

  useEffect(() => {
    if (!autoDistance?.ok) return
    const m = mapRef.current
    if (!m) return
    const [p0, p1] = autoDistance.segment.positions
    m.fitBounds(L.latLngBounds(L.latLng(p0[0], p0[1]), L.latLng(p1[0], p1[1])), {
      padding: [100, 100],
      maxZoom: 11,
    })
  }, [autoDistance])

  const clearAll = useCallback(() => {
    clearSelection()
    clearAutoDistance()
    setDropdownDistrict(null)
    setDropdownMandal(null)
  }, [clearSelection, clearAutoDistance])

  const districtLoadError = districts.status === 'error'

  const flyOptsDistrict = useMemo(() => ({ padding: [60, 60] as const, maxZoom: 10 }), [])
  const flyOptsMandal = useMemo(() => ({ padding: [48, 48] as const, maxZoom: 12 }), [])

  const districtIndex = useMemo(() => {
    const map = new Map<string, DistrictFeature>()
    const add = (state: 'AP' | 'TG', fc: DistrictCollection | null) => {
      if (!fc) return
      for (const f of fc.features as DistrictFeature[]) {
        if (f.properties?._layer !== 'district') continue
        const label = getDistrictLabel(f.properties)
        const key = normalizeDistrictForMandals(resolveDistrictName(label, state))
        if (key) map.set(`${state}:${key}`, f)
      }
    }
    add('AP', districts.apData)
    add('TG', districts.tgData)
    return {
      get: (st: 'AP' | 'TG', districtName: string) => {
        const k = normalizeDistrictForMandals(resolveDistrictName(districtName, st))
        const kRaw = normalizeDistrictForMandals(districtName)
        return map.get(`${st}:${k}`) ?? map.get(`${st}:${kRaw}`)
      },
    }
  }, [districts.apData, districts.tgData])

  const mandalByListKey = useMemo(() => {
    const map = new Map<string, DistrictFeature>()
    const fc = mandalMerged
    if (!fc) return map
    for (const f of fc.features as DistrictFeature[]) {
      const p = f.properties
      if (!p) continue
      const st = (p._state === 'AP' || p._state === 'TG' ? p._state : null) as 'AP' | 'TG' | null
      if (!st) continue
      const dKey = normalizeDistrictForMandals(String(p.district ?? ''))
      const nKey = normalizeDistrictForMandals(String(p.dtname ?? ''))
      map.set(`${st}|${dKey}|${nKey}`, f)
    }
    return map
  }, [mandalMerged])

  const listMandalLookupKey = useCallback((state: 'AP' | 'TG', district: string, name: string) => {
    return `${state}|${normalizeDistrictForMandals(district)}|${normalizeDistrictForMandals(name)}`
  }, [])

  const toMandalFeature = useCallback(
    (m: Mandal): DistrictFeature | null => {
      const parent =
        m.state === 'TG'
          ? districtIndex.get('TG', m.district)
          : districtIndex.get('AP', m.district)
      if (!parent) return null
      const id = `${m.state}-mandal-${m.district}-${m.name}`
      return {
        ...parent,
        properties: {
          ...(parent.properties ?? {}),
          _state: m.state,
          _layer: 'mandal',
          _fid: id,
          dtname: m.name,
          mandal: m.name,
          district: m.district,
          note: 'no_polygon_parent_district',
        },
      } as DistrictFeature
    },
    [districtIndex],
  )

  const onBrowsePickMandal = useCallback(
    (m: Mandal) => {
      const fromGeo = mandalByListKey.get(listMandalLookupKey(m.state, m.district, m.name))
      const f = fromGeo ?? toMandalFeature(m)
      if (!f) {
        showToast({ kind: 'error', text: `No parent district polygon found for ${m.name} (${m.district})` })
        return
      }
      const { ok, action } = toggleFeature(f, 'mandal')
      if (!ok) {
        showToast({
          kind: 'info',
          text: 'You can select up to six areas at once. Remove one to add another.',
        })
        return
      }
      if (action === 'added') {
        const parent =
          m.state === 'TG' ? districtIndex.get('TG', m.district) : districtIndex.get('AP', m.district)
        if (parent) {
          setDropdownDistrict({
            name: getDistrictLabel(parent.properties),
            state: m.state,
            feature: parent,
          })
        }
        setDropdownMandal({ name: m.name, district: m.district, state: m.state })
        if (!flyToMandalCoordsIfAny(mapRef.current, m.name, m.district, m.state)) {
          flyToFeatureBounds(
            mapRef.current,
            f,
            fromGeo ? flyOptsMandal : flyOptsDistrict,
          )
        }
      }
      if (action === 'removed') {
        setDropdownMandal((prev) =>
          prev?.name === m.name && prev.district === m.district && prev.state === m.state ? null : prev,
        )
      }
    },
    [
      toggleFeature,
      showToast,
      toMandalFeature,
      flyOptsDistrict,
      flyOptsMandal,
      mandalByListKey,
      listMandalLookupKey,
      districtIndex,
    ],
  )

  const onToggleSelect = useCallback(
    (f: DistrictFeature) => {
      const layer = f.properties?._layer ?? 'district'
      const { ok, action } = toggleFeature(f, layer)
      if (!ok) {
        showToast({
          kind: 'info',
          text: 'You can select up to six areas at once. Remove one to add another.',
        })
        return
      }

      if (layer === 'district') {
        const id = String(f.properties?._fid ?? '')
        const st = f.properties?._state as 'AP' | 'TG' | undefined
        if (action === 'added' && st) {
          setSelectedStateTop(st)
          setDropdownDistrict({
            name: getDistrictLabel(f.properties),
            state: st,
            feature: f,
          })
          setDropdownMandal(null)
        }
        if (action === 'removed' && st) {
          setDropdownDistrict((d) => (d && String(d.feature.properties?._fid) === id ? null : d))
          setDropdownMandal((m) => {
            if (!m || m.state !== st) return m
            const dn = normalizeDistrictForMandals(getDistrictLabel(f.properties))
            return normalizeDistrictForMandals(m.district) === dn ? null : m
          })
        }
      }

      if (layer === 'mandal' && action === 'removed') {
        const mName = String(f.properties?.dtname ?? f.properties?.mandal ?? '')
        const mDist = String(f.properties?.district ?? '')
        const mSt = f.properties?._state as 'AP' | 'TG' | undefined
        if (mSt && mName) {
          setDropdownMandal((prev) =>
            prev?.name === mName &&
            normalizeDistrictForMandals(prev.district) === normalizeDistrictForMandals(mDist) &&
            prev.state === mSt
              ? null
              : prev,
          )
        }
      }

      if (action === 'added') {
        if (layer === 'mandal') {
          const mName = String(f.properties?.dtname ?? f.properties?.mandal ?? '')
          const mDist = String(f.properties?.district ?? '')
          const mSt = f.properties?._state as 'AP' | 'TG' | undefined
          if (!mSt || !flyToMandalCoordsIfAny(mapRef.current, mName, mDist, mSt)) {
            flyToFeatureBounds(mapRef.current, f, flyOptsMandal)
          }
        } else {
          flyToFeatureBounds(mapRef.current, f, flyOptsDistrict)
        }
      }
    },
    [toggleFeature, showToast, flyOptsDistrict, flyOptsMandal],
  )

  const onMeasurePick = useCallback(
    (feat: DistrictFeature) => {
      distance.pickFromMap(0, 0, feat)
    },
    [distance],
  )

  const handleSelectedState = useCallback((s: TopBarSelectedState) => {
    setSelectedStateTop(s)
    setDropdownDistrict(null)
    setDropdownMandal(null)
  }, [])

  const handlePickDistrictFromList = useCallback(
    (row: TopBarDropdownDistrict) => {
      const id = String(row.feature.properties?._fid ?? '')
      const currentId =
        dropdownDistrict != null ? String(dropdownDistrict.feature.properties?._fid ?? '') : null
      if (currentId === id) {
        setDropdownDistrict(null)
        setDropdownMandal(null)
        return
      }
      setSelectedStateTop(row.state)
      setDropdownDistrict(row)
      setDropdownMandal(null)
      const { ok } = addFeature(row.feature, 'district')
      if (!ok) {
        showToast({
          kind: 'info',
          text: 'You can select up to six areas at once. Remove one to add another.',
        })
      }
      flyToFeatureBounds(mapRef.current, row.feature, flyOptsDistrict)
    },
    [dropdownDistrict, addFeature, showToast, flyOptsDistrict],
  )

  const measureBetweenSelected = useCallback(() => {
    if (items.length !== 2) return
    const a = items[0]
    const b = items[1]
    const ok = distance.measureBetweenAnySelection(a, b)
    if (!ok) {
      showToast({
        kind: 'info',
        text: 'Could not resolve coordinates for this pair.',
      })
      return
    }
    if (a.layer === 'mandal' && b.layer === 'mandal') {
      const c1 = getMandalCoords(
        a.name,
        String(a.feature.properties?.district ?? ''),
        a.state,
      )
      const c2 = getMandalCoords(
        b.name,
        String(b.feature.properties?.district ?? ''),
        b.state,
      )
      if (c1 && c2 && mapRef.current) {
        mapRef.current.fitBounds(L.latLngBounds(L.latLng(c1.lat, c1.lon), L.latLng(c2.lat, c2.lon)), {
          padding: [80, 80],
        })
      }
    }
  }, [distance, items, showToast])

  const onDistanceClear = useCallback(() => {
    distance.clear()
  }, [distance])

  const selectedIds = useMemo(() => new Set(items.map((i) => i.id)), [items])

  const singleDistrictForSidebar = useMemo(
    () => (items.length === 1 && items[0].layer === 'district' ? items[0] : null),
    [items],
  )

  /* Keep TopBar mandal dropdown row in sync when chips are removed (selection is source of truth). */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from `items` to dropdown UI
    setDropdownMandal((prev) => {
      if (!prev) return null
      const id = `${prev.state}-mandal-${prev.district}-${prev.name}`
      return items.some((i) => i.id === id) ? prev : null
    })
  }, [items])

  return (
    <div
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F8F9FA] text-[#212121]"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <TopBar
        mapRef={mapRef}
        selectedState={selectedStateTop}
        onSelectedState={handleSelectedState}
        dropdownDistrict={dropdownDistrict}
        dropdownMandal={dropdownMandal}
        apDistricts={districts.apData}
        tgDistricts={districts.tgData}
        selectedIds={selectedIds}
        onPickDistrictFromList={handlePickDistrictFromList}
        onPickMandalFromList={onBrowsePickMandal}
        measureEnabled={distance.enabled}
        onMeasureToggle={() => distance.setEnabled(!distance.enabled)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
          <div className="pointer-events-auto h-full w-full">
            <MapContainer
              mapRef={mapRef}
              districtGroupRef={districtGroupRef}
              stateView={stateView}
              layerMode={layerMode}
              apDistricts={districts.apData}
              tgDistricts={districts.tgData}
              mandalMerged={mandalMerged}
              colorById={colorById}
              measureEnabled={distance.enabled}
              onToggleSelect={onToggleSelect}
              onMeasurePick={onMeasurePick}
              distanceEnabled={distance.enabled}
              pointA={distance.pointA}
              pointB={distance.pointB}
              distanceKm={distance.distanceKm}
              distanceLineVariant={distance.distanceLineVariant}
              onBareMapClickMeasure={(lat, lng) => distance.pickFromMap(lat, lng, null)}
              selectionItems={items}
              onMandalPinMeasurePick={(lat, lng, meta) => {
                distance.pickFromMap(lat, lng, null, meta)
              }}
              autoMeasureSegment={autoDistance?.ok ? autoDistance.segment : null}
            />
          </div>

          <MapDistrictStatus
            apLoading={districts.status === 'loading'}
            tgLoading={districts.status === 'loading'}
            apError={districts.status === 'error' ? districts.error : null}
            tgError={districts.status === 'error' ? districts.error : null}
            onRetryAp={districts.retry}
            onRetryTg={districts.retry}
          />
        </div>

        <div className="pointer-events-none relative z-[1000] flex min-h-0 md:pointer-events-auto">
          <div className="pointer-events-auto flex min-h-0">
            <Sidebar
              open={sidebarOpen}
              onToggleOpen={() => setSidebarOpen((o) => !o)}
              layout={layout}
              items={items}
              onRemove={removeById}
              onClearAll={clearAll}
              pointA={distance.pointA}
              pointB={distance.pointB}
              distanceKm={distance.distanceKm}
              onMeasureBetweenSelected={measureBetweenSelected}
              onDistanceClear={onDistanceClear}
              autoDistance={autoDistance}
              autoPairHint={autoPairHint}
              onAutoMeasure={handleAutoMeasure}
              onAutoDistanceClear={clearAutoDistance}
              singleDistrict={singleDistrictForSidebar}
              districtLoadError={districtLoadError}
              districtError={districts.status === 'error' ? districts.error : null}
              onRetryDistricts={districts.retry}
            />
            <Toast message={toastMessage} onDismiss={dismissToast} />
          </div>
        </div>
      </div>
    </div>
  )
}
