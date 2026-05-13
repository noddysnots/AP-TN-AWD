import L from 'leaflet'
import { memo, useEffect, useMemo, useState } from 'react'
import type { LeafletMouseEvent } from 'leaflet'
import { CircleMarker, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'

import type { MeasurePoint } from '../types'
import { midpoint } from '../utils/geo'

interface DistanceToolProps {
  enabled: boolean
  pointA: MeasurePoint | null
  pointB: MeasurePoint | null
  distanceKm: number | null
  distanceLineVariant: 'default' | 'mandal'
  onBareMapClick: (lat: number, lng: number) => void
}

function svgPinDataUrl(fill: string, letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34"><path fill="${fill}" stroke="#ffffff" stroke-width="1.5" d="M14 2C8.9 2 5 5.6 5 10.2c0 5.5 9 19.3 9 19.3s9-13.8 9-19.3C23 5.6 19.1 2 14 2z"/><circle cx="14" cy="10" r="4.5" fill="#ffffff"/><text x="14" y="12.5" text-anchor="middle" fill="${fill}" font-family="IBM Plex Sans,sans-serif" font-size="9" font-weight="700">${letter}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const DistanceTool = memo(function DistanceTool({
  enabled,
  pointA,
  pointB,
  distanceKm,
  distanceLineVariant,
  onBareMapClick,
}: DistanceToolProps) {
  const map = useMap()
  const [cursor, setCursor] = useState<L.LatLng | null>(null)

  useMapEvents({
    click(e: LeafletMouseEvent) {
      if (!enabled) return
      onBareMapClick(e.latlng.lat, e.latlng.lng)
    },
    mousemove(e: LeafletMouseEvent) {
      if (enabled && pointA && !pointB) setCursor(e.latlng)
    },
    mouseout() {
      setCursor(null)
    },
  })

  useEffect(() => {
    map.getContainer().classList.toggle('measure-crosshair', enabled)
    return () => {
      map.getContainer().classList.remove('measure-crosshair')
    }
  }, [enabled, map])

  const iconA = useMemo(
    () =>
      L.icon({
        iconUrl: svgPinDataUrl('#212121', 'A'),
        iconSize: [28, 34],
        iconAnchor: [14, 32],
      }),
    [],
  )

  const iconB = useMemo(
    () =>
      L.icon({
        iconUrl: svgPinDataUrl('#00796B', 'B'),
        iconSize: [28, 34],
        iconAnchor: [14, 32],
      }),
    [],
  )

  return (
    <>
      {pointA && pointB ? (
        <Polyline
          positions={[
            [pointA.lat, pointA.lng],
            [pointB.lat, pointB.lng],
          ]}
          pathOptions={
            distanceLineVariant === 'mandal'
              ? { color: '#1565c0', weight: 2, dashArray: '6 4', opacity: 0.9 }
              : { color: '#424242', weight: 2 }
          }
        />
      ) : null}
      {pointA && !pointB && cursor ? (
        <Polyline
          positions={[
            [pointA.lat, pointA.lng],
            [cursor.lat, cursor.lng],
          ]}
          pathOptions={{ color: '#757575', weight: 1.5, dashArray: '6 6' }}
        />
      ) : null}
      {pointA ? <Marker position={[pointA.lat, pointA.lng]} icon={iconA} interactive={false} /> : null}
      {pointB ? <Marker position={[pointB.lat, pointB.lng]} icon={iconB} interactive={false} /> : null}
      {pointA && pointB && distanceKm !== null ? (
        <CircleMarker
          center={midpoint(pointA, pointB)}
          radius={1}
          pathOptions={{ opacity: 0, fillOpacity: 0 }}
          interactive={false}
        >
          <Tooltip
            direction="top"
            offset={[0, -6]}
            opacity={1}
            permanent
            className={
              distanceLineVariant === 'mandal'
                ? 'measure-line-tooltip'
                : 'rounded border border-[#E0E0E0] bg-white px-2 py-1 font-mono text-xs text-[#212121] shadow'
            }
          >
            {distanceLineVariant === 'mandal'
              ? `${distanceKm.toFixed(1)} km`
              : `Distance: ${distanceKm.toFixed(2)} km`}
          </Tooltip>
        </CircleMarker>
      ) : null}
    </>
  )
})
