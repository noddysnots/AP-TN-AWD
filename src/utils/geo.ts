import * as turf from '@turf/turf'
import type { BBox, Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type L from 'leaflet'

import type { Mandal } from '../data/mandals'
import { normalizeDistrictForMandals, resolveDistrictName } from '../data/mandals'
import { getMandalCoords } from '../data/mandal_coords'
import type { DistrictCollection, DistrictFeature, DistrictProperties, SelectedFeature, StateCode } from '../types'

import { getName, getPolygonMapLabel, getStateCode } from './mapLabels'

export { getName, getStateCode, getStateCode as getStateCodeFromProps }

export function getDistrictLabel(props: Record<string, unknown> | DistrictProperties | null | undefined): string {
  return getPolygonMapLabel(props as DistrictProperties)
}

/** Telangana mandal GeoJSON: parent district is `district`; `dtname` is the mandal name. */
export function getMandalParentDistrictLabel(
  props: Record<string, unknown> | DistrictProperties | null | undefined,
): string {
  if (!props) return ''
  const d = (props as DistrictProperties).district
  return typeof d === 'string' && d.trim().length > 0 ? d.trim() : ''
}

/** Case-insensitive key for matching district labels to mandal data. */
export function normalizeDistrictKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function stableFeatureId(
  state: StateCode,
  layer: 'district' | 'mandal',
  props: DistrictProperties,
  index: number,
): string {
  const name = getDistrictLabel(props)
  const extra =
    (props.D_C as string | undefined) ||
    (props.OBJECTID as number | string | undefined) ||
    (props.GID_2 as string | undefined) ||
    index
  return `${state}-${layer}-${name}-${extra}`
}

export function tagCollection(
  fc: DistrictCollection,
  state: StateCode,
  layer: 'district' | 'mandal',
): DistrictCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f, i) => {
      const p = f.properties || {}
      const sc: StateCode =
        p._state === 'AP' || p._state === 'TG' ? (p._state as StateCode) : state
      return {
        ...f,
        properties: {
          ...p,
          _state: sc,
          _layer: layer,
          _fid: stableFeatureId(sc, layer, p as DistrictProperties, i),
        },
      }
    }),
  }
}

export function featureBBoxToLeafletBounds(bbox: BBox): L.LatLngBoundsExpression {
  return [
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ]
}

export function boundsFromCollection(fc: DistrictCollection | null): BBox | null {
  if (!fc || fc.features.length === 0) return null
  try {
    return turf.bbox(fc)
  } catch {
    return null
  }
}

export function leafletBoundsFromCollection(fc: DistrictCollection | null): L.LatLngBoundsExpression | null {
  const b = boundsFromCollection(fc)
  if (!b) return null
  return featureBBoxToLeafletBounds(b)
}

export function centroidOfPolygonFeature(f: Feature<Polygon | MultiPolygon>): [number, number] {
  const c = turf.centroid(f as Feature)
  return [c.geometry.coordinates[1], c.geometry.coordinates[0]]
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const from = turf.point([a.lng, a.lat])
  const to = turf.point([b.lng, b.lat])
  return turf.distance(from, to, { units: 'kilometers' })
}

export function midpoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): [number, number] {
  return [(a.lat + b.lat) / 2, (a.lng + b.lng) / 2]
}

export function areaSqKmFromProps(props: Record<string, unknown> | DistrictProperties | null | undefined): number | null {
  if (!props) return null
  const shapeArea = props.Shape_Area
  if (typeof shapeArea === 'number' && shapeArea > 1e6) {
    return shapeArea / 1_000_000
  }
  const area = props.AREA
  if (typeof area === 'number' && area > 1e6) {
    return area / 1_000_000
  }
  return null
}

export function mergeCollections(
  a: DistrictCollection | null,
  b: DistrictCollection | null,
): DistrictCollection {
  const features = [...(a?.features ?? []), ...(b?.features ?? [])]
  return { type: 'FeatureCollection', features }
}

export function isValidFeatureCollection(data: unknown): data is FeatureCollection {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as FeatureCollection).type === 'FeatureCollection' &&
    Array.isArray((data as FeatureCollection).features)
  )
}

/**
 * Match a list mandal to bundled mandal GeoJSON when the polygon's `district` label is still
 * pre-reorg (e.g. Nizamabad) but `mandals.ts` uses the current district (e.g. Kamareddy).
 * If multiple same-named mandals exist in the state, requires an exact district match.
 */
export function resolveMandalFeatureFromList(fc: DistrictCollection | null, m: Mandal): DistrictFeature | null {
  if (!fc) return null
  const wantName = normalizeDistrictForMandals(m.name)
  const wantDist = normalizeDistrictForMandals(resolveDistrictName(m.district, m.state))

  const nameHits: DistrictFeature[] = []
  for (const f of fc.features as DistrictFeature[]) {
    const p = f.properties
    if (!p || p._state !== m.state) continue
    if (p._layer && p._layer !== 'mandal') continue
    const mn = normalizeDistrictForMandals(String(p.dtname ?? p.mandal ?? ''))
    if (mn !== wantName) continue
    nameHits.push(f)
  }
  if (nameHits.length === 0) return null

  const exact = nameHits.filter((f) => {
    const gd = normalizeDistrictForMandals(resolveDistrictName(String(f.properties?.district ?? ''), m.state))
    return gd === wantDist
  })
  if (exact.length >= 1) return exact[0]
  if (nameHits.length === 1) return nameHits[0]
  return null
}

/** List-picked mandal: stable id + UI district while keeping GeoJSON geometry. */
export function mandalFeatureWithListIdentity(fromGeo: DistrictFeature, m: Mandal): DistrictFeature {
  const id = `${m.state}-mandal-${m.district}-${m.name}`
  return {
    ...fromGeo,
    properties: {
      ...(fromGeo.properties ?? {}),
      district: m.district,
      dtname: m.name,
      mandal: m.name,
      _state: m.state,
      _layer: 'mandal',
      _fid: id,
    },
  } as DistrictFeature
}

/** Pin / distance point for a selected mandal: polygon centroid when available, else bundled coords. */
export function getMandalPinLatLngFromSelection(it: SelectedFeature): { lat: number; lng: number } | null {
  if (it.layer !== 'mandal') return null
  const props = it.feature.properties
  const district = String(props?.district ?? '')
  const g = it.feature.geometry

  if (props?.note === 'no_polygon_parent_district') {
    const c = getMandalCoords(it.name, district, it.state)
    return c ? { lat: c.lat, lng: c.lon } : null
  }
  if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
    try {
      const [lat, lng] = centroidOfPolygonFeature(it.feature as Feature<Polygon | MultiPolygon>)
      return { lat, lng }
    } catch {
      /* fall through */
    }
  }
  const c = getMandalCoords(it.name, district, it.state)
  return c ? { lat: c.lat, lng: c.lon } : null
}

export function findFeatureContainingPoint(
  fc: DistrictCollection,
  lat: number,
  lng: number,
): DistrictFeature | null {
  const pt = turf.point([lng, lat])
  for (const f of fc.features) {
    const g = f.geometry
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
    const df = f as DistrictFeature
    try {
      if (turf.booleanPointInPolygon(pt, df)) return df
    } catch {
      /* ignore invalid geometries */
    }
  }
  return null
}
