import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import type { MutableRefObject } from 'react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { FeatureGroup, MapContainer as RLMapContainer, Pane, TileLayer, useMap } from 'react-leaflet'

import type {
  DistrictCollection,
  DistrictFeature,
  LayerMode,
  MandalMeasureRef,
  AutoMeasureMapSegment,
  MeasurePoint,
  SelectedFeature,
  StateView,
} from '../types'
import { CARTO_POSITRON, INITIAL_MAP } from '../utils/constants'
import { leafletBoundsFromCollection, mergeCollections } from '../utils/geo'
import { DistrictLayer } from './DistrictLayer'
import { AutoMeasureLayer } from './AutoMeasureLayer'
import { DistanceTool } from './DistanceTool'
import { MandalLayer } from './MandalLayer'
import { MandalPinLayer } from './MandalPinLayer'

/** Stable reference so MapBoundsController does not re-run fitBounds every parent render. */
const FIT_PADDING: [number, number] = [30, 30]

function MapBoundsController({
  fitCollection,
  districtFitKey,
  padding,
}: {
  fitCollection: DistrictCollection | null
  districtFitKey: string
  padding: [number, number]
}) {
  const map = useMap()
  const lastFitKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fitCollection?.features.length) {
      lastFitKeyRef.current = null
      return
    }
    const bounds = leafletBoundsFromCollection(fitCollection)
    if (!bounds) return
    if (lastFitKeyRef.current === districtFitKey) return
    lastFitKeyRef.current = districtFitKey

    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        try {
          map.fitBounds(bounds, { padding })
        } catch {
          /* empty */
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [map, fitCollection, districtFitKey, padding])
  return null
}

export interface MapContainerProps {
  mapRef: MutableRefObject<L.Map | null>
  districtGroupRef: MutableRefObject<L.FeatureGroup | null>
  stateView: StateView
  layerMode: LayerMode
  apDistricts: DistrictCollection | null
  tgDistricts: DistrictCollection | null
  mandalMerged: DistrictCollection | null
  colorById: ReadonlyMap<string, string>
  measureEnabled: boolean
  onToggleSelect: (f: DistrictFeature) => void
  onMeasurePick: (f: DistrictFeature) => void
  distanceEnabled: boolean
  distanceLineVariant: 'default' | 'mandal'
  pointA: MeasurePoint | null
  pointB: MeasurePoint | null
  distanceKm: number | null
  onBareMapClickMeasure: (lat: number, lng: number) => void
  /** Selected chips — used to draw mandal centroid pins (TG/AP bundled coords). */
  selectionItems: readonly SelectedFeature[]
  onMandalPinMeasurePick: (lat: number, lng: number, meta: MandalMeasureRef) => void
  /** Sidebar auto-measure (imperative line; separate from manual DistanceTool). */
  autoMeasureSegment: AutoMeasureMapSegment | null
}

export const MapContainer = memo(function MapContainer({
  mapRef,
  districtGroupRef,
  stateView,
  layerMode,
  apDistricts,
  tgDistricts,
  mandalMerged,
  colorById,
  measureEnabled,
  onToggleSelect,
  onMeasurePick,
  distanceEnabled,
  distanceLineVariant,
  pointA,
  pointB,
  distanceKm,
  onBareMapClickMeasure,
  selectionItems,
  onMandalPinMeasurePick,
  autoMeasureSegment,
}: MapContainerProps) {
  /** Keep hover inside the map subtree so App does not re-render on mousemove (avoids Leaflet resize/view glitches). */
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const mandalStates = useMemo(() => {
    const set = new Set<'AP' | 'TG'>()
    for (const f of mandalMerged?.features ?? []) {
      const st = f.properties?._state
      if (st === 'AP' || st === 'TG') set.add(st)
    }
    return set
  }, [mandalMerged])

  const hasAnyMandalGeometry = mandalStates.size > 0
  const districtVisible = true
  const mandalVisible = layerMode === 'mandal' && hasAnyMandalGeometry

  const apLayerData = useMemo(() => {
    if (!apDistricts) return null
    if (stateView === 'TG') return { type: 'FeatureCollection' as const, features: [] }
    if (layerMode === 'mandal' && mandalStates.has('AP')) {
      return { type: 'FeatureCollection' as const, features: [] }
    }
    return apDistricts
  }, [apDistricts, stateView, layerMode, mandalStates])

  const tgLayerData = useMemo(() => {
    if (!tgDistricts) return null
    if (stateView === 'AP') return { type: 'FeatureCollection' as const, features: [] }
    if (layerMode === 'mandal' && mandalStates.has('TG')) {
      return { type: 'FeatureCollection' as const, features: [] }
    }
    return tgDistricts
  }, [tgDistricts, stateView, layerMode, mandalStates])

  const districtBoundsSource = useMemo(() => {
    const merged = mergeCollections(apDistricts, tgDistricts)
    if (!merged.features.length) return null
    return merged
  }, [apDistricts, tgDistricts])

  const districtFitKey = useMemo(
    () => `fit-${apDistricts?.features.length ?? 0}-${tgDistricts?.features.length ?? 0}`,
    [apDistricts, tgDistricts],
  )

  return (
    <RLMapContainer
      ref={(node) => {
        mapRef.current = node
      }}
      center={INITIAL_MAP.center}
      zoom={INITIAL_MAP.zoom}
      zoomSnap={0.5}
      className={`z-0 h-full w-full ${distanceEnabled ? 'cursor-crosshair' : ''}`}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution={CARTO_POSITRON.attribution}
        url={CARTO_POSITRON.url}
        maxZoom={CARTO_POSITRON.maxZoom}
      />
      <MapBoundsController
        fitCollection={districtBoundsSource}
        districtFitKey={districtFitKey}
        padding={FIT_PADDING}
      />

      <Pane
        name="districtPane"
        className="map-layer-fade"
        style={{
          opacity: districtVisible ? 1 : 0,
          pointerEvents: districtVisible ? 'auto' : 'none',
        }}
      >
        <FeatureGroup
          ref={(node) => {
            districtGroupRef.current = node
          }}
        >
          <DistrictLayer
            data={apLayerData}
            datasetState="AP"
            stateView={stateView}
            colorById={colorById}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            measureEnabled={measureEnabled}
            onToggleSelect={onToggleSelect}
            onMeasurePick={onMeasurePick}
          />
          <DistrictLayer
            data={tgLayerData}
            datasetState="TG"
            stateView={stateView}
            colorById={colorById}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            measureEnabled={measureEnabled}
            onToggleSelect={onToggleSelect}
            onMeasurePick={onMeasurePick}
          />
        </FeatureGroup>
      </Pane>

      <Pane
        name="mandalPane"
        className="map-layer-fade"
        style={{
          opacity: mandalVisible ? 1 : 0,
          pointerEvents: mandalVisible ? 'auto' : 'none',
        }}
      >
        <MandalLayer
          data={mandalMerged}
          stateView={stateView}
          colorById={colorById}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          measureEnabled={measureEnabled}
          onToggleSelect={onToggleSelect}
          onMeasurePick={onMeasurePick}
        />
      </Pane>

      <MandalPinLayer
        items={selectionItems}
        colorById={colorById}
        measureEnabled={distanceEnabled}
        onMandalPinMeasurePick={onMandalPinMeasurePick}
      />

      <AutoMeasureLayer segment={autoMeasureSegment} />

      <DistanceTool
        enabled={distanceEnabled}
        pointA={pointA}
        pointB={pointB}
        distanceKm={distanceKm}
        distanceLineVariant={distanceLineVariant}
        onBareMapClick={onBareMapClickMeasure}
      />
    </RLMapContainer>
  )
})
