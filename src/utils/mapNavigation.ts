import type { GeoJsonObject } from 'geojson'
import L from 'leaflet'

import type { DistrictFeature } from '../types'

export interface FlyToFeatureBoundsOptions {
  padding?: readonly [number, number]
  maxZoom?: number
}

export function flyToFeatureBounds(
  map: L.Map | null,
  feature: DistrictFeature,
  options?: FlyToFeatureBoundsOptions,
): void {
  if (!map) return
  const gj = L.geoJSON(feature as GeoJsonObject)
  try {
    const b = gj.getBounds()
    if (b?.isValid?.()) {
      const p = options?.padding ?? ([60, 60] as const)
      const padding: L.PointTuple = [p[0], p[1]]
      const maxZoom = options?.maxZoom
      map.fitBounds(b, {
        padding,
        ...(maxZoom !== undefined ? { maxZoom } : {}),
      })
    }
  } finally {
    gj.remove()
  }
}
