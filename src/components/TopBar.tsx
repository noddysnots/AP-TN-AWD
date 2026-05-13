import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import type { Mandal } from '../data/mandals'
import { getMandalsForDistrict } from '../data/mandals'
import type { DistrictCollection, DistrictFeature } from '../types'
import { AP_BOUNDS, BOTH_BOUNDS, TG_BOUNDS } from '../utils/constants'
import { getDistrictLabel } from '../utils/geo'

export type TopBarSelectedState = 'ALL' | 'AP' | 'TG'

export interface TopBarDropdownDistrict {
  name: string
  state: 'AP' | 'TG'
  feature: DistrictFeature
}

export interface TopBarDropdownMandal {
  name: string
  district: string
  state: 'AP' | 'TG'
}

export interface TopBarProps {
  mapRef: RefObject<L.Map | null>
  selectedState: TopBarSelectedState
  onSelectedState: (s: TopBarSelectedState) => void
  dropdownDistrict: TopBarDropdownDistrict | null
  dropdownMandal: TopBarDropdownMandal | null
  apDistricts: DistrictCollection | null
  tgDistricts: DistrictCollection | null
  selectedIds: ReadonlySet<string>
  onPickDistrictFromList: (row: TopBarDropdownDistrict) => void
  onPickMandalFromList: (m: Mandal) => void
  measureEnabled: boolean
  onMeasureToggle: () => void
}

const FONT = "'IBM Plex Sans', sans-serif"

const triggerBase =
  'map-ui-focus flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#d0d0d0] bg-white px-3 py-0 text-left text-[13px] font-medium text-[#212121] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45'

const panelBase =
  'absolute left-0 top-[calc(100%+4px)] z-[9999] overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.10)]'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`shrink-0 text-[#757575] transition-transform ${open ? 'rotate-180' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function useCloseOnOutsideClick(refs: ReadonlyArray<RefObject<HTMLElement | null>>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (refs.some((r) => r.current?.contains(t))) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [refs, onClose])
}

function districtRows(fc: DistrictCollection | null, state: 'AP' | 'TG'): DistrictFeature[] {
  if (!fc) return []
  return fc.features.filter(
    (f) => f.properties?._layer === 'district' && f.properties?._state === state,
  ) as DistrictFeature[]
}

function sortFeaturesByLabel(features: DistrictFeature[]): DistrictFeature[] {
  return [...features].sort((a, b) =>
    getDistrictLabel(a.properties).localeCompare(getDistrictLabel(b.properties), undefined, {
      sensitivity: 'base',
    }),
  )
}

function flyStateBounds(map: L.Map | null, s: TopBarSelectedState) {
  if (!map) return
  const b = s === 'ALL' ? BOTH_BOUNDS : s === 'AP' ? AP_BOUNDS : TG_BOUNDS
  try {
    map.fitBounds(b, { padding: [30, 30] })
  } catch {
    /* */
  }
}

export function TopBar({
  mapRef,
  selectedState,
  onSelectedState,
  dropdownDistrict,
  dropdownMandal,
  apDistricts,
  tgDistricts,
  selectedIds,
  onPickDistrictFromList,
  onPickMandalFromList,
  measureEnabled,
  onMeasureToggle,
}: TopBarProps) {
  const [openState, setOpenState] = useState(false)
  const [openDistrict, setOpenDistrict] = useState(false)
  const [openMandal, setOpenMandal] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const [mandalSearch, setMandalSearch] = useState('')

  const stateRef = useRef<HTMLDivElement>(null)
  const districtRef = useRef<HTMLDivElement>(null)
  const mandalRef = useRef<HTMLDivElement>(null)

  const closeAll = useCallback(() => {
    setOpenState(false)
    setOpenDistrict(false)
    setOpenMandal(false)
  }, [])

  useCloseOnOutsideClick([stateRef, districtRef, mandalRef], closeAll)

  const apRows = useMemo(() => sortFeaturesByLabel(districtRows(apDistricts, 'AP')), [apDistricts])
  const tgRows = useMemo(() => sortFeaturesByLabel(districtRows(tgDistricts, 'TG')), [tgDistricts])

  const filteredApRows = useMemo(() => {
    const q = districtSearch.trim().toLowerCase()
    if (!q) return apRows
    return apRows.filter((f) => getDistrictLabel(f.properties).toLowerCase().includes(q))
  }, [apRows, districtSearch])

  const filteredTgRows = useMemo(() => {
    const q = districtSearch.trim().toLowerCase()
    if (!q) return tgRows
    return tgRows.filter((f) => getDistrictLabel(f.properties).toLowerCase().includes(q))
  }, [tgRows, districtSearch])

  const flatDistrictRows = useMemo(() => {
    if (selectedState === 'AP') return filteredApRows
    if (selectedState === 'TG') return filteredTgRows
    return []
  }, [selectedState, filteredApRows, filteredTgRows])

  const mandalsForDistrict = useMemo(() => {
    if (!dropdownDistrict) return []
    return getMandalsForDistrict(dropdownDistrict.name, dropdownDistrict.state)
  }, [dropdownDistrict])

  const filteredMandals = useMemo(() => {
    const q = mandalSearch.trim().toLowerCase()
    if (!q) return mandalsForDistrict
    return mandalsForDistrict.filter((m) => m.name.toLowerCase().includes(q))
  }, [mandalsForDistrict, mandalSearch])

  const stateTriggerLabel =
    selectedState === 'ALL' ? 'All States' : selectedState === 'AP' ? 'Andhra Pradesh' : 'Telangana'

  const districtTriggerLabel = dropdownDistrict ? dropdownDistrict.name : 'All Districts'

  const mandalTriggerLabel = dropdownMandal ? dropdownMandal.name : 'All Mandals'

  const navigateDistrictFid = dropdownDistrict
    ? String(dropdownDistrict.feature.properties?._fid ?? '')
    : ''

  const mandalDisabled = !dropdownDistrict

  const pickState = (s: TopBarSelectedState) => {
    onSelectedState(s)
    flyStateBounds(mapRef.current, s)
    setOpenState(false)
  }

  const pickDistrictRow = (f: DistrictFeature, state: 'AP' | 'TG') => {
    const name = getDistrictLabel(f.properties)
    onPickDistrictFromList({ name, state, feature: f })
    setOpenDistrict(false)
    setDistrictSearch('')
  }

  const pickMandalRow = (m: Mandal) => {
    onPickMandalFromList(m)
    setOpenMandal(false)
    setMandalSearch('')
  }

  return (
    <header
      className="pointer-events-auto relative z-[1200] flex h-[52px] w-full shrink-0 items-center gap-2 border-b border-[#e0e0e0] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
      style={{ fontFamily: FONT }}
    >
      <h1 className="m-0 mr-3 shrink-0 text-[15px] font-bold leading-none text-[#212121]">AP · TG Map</h1>

      <span className="h-6 w-px shrink-0 bg-[#e0e0e0]" aria-hidden />

      <div className="flex shrink-0 items-center gap-2">
        {/* State */}
        <div className="relative w-[160px] shrink-0" ref={stateRef}>
          <button
            type="button"
            className={`${triggerBase} w-full justify-between ${openState ? 'border-[#00796b]' : ''}`}
            aria-expanded={openState}
            onClick={() => {
              setOpenDistrict(false)
              setOpenMandal(false)
              setOpenState((o) => !o)
            }}
          >
            <span className="min-w-0 truncate">{stateTriggerLabel}</span>
            <Chevron open={openState} />
          </button>
          {openState ? (
            <div className={`${panelBase} w-[220px]`} role="listbox">
              <button
                type="button"
                role="option"
                className={`flex w-full items-center gap-2 border-b border-[#fafafa] px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                  selectedState === 'ALL' ? 'bg-[#e8f5e9] font-semibold' : ''
                }`}
                onClick={() => pickState('ALL')}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#9e9e9e]" />
                <span className="min-w-0 flex-1">All States</span>
                {selectedState === 'ALL' ? <span className="text-[#2e7d32]">✓</span> : null}
              </button>
              <button
                type="button"
                role="option"
                className={`flex w-full items-center gap-2 border-b border-[#fafafa] px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                  selectedState === 'AP' ? 'bg-[#e8f5e9] font-semibold' : ''
                }`}
                onClick={() => pickState('AP')}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#009688]" />
                <span className="min-w-0 flex-1">Andhra Pradesh</span>
                {selectedState === 'AP' ? <span className="text-[#2e7d32]">✓</span> : null}
              </button>
              <button
                type="button"
                role="option"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                  selectedState === 'TG' ? 'bg-[#e8f5e9] font-semibold' : ''
                }`}
                onClick={() => pickState('TG')}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#fb8c00]" />
                <span className="min-w-0 flex-1">Telangana</span>
                {selectedState === 'TG' ? <span className="text-[#2e7d32]">✓</span> : null}
              </button>
            </div>
          ) : null}
        </div>

        {/* District */}
        <div className="relative w-[180px] shrink-0" ref={districtRef}>
          <button
            type="button"
            className={`${triggerBase} w-full justify-between ${openDistrict ? 'border-[#00796b]' : ''}`}
            aria-expanded={openDistrict}
            onClick={() => {
              setOpenState(false)
              setOpenMandal(false)
              setOpenDistrict((o) => !o)
            }}
          >
            <span className="min-w-0 truncate">{districtTriggerLabel}</span>
            <Chevron open={openDistrict} />
          </button>
          {openDistrict ? (
            <div className={`${panelBase} w-[min(100vw-32px,320px)] max-w-[320px]`}>
              <input
                type="search"
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                placeholder="Search districts…"
                className="w-full border-0 border-b border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-[13px] text-[#212121] outline-none"
                autoComplete="off"
              />
              <div className="max-h-[380px] overflow-y-auto">
                {selectedState === 'ALL' ? (
                  <>
                    <div className="sticky top-0 z-[1] border-b border-[#f0f0f0] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#757575]">
                      Andhra Pradesh
                    </div>
                    {filteredApRows.map((f) => {
                      const id = String(f.properties?._fid ?? '')
                      const name = getDistrictLabel(f.properties)
                      const rowSelected = selectedIds.has(id) || navigateDistrictFid === id
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`flex w-full items-center gap-2 border-b border-[#fafafa] px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                            rowSelected ? 'bg-[#e8f5e9] font-semibold' : ''
                          }`}
                          onClick={() => pickDistrictRow(f, 'AP')}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#009688]" />
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {rowSelected ? <span className="text-[#2e7d32]">✓</span> : null}
                        </button>
                      )
                    })}
                    <div className="sticky top-0 z-[1] border-b border-[#f0f0f0] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#757575]">
                      Telangana
                    </div>
                    {filteredTgRows.map((f) => {
                      const id = String(f.properties?._fid ?? '')
                      const name = getDistrictLabel(f.properties)
                      const rowSelected = selectedIds.has(id) || navigateDistrictFid === id
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`flex w-full items-center gap-2 border-b border-[#fafafa] px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                            rowSelected ? 'bg-[#e8f5e9] font-semibold' : ''
                          }`}
                          onClick={() => pickDistrictRow(f, 'TG')}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#fb8c00]" />
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {rowSelected ? <span className="text-[#2e7d32]">✓</span> : null}
                        </button>
                      )
                    })}
                  </>
                ) : (
                  flatDistrictRows.map((f) => {
                    const id = String(f.properties?._fid ?? '')
                    const name = getDistrictLabel(f.properties)
                    const rowSelected = selectedIds.has(id) || navigateDistrictFid === id
                    const st = selectedState
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`flex w-full items-center gap-2 border-b border-[#fafafa] px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                          rowSelected ? 'bg-[#e8f5e9] font-semibold' : ''
                        }`}
                        onClick={() => pickDistrictRow(f, st)}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            st === 'TG' ? 'bg-[#fb8c00]' : 'bg-[#009688]'
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        {rowSelected ? <span className="text-[#2e7d32]">✓</span> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Mandal */}
        <div className="relative w-[180px] shrink-0" ref={mandalRef}>
          <button
            type="button"
            title={mandalDisabled ? 'Select a district first' : undefined}
            disabled={mandalDisabled}
            className={`${triggerBase} w-full justify-between ${openMandal && !mandalDisabled ? 'border-[#00796b]' : ''}`}
            aria-expanded={openMandal}
            onClick={() => {
              if (mandalDisabled) return
              setOpenState(false)
              setOpenDistrict(false)
              setOpenMandal((o) => !o)
            }}
          >
            <span className="min-w-0 truncate">{mandalTriggerLabel}</span>
            <Chevron open={openMandal} />
          </button>
          {openMandal && !mandalDisabled ? (
            <div className={`${panelBase} w-[min(100vw-32px,320px)] max-w-[320px]`}>
              <input
                type="search"
                value={mandalSearch}
                onChange={(e) => setMandalSearch(e.target.value)}
                placeholder="Search mandals…"
                className="w-full border-0 border-b border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-[13px] text-[#212121] outline-none"
                autoComplete="off"
              />
              <div className="max-h-[380px] overflow-y-auto">
                {mandalsForDistrict.length === 0 ? (
                  <p className="m-0 px-3 py-3 text-[13px] text-[#757575]">
                    No mandal data for {dropdownDistrict?.name ?? 'this district'} yet
                  </p>
                ) : (
                  filteredMandals.map((m) => {
                    const mid = `${m.state}-mandal-${m.district}-${m.name}`
                    const sel = selectedIds.has(mid)
                    return (
                      <button
                        key={mid}
                        type="button"
                        className={`flex w-full items-center gap-2 border-b border-[#fafafa] px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f5] ${
                          sel ? 'bg-[#e8f5e9] font-semibold' : ''
                        }`}
                        onClick={() => pickMandalRow(m)}
                      >
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {sel ? <span className="text-[#2e7d32]">✓</span> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <span className="h-6 w-px shrink-0 bg-[#e0e0e0]" aria-hidden />

      <button
        type="button"
        className={`map-ui-focus flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-[13px] font-medium ${
          measureEnabled
            ? 'border-[#00796b] bg-[#00796b] text-white hover:bg-[#00695c]'
            : 'border-[#d0d0d0] bg-white text-[#212121] hover:bg-[#f5f5f5]'
        }`}
        onClick={onMeasureToggle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 22 22 2M8 2h2v4M14 2h2v4M2 14v2h4M2 8V6h4M16 18h4v2M10 18H8v2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        Measure
      </button>

      <span className="min-w-0 flex-1" aria-hidden />
    </header>
  )
}
