import L from 'leaflet'
import { memo, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

import type { AutoMeasureMapSegment } from '../types'

/** Imperative polyline + midpoint label for sidebar-triggered auto measure (separate from manual DistanceTool). */
export const AutoMeasureLayer = memo(function AutoMeasureLayer({ segment }: { segment: AutoMeasureMapSegment | null }) {
  const map = useMap()
  const lineRef = useRef<L.Polyline | null>(null)
  const tipRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (lineRef.current) {
      map.removeLayer(lineRef.current)
      lineRef.current = null
    }
    if (tipRef.current) {
      map.removeLayer(tipRef.current)
      tipRef.current = null
    }

    if (!segment || segment.positions.length !== 2) return

    const line = L.polyline(segment.positions as L.LatLngExpression[], {
      color: '#1565c0',
      weight: 2.5,
      dashArray: '7,5',
      opacity: 0.85,
    }).addTo(map)
    lineRef.current = line

    const [p0, p1] = segment.positions
    const midLat = (p0[0] + p1[0]) / 2
    const midLng = (p0[1] + p1[1]) / 2
    const tip = L.tooltip({
      permanent: true,
      direction: 'top',
      className: 'measure-line-tooltip',
      opacity: 1,
    })
      .setLatLng([midLat, midLng])
      .setContent(`${segment.km.toFixed(1)} km`)
      .addTo(map)
    tipRef.current = tip

    return () => {
      if (lineRef.current) {
        map.removeLayer(lineRef.current)
        lineRef.current = null
      }
      if (tipRef.current) {
        map.removeLayer(tipRef.current)
        tipRef.current = null
      }
    }
  }, [map, segment])

  return null
})
