import { useCallback, useReducer, useState } from 'react'

import { getMandalCoords } from '../data/mandal_coords'
import type { DistrictFeature, MandalMeasureRef, MeasurePoint, SelectedFeature } from '../types'
import { centroidOfPolygonFeature, getMandalPinLatLngFromSelection, distanceKm as turfDistanceKm, getDistrictLabel } from '../utils/geo'

export interface UseDistanceResult {
  enabled: boolean
  setEnabled: (v: boolean) => void
  pointA: MeasurePoint | null
  pointB: MeasurePoint | null
  distanceKm: number | null
  /** Polyline / midpoint label styling for mandal–mandal sidebar measure. */
  distanceLineVariant: 'default' | 'mandal'
  pickFromMap: (
    lat: number,
    lng: number,
    feature?: DistrictFeature | null,
    mandal?: MandalMeasureRef | null,
  ) => void
  measureBetweenFeatures: (a: DistrictFeature, b: DistrictFeature) => void
  measureBetweenMandals: (a: MandalMeasureRef, b: MandalMeasureRef) => boolean
  /** Two sidebar selections: districts (centroids), mandals (coords), or mixed. */
  measureBetweenAnySelection: (a: SelectedFeature, b: SelectedFeature) => boolean
  clear: () => void
}

type Pair = { a: MeasurePoint | null; b: MeasurePoint | null }

type Action =
  | { type: 'reset' }
  | { type: 'pick'; point: MeasurePoint }
  | { type: 'setPair'; a: MeasurePoint; b: MeasurePoint }

function reducer(state: Pair, action: Action): Pair {
  switch (action.type) {
    case 'reset':
      return { a: null, b: null }
    case 'setPair':
      return { a: action.a, b: action.b }
    case 'pick': {
      if (!state.a) return { a: action.point, b: null }
      if (!state.b) return { a: state.a, b: action.point }
      return { a: action.point, b: null }
    }
    default:
      return state
  }
}

function pointFromFeature(f: DistrictFeature): MeasurePoint {
  const [lat, lng] = centroidOfPolygonFeature(f)
  return {
    lat,
    lng,
    label: getDistrictLabel(f.properties),
    source: 'feature',
  }
}

function pointFromMap(lat: number, lng: number): MeasurePoint {
  return {
    lat,
    lng,
    label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    source: 'map',
  }
}

function pointFromMandalPick(lat: number, lng: number, m: MandalMeasureRef): MeasurePoint {
  return {
    lat,
    lng,
    label: m.name,
    sublabel: m.district,
    source: 'mandal',
  }
}

function pointFromSelectedItem(it: SelectedFeature): MeasurePoint | null {
  if (it.layer === 'district') return pointFromFeature(it.feature)
  if (it.layer !== 'mandal') return null
  const c = getMandalPinLatLngFromSelection(it)
  if (!c) return null
  const d = String(it.feature.properties?.district ?? '')
  return {
    lat: c.lat,
    lng: c.lng,
    label: it.name,
    sublabel: d,
    source: 'mandal',
  }
}

export function useDistance(): UseDistanceResult {
  const [enabled, setEnabledState] = useState(false)
  const [distanceLineVariant, setDistanceLineVariant] = useState<'default' | 'mandal'>('default')
  const [pair, dispatch] = useReducer(reducer, { a: null, b: null })

  const clear = useCallback(() => {
    setDistanceLineVariant('default')
    dispatch({ type: 'reset' })
  }, [])

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledState(v)
      if (!v) {
        setDistanceLineVariant('default')
        dispatch({ type: 'reset' })
      }
    },
    [],
  )

  const pickFromMap = useCallback(
    (lat: number, lng: number, feature?: DistrictFeature | null, mandal?: MandalMeasureRef | null) => {
      if (!enabled) return
      const next =
        mandal != null
          ? pointFromMandalPick(lat, lng, mandal)
          : feature
            ? pointFromFeature(feature)
            : pointFromMap(lat, lng)
      setDistanceLineVariant('default')
      dispatch({ type: 'pick', point: next })
    },
    [enabled],
  )

  const measureBetweenFeatures = useCallback((a: DistrictFeature, b: DistrictFeature) => {
    setDistanceLineVariant('default')
    dispatch({ type: 'setPair', a: pointFromFeature(a), b: pointFromFeature(b) })
  }, [])

  const measureBetweenMandals = useCallback((a: MandalMeasureRef, b: MandalMeasureRef): boolean => {
    const ca = getMandalCoords(a.name, a.district, a.state)
    const cb = getMandalCoords(b.name, b.district, b.state)
    if (!ca || !cb) return false
    setDistanceLineVariant('mandal')
    dispatch({
      type: 'setPair',
      a: {
        lat: ca.lat,
        lng: ca.lon,
        label: a.name,
        sublabel: a.district,
        source: 'mandal',
      },
      b: {
        lat: cb.lat,
        lng: cb.lon,
        label: b.name,
        sublabel: b.district,
        source: 'mandal',
      },
    })
    return true
  }, [])

  const measureBetweenAnySelection = useCallback((a: SelectedFeature, b: SelectedFeature): boolean => {
    if (a.layer === 'mandal' && b.layer === 'mandal') {
      return measureBetweenMandals(
        {
          name: a.name,
          district: String(a.feature.properties?.district ?? ''),
          state: a.state,
        },
        {
          name: b.name,
          district: String(b.feature.properties?.district ?? ''),
          state: b.state,
        },
      )
    }
    if (a.layer === 'district' && b.layer === 'district') {
      measureBetweenFeatures(a.feature, b.feature)
      return true
    }
    const pa = pointFromSelectedItem(a)
    const pb = pointFromSelectedItem(b)
    if (!pa || !pb) return false
    setDistanceLineVariant('default')
    dispatch({ type: 'setPair', a: pa, b: pb })
    return true
  }, [measureBetweenMandals, measureBetweenFeatures])

  const pointA = pair.a
  const pointB = pair.b
  const d =
    pointA && pointB ? turfDistanceKm(pointA, pointB) : null

  return {
    enabled,
    setEnabled,
    pointA,
    pointB,
    distanceKm: d,
    distanceLineVariant,
    pickFromMap,
    measureBetweenFeatures,
    measureBetweenMandals,
    measureBetweenAnySelection,
    clear,
  }
}
