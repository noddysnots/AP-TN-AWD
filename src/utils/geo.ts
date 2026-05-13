import * as turf from '@turf/turf'
import type { BBox, Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type L from 'leaflet'

import type { DistrictCollection, DistrictFeature, DistrictProperties, StateCode } from '../types'

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
