import type { Feature } from 'geojson'
import L from 'leaflet'
import type { MutableRefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'

import { normalizeDistrictForMandals } from '../data/mandals'
import type { DistrictCollection, DistrictFeature, StateView } from '../types'
import { getName } from '../utils/mapLabels'

/** Fallback tint when a feature has no parent-district accent in scope.
 *  Only used as a safety net — in normal flow the filter below removes
 *  any feature whose parent district isn't selected. */
const FALLBACK_ACCENT = '#00796B'

/** Build "STATE:normalizedDistrict" key for a mandal feature. */
function mandalKey(f: DistrictFeature): string | null {
  const st = f.properties?._state
  if (st !== 'AP' && st !== 'TG') return null
  const dist = normalizeDistrictForMandals(String(f.properties?.district ?? ''))
  if (!dist) return null
  return `${st}:${dist}`
}

function scopeBySelectedDistricts(
  fc: DistrictCollection | null,
  stateView: StateView,
  selectedDistrictColorByKey: ReadonlyMap<string, string>,
): DistrictCollection {
  if (!fc || selectedDistrictColorByKey.size === 0) {
    return { type: 'FeatureCollection', features: [] }
  }
  const features = fc.features.filter((f) => {
    if (stateView !== 'both' && f.properties?._state !== stateView) return false
    const key = mandalKey(f as DistrictFeature)
    return key != null && selectedDistrictColorByKey.has(key)
  })
  return { type: 'FeatureCollection', features }
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
    // Mandal labels would clutter the view below zoom 10; show on hover only there.
    const permanent = z >= 10
    for (const path of pathsRef.current) {
      const label = (path as unknown as { __mandalLabel?: string }).__mandalLabel
      if (!label) continue
      path.unbindTooltip()
      path.bindTooltip(label, {
        permanent,
        direction: 'center',
        sticky: !permanent,
        className: 'mandal-label',
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
  /** Colors keyed by mandal `_fid` for individually-selected mandals (chip palette). */
  colorById: ReadonlyMap<string, string>
  /** Colors keyed by "STATE:normalizedDistrict" — the parent district's accent. */
  selectedDistrictColorByKey: ReadonlyMap<string, string>
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
  selectedDistrictColorByKey,
  hoveredId,
  onHover,
  measureEnabled,
  onToggleSelect,
  onMeasurePick,
}: MandalLayerProps) {
  const filtered = useMemo(
    () => scopeBySelectedDistricts(data, stateView, selectedDistrictColorByKey),
    [data, stateView, selectedDistrictColorByKey],
  )
  const pathsRef = useRef<L.Path[]>([])

  useEffect(() => {
    pathsRef.current = []
  }, [filtered])

  const style = useCallback(
    (feature?: Feature) => {
      const f = feature as DistrictFeature | undefined
      const accent = (f && (selectedDistrictColorByKey.get(mandalKey(f) ?? '') ?? FALLBACK_ACCENT)) || FALLBACK_ACCENT
      if (!f?.properties) {
        return { fillColor: accent, fillOpacity: 0.25, color: accent, weight: 0.8 }
      }
      const id = String(f.properties._fid ?? '')
      const sel = colorById.get(id)
      const isHover = hoveredId === id

      if (sel) {
        return {
          fillColor: sel,
          fillOpacity: isHover ? 0.78 : 0.65,
          color: '#212121',
          weight: 2,
        }
      }
      return {
        fillColor: accent,
        fillOpacity: isHover ? 0.55 : 0.25,
        color: accent,
        weight: isHover ? 1.2 : 0.8,
      }
    },
    [colorById, hoveredId, selectedDistrictColorByKey],
  )

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const f = feature as DistrictFeature
      const id = String(f.properties?._fid ?? '')
      const label = getName(f.properties)
      const g = layer as L.Path
      ;(g as unknown as { __mandalLabel?: string }).__mandalLabel = label
      g.bindTooltip(label, {
        permanent: false,
        sticky: true,
        direction: 'center',
        className: 'mandal-label',
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
