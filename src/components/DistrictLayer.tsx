import type { Feature, MultiPolygon, Polygon } from 'geojson'
import L from 'leaflet'
import type { MutableRefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'

import type { DistrictCollection, DistrictFeature, StateCode, StateView } from '../types'
import { getPolygonMapLabel } from '../utils/mapLabels'

function sampleCoord(feature: Feature<Polygon | MultiPolygon>): string {
  const g = feature.geometry
  if (g.type === 'Polygon') {
    const c = g.coordinates?.[0]?.[0]
    return c ? `[${c[0]}, ${c[1]}]` : 'n/a'
  }
  if (g.type === 'MultiPolygon') {
    const c = g.coordinates?.[0]?.[0]?.[0]
    return c ? `[${c[0]}, ${c[1]}]` : 'n/a'
  }
  return 'n/a'
}

const AP_BASE = {
  fillColor: '#B2DFDB',
  fillOpacity: 0.5,
  color: '#00796B',
  weight: 1.5,
} as const

const TG_BASE = {
  fillColor: '#FFE0B2',
  fillOpacity: 0.5,
  color: '#E65100',
  weight: 1.5,
} as const

function filterByState(fc: DistrictCollection | null, stateView: StateView): DistrictCollection {
  if (!fc) return { type: 'FeatureCollection', features: [] }
  if (stateView === 'both') return fc
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => f.properties?._state === stateView),
  }
}

function TooltipZoomSync({
  pathsRef,
  version,
}: {
  pathsRef: MutableRefObject<L.Path[]>
  version: string
}) {
  const map = useMap()

  const apply = useCallback(() => {
    const z = map.getZoom()
    // Districts are big enough to label permanently from zoom 7 upward.
    const permanent = z >= 7
    for (const path of pathsRef.current) {
      const label = (path as unknown as { __districtLabel?: string }).__districtLabel
      if (!label) continue
      path.unbindTooltip()
      path.bindTooltip(label, {
        permanent,
        direction: 'center',
        sticky: !permanent,
        className: 'district-label',
      })
    }
  }, [map, pathsRef])

  useEffect(() => {
    apply()
    map.on('zoomend', apply)
    return () => {
      map.off('zoomend', apply)
    }
  }, [map, apply, version])

  return null
}

interface DistrictLayerProps {
  data: DistrictCollection | null
  /** Which state file this layer was built from (drives fill / outline / hover). */
  datasetState: StateCode
  stateView: StateView
  colorById: ReadonlyMap<string, string>
  /** True when at least one district chip is selected anywhere — non-selected
   *  district polygons render at low opacity so selections stand out. */
  anyDistrictSelected: boolean
  hoveredId: string | null
  onHover: (id: string | null) => void
  measureEnabled: boolean
  onToggleSelect: (f: DistrictFeature) => void
  onMeasurePick: (f: DistrictFeature) => void
}

export const DistrictLayer = memo(function DistrictLayer({
  data,
  datasetState,
  stateView,
  colorById,
  anyDistrictSelected,
  hoveredId,
  onHover,
  measureEnabled,
  onToggleSelect,
  onMeasurePick,
}: DistrictLayerProps) {
  const filtered = useMemo(() => filterByState(data, stateView), [data, stateView])
  const pathsRef = useRef<L.Path[]>([])
  const layerByIdRef = useRef<Map<string, L.Path>>(new Map())

  useEffect(() => {
    pathsRef.current = []
    layerByIdRef.current = new Map()
  }, [filtered])

  const style = useCallback(
    (feature?: Feature) => {
      const f = feature as DistrictFeature | undefined
      if (!f?.properties) {
        return datasetState === 'TG' ? TG_BASE : AP_BASE
      }
      const id = String(f.properties._fid ?? '')
      const st = datasetState
      const base = st === 'TG' ? TG_BASE : AP_BASE
      const sel = colorById.get(id)
      const isHover = hoveredId === id && !sel

      if (sel) {
        const isHoverSel = hoveredId === id
        return {
          fillColor: sel,
          fillOpacity: isHoverSel ? 0.82 : 0.7,
          color: st === 'TG' ? '#E65100' : '#00796B',
          weight: 2.5,
        }
      }
      // Some other district is selected — dim everything that isn't, but
      // still give a small hover pop for discoverability.
      if (anyDistrictSelected) {
        return {
          ...base,
          fillOpacity: isHover ? 0.35 : 0.15,
          weight: isHover ? 1.4 : 1,
        }
      }
      if (isHover) {
        return {
          ...base,
          fillColor: st === 'TG' ? '#FFCC80' : '#80CBC4',
          fillOpacity: 0.75,
          weight: 2,
        }
      }
      return { ...base }
    },
    [colorById, datasetState, hoveredId, anyDistrictSelected],
  )

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const f = feature as DistrictFeature
      if (import.meta.env.DEV && (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')) {
        console.log(
          '[Layer] mounting feature:',
          getPolygonMapLabel(f.properties),
          '| coords sample:',
          sampleCoord(f as Feature<Polygon | MultiPolygon>),
        )
      }
      const id = String(f.properties?._fid ?? '')
      const label = getPolygonMapLabel(f.properties)
      const g = layer as L.Path
      ;(g as unknown as { __districtLabel?: string }).__districtLabel = label
      g.bindTooltip(label, {
        permanent: false,
        sticky: true,
        direction: 'center',
        className: 'district-label',
      })
      pathsRef.current.push(g)
      if (id) layerByIdRef.current.set(id, g)
      g.on({
        click: (e: L.LeafletMouseEvent) => {
          if (measureEnabled) {
            L.DomEvent.stopPropagation(e)
            onMeasurePick(f)
          } else {
            onToggleSelect(f)
          }
        },
        mouseover: () => onHover(id),
        mouseout: () => onHover(null),
      })
    },
    [measureEnabled, onHover, onMeasurePick, onToggleSelect],
  )

  /* Imperatively apply current style to every known feature path whenever the
     selection palette or hovered id changes. Belt-and-braces alongside react-leaflet's
     own setStyle propagation — guarantees the polygon repaints on select / hover / deselect. */
  useEffect(() => {
    layerByIdRef.current.forEach((path) => {
      const f = (path as unknown as { feature?: DistrictFeature }).feature
      if (!f) return
      const next = style(f)
      try {
        path.setStyle(next as L.PathOptions)
      } catch {
        /* layer detached */
      }
    })
  }, [style])

  if (!filtered.features.length) return null

  const syncKey = `${datasetState}-${stateView}-${filtered.features.length}`

  return (
    <>
      <TooltipZoomSync pathsRef={pathsRef} version={syncKey} />
      <GeoJSON data={filtered} style={style} onEachFeature={onEachFeature} />
    </>
  )
})
