import L from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker, Pane, Tooltip } from 'react-leaflet'

import { getMandalCoords } from '../data/mandal_coords'
import type { MandalMeasureRef, SelectedFeature } from '../types'

export interface MandalPinLayerProps {
  items: readonly SelectedFeature[]
  colorById: ReadonlyMap<string, string>
  measureEnabled: boolean
  onMandalPinMeasurePick: (lat: number, lng: number, meta: MandalMeasureRef) => void
}

export const MandalPinLayer = memo(function MandalPinLayer({
  items,
  colorById,
  measureEnabled,
  onMandalPinMeasurePick,
}: MandalPinLayerProps) {
  const pins = useMemo(() => {
    const out: Array<{
      id: string
      lat: number
      lng: number
      icon: L.DivIcon
      meta: MandalMeasureRef
    }> = []
    for (const it of items) {
      if (it.layer !== 'mandal') continue
      const district = String(it.feature.properties?.district ?? '')
      const c = getMandalCoords(it.name, district, it.state)
      if (!c) continue
      const color = colorById.get(it.id) ?? '#00796b'
      const icon = L.divIcon({
        className: '',
        html:
          `<div style="` +
          `width:14px;height:14px;` +
          `border-radius:50%;` +
          `background:${color};` +
          `border:2.5px solid #ffffff;` +
          `box-shadow:0 0 0 1.5px ${color},0 2px 6px rgba(0,0,0,0.4);` +
          `box-sizing:border-box;` +
          `"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      if (import.meta.env.DEV) {
        console.log('[mandal pin]', it.name, c.lat, c.lon)
      }
      out.push({
        id: it.id,
        lat: c.lat,
        lng: c.lon,
        icon,
        meta: { name: it.name, district, state: it.state },
      })
    }
    return out
  }, [items, colorById])

  return (
    <Pane name="mandalPins" style={{ zIndex: 650 }}>
      {pins.map((p) => (
        <Marker
          key={p.id}
          pane="mandalPins"
          position={[p.lat, p.lng]}
          icon={p.icon}
          zIndexOffset={1000}
          interactive={measureEnabled}
          bubblingMouseEvents={!measureEnabled}
          eventHandlers={{
            click: () => {
              if (!measureEnabled) return
              onMandalPinMeasurePick(p.lat, p.lng, p.meta)
            },
          }}
        >
          <Tooltip direction="top" className="district-label">
            {p.meta.name}
          </Tooltip>
        </Marker>
      ))}
    </Pane>
  )
})
