import type { Feature } from 'geojson'
import L from 'leaflet'
import type { MutableRefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'

import type { DistrictCollection, DistrictFeature, StateView } from '../types'
import { getName } from '../utils/mapLabels'

const AP_M = {
  fillColor: '#B2DFDB',
  fillOpacity: 0.3,
  color: '#00796B',
  weight: 0.6,
} as const

const TG_M = {
  fillColor: '#FFE0B2',
  fillOpacity: 0.3,
  color: '#E65100',
  weight: 0.6,
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
    const permanent = z >= 8
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

interface MandalLayerProps {
  data: DistrictCollection | null
  stateView: StateView
  colorById: ReadonlyMap<string, string>
  hoveredId: string | null
  onHover: (id: string | null) => void
  measureEnabled: boolean
  onToggleSelect: (f: DistrictFeature) => void
  onMeasurePick: (f: DistrictFeature) => void
}

export const MandalLayer = memo(function MandalLayer({
  data,
  stateView,
  colorById,
  hoveredId,
  onHover,
  measureEnabled,
  onToggleSelect,
  onMeasurePick,
}: MandalLayerProps) {
  const filtered = useMemo(() => filterByState(data, stateView), [data, stateView])
  const pathsRef = useRef<L.Path[]>([])

  useEffect(() => {
    pathsRef.current = []
  }, [filtered])

  const style = useCallback(
    (feature?: Feature) => {
      const f = feature as DistrictFeature | undefined
      if (!f?.properties) return AP_M
      const id = String(f.properties._fid ?? '')
      const st = f.properties._state
      const base = st === 'TG' ? TG_M : AP_M
      const sel = colorById.get(id)
      const isHover = hoveredId === id && !sel

      if (sel) {
        const isHoverSel = hoveredId === id
        return {
          fillColor: sel,
          fillOpacity: isHoverSel ? 0.78 : 0.65,
          color: '#212121',
          weight: 2,
        }
      }
      if (isHover) {
        return {
          ...base,
          fillOpacity: 0.5,
          weight: 1.2,
        }
      }
      return { ...base }
    },
    [colorById, hoveredId],
  )

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const f = feature as DistrictFeature
      const id = String(f.properties?._fid ?? '')
      const label = getName(f.properties)
      const g = layer as L.Path
      ;(g as unknown as { __districtLabel?: string }).__districtLabel = label
      g.bindTooltip(label, {
        permanent: false,
        sticky: true,
        direction: 'center',
        className: 'district-label',
      })
      pathsRef.current.push(g)
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

  if (!filtered.features.length) return null

  const syncKey = `${stateView}-${filtered.features.length}-m`

  return (
    <>
      <TooltipZoomSync pathsRef={pathsRef} version={syncKey} />
      <GeoJSON data={filtered} style={style} onEachFeature={onEachFeature} />
    </>
  )
})
