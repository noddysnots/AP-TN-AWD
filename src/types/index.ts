import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type StateCode = 'AP' | 'TG'

export interface MandalMeasureRef {
  name: string
  district: string
  state: StateCode
}

export type StateView = StateCode | 'both'

export type LayerMode = 'district' | 'mandal'

export interface DistrictProperties {
  NAME_1?: string
  NAME_2?: string
  NAME?: string
  name?: string
  stname?: string
  ST_NM?: string
  STATE?: string
  state?: string
  State?: string
  DISTRICT?: string
  District?: string
  district?: string
  dt_name?: string
  dtname?: string
  district_name?: string
  NEW_DIST?: string
  mandal?: string
  D_N?: string
  Shape_Area?: number
  AREA?: number
  /** tagged at load time */
  _state?: StateCode
  _layer?: LayerMode
  _fid?: string
  [key: string]: unknown
}

export type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictProperties>

export type DistrictCollection = FeatureCollection<Polygon | MultiPolygon, DistrictProperties>

export interface SelectedFeature {
  id: string
  name: string
  state: StateCode
  layer: LayerMode
  color: string
  feature: DistrictFeature
}

export interface MeasurePoint {
  lat: number
  lng: number
  /** Primary label (district name, mandal name, or raw coordinates). */
  label: string
  /** Optional second line for sidebar (e.g. parent district for a mandal). */
  sublabel?: string
  source: 'map' | 'feature' | 'mandal'
}

export interface AutoDistanceEndpointDisplay {
  mandalName: string
  district: string
  state: StateCode
}

export interface AutoMeasureMapSegment {
  positions: [[number, number], [number, number]]
  km: number
}

export interface AutoDistanceMeasureSuccess {
  ok: true
  pairIds: [string, string]
  km: number
  segment: AutoMeasureMapSegment
  displayA: AutoDistanceEndpointDisplay
  displayB: AutoDistanceEndpointDisplay
}

export type AutoDistanceMeasureError = { ok: false; error: string }

export type AutoDistanceResult = AutoDistanceMeasureSuccess | AutoDistanceMeasureError

export type AutoDistanceState = AutoDistanceResult | null

export type GeoJsonFetchSource = 'primary' | 'fallback' | 'local' | 'gadm' | 'community'

export interface GeoJsonLoadResult {
  collection: DistrictCollection | null
  source: GeoJsonFetchSource | null
  featureCount: number
}
