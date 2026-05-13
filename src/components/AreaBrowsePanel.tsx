import { useCallback, useEffect, useMemo, useState } from 'react'

import type { DistrictCollection, DistrictFeature, LayerMode, StateView } from '../types'
import type { Mandal } from '../data/mandals'
import { MANDALS, normalizeDistrictForMandals } from '../data/mandals'
import { getDistrictLabel } from '../utils/geo'

function useDebouncedValue(value: string, ms: number): string {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

function mandalRowLabel(m: Mandal): string {
  return m.name
}

interface AreaBrowsePanelProps {
  layerMode: LayerMode
  stateView: StateView
  apDistricts: DistrictCollection | null
  tgDistricts: DistrictCollection | null
  selectedIds: ReadonlySet<string>
  onPickDistrict: (f: DistrictFeature) => void
  onPickMandal: (m: Mandal) => void
  onClose: () => void
}

export function AreaBrowsePanel({
  layerMode,
  stateView,
  apDistricts,
  tgDistricts,
  selectedIds,
  onPickDistrict,
  onPickMandal,
  onClose,
}: AreaBrowsePanelProps) {
  const [q, setQ] = useState('')
  const debouncedRaw = useDebouncedValue(q, 150)
  const debounced = debouncedRaw.trim()

  const districtAp = useMemo(() => {
    if (!apDistricts) return []
    return (apDistricts.features as DistrictFeature[]).filter(
      (f) => f.properties?._layer === 'district' && f.properties?._state === 'AP',
    )
  }, [apDistricts])

  const districtTg = useMemo(() => {
    if (!tgDistricts) return []
    return (tgDistricts.features as DistrictFeature[]).filter(
      (f) => f.properties?._layer === 'district' && f.properties?._state === 'TG',
    )
  }, [tgDistricts])

  const filteredAp = useMemo(() => {
    if (!debounced) return districtAp
    const n = debounced.toLowerCase()
    return districtAp.filter((f) => getDistrictLabel(f.properties).toLowerCase().includes(n))
  }, [districtAp, debounced])

  const filteredTg = useMemo(() => {
    if (!debounced) return districtTg
    const n = debounced.toLowerCase()
    return districtTg.filter((f) => getDistrictLabel(f.properties).toLowerCase().includes(n))
  }, [districtTg, debounced])

  const mandalList = useMemo(() => {
    let list = MANDALS
    if (stateView === 'AP') list = list.filter((m) => m.state === 'AP')
    if (stateView === 'TG') list = list.filter((m) => m.state === 'TG')
    if (!debounced) return list
    const n = debounced.toLowerCase()
    return list.filter((m) => {
      const row = m.name.toLowerCase()
      const par = m.district.toLowerCase()
      return row.includes(n) || par.includes(n)
    })
  }, [stateView, debounced])

  const mandalGroups = useMemo(() => {
    const map = new Map<string, { label: string; mandals: Mandal[] }>()
    for (const m of mandalList) {
      const groupKey = normalizeDistrictForMandals(m.district) || '_flat'
      if (!map.has(groupKey)) {
        map.set(groupKey, { label: m.district || '_flat', mandals: [] })
      }
      map.get(groupKey)!.mandals.push(m)
    }
    for (const entry of map.values()) {
      entry.mandals.sort((a, b) =>
        mandalRowLabel(a).localeCompare(mandalRowLabel(b), undefined, {
          sensitivity: 'base',
        }),
      )
    }
    const entries = [...map.entries()].sort((a, b) => {
      const [ka, va] = a
      const [kb, vb] = b
      if (ka === '_flat') return 1
      if (kb === '_flat') return -1
      return va.label.localeCompare(vb.label, undefined, { sensitivity: 'base' })
    })
    return entries.map(([key, v]) => ({ key, districtLabel: v.label, mandals: v.mandals }))
  }, [mandalList])

  const showAp = stateView === 'AP' || stateView === 'both'
  const showTg = stateView === 'TG' || stateView === 'both'

  const pickDistrict = useCallback(
    (f: DistrictFeature) => {
      onPickDistrict(f)
      onClose()
    },
    [onPickDistrict, onClose],
  )

  const pickMandal = useCallback(
    (m: Mandal) => {
      onPickMandal(m)
      onClose()
    },
    [onPickMandal, onClose],
  )

  const placeholder = layerMode === 'district' ? 'Search districts…' : 'Search mandals…'

  return (
    <div
      className="absolute left-0 top-[calc(100%+6px)] z-[2000] w-[280px] overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-label={layerMode === 'district' ? 'District list' : 'Mandal list'}
    >
      <div className="border-b border-[#EEEEEE] p-2">
        <input
          type="search"
          className="map-ui-focus w-full rounded border border-[#E0E0E0] px-2 py-1.5 text-[13px] outline-none"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="max-h-[480px] overflow-y-auto overflow-x-hidden">
        {layerMode === 'district' ? (
          <>
            {showAp && filteredAp.length > 0 ? (
              <div>
                <div className="sticky top-0 z-10 border-b border-[#F0F0F0] bg-white px-3 py-2 text-[11px] font-bold tracking-wide text-[#757575]">
                  ANDHRA PRADESH
                </div>
                <ul className="m-0 list-none p-0">
                  {filteredAp.map((f) => {
                    const id = String(f.properties?._fid ?? '')
                    const name = getDistrictLabel(f.properties)
                    const sel = selectedIds.has(id)
                    return (
                      <li key={id} className="border-b border-[#F5F5F5]">
                        <button
                          type="button"
                          className="map-ui-focus flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#FAFAFA]"
                          onClick={() => pickDistrict(f)}
                        >
                          <span className="min-w-0 truncate font-medium text-[#212121]">{name}</span>
                          {sel ? (
                            <span className="shrink-0 text-xs font-medium text-[#00796B]">✓ Selected</span>
                          ) : (
                            <span className="shrink-0 text-xs font-semibold text-[#00796B]">+ Select</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
            {showTg && filteredTg.length > 0 ? (
              <div>
                <div className="sticky top-0 z-10 border-b border-[#F0F0F0] bg-white px-3 py-2 text-[11px] font-bold tracking-wide text-[#757575]">
                  TELANGANA
                </div>
                <ul className="m-0 list-none p-0">
                  {filteredTg.map((f) => {
                    const id = String(f.properties?._fid ?? '')
                    const name = getDistrictLabel(f.properties)
                    const sel = selectedIds.has(id)
                    return (
                      <li key={id} className="border-b border-[#F5F5F5]">
                        <button
                          type="button"
                          className="map-ui-focus flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#FAFAFA]"
                          onClick={() => pickDistrict(f)}
                        >
                          <span className="min-w-0 truncate font-medium text-[#212121]">{name}</span>
                          {sel ? (
                            <span className="shrink-0 text-xs font-medium text-[#00796B]">✓ Selected</span>
                          ) : (
                            <span className="shrink-0 text-xs font-semibold text-[#00796B]">+ Select</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
            {(!showAp || filteredAp.length === 0) && (!showTg || filteredTg.length === 0) ? (
              <p className="m-0 px-3 py-4 text-sm text-[#757575]">No districts match.</p>
            ) : null}
          </>
        ) : (
          <>
            {mandalList.length === 0 ? (
              <p className="m-0 px-3 py-4 text-sm text-[#757575]">No mandal data bundled.</p>
            ) : (
              mandalGroups.map((g) => (
                <div key={g.key}>
                  {g.key !== '_flat' ? (
                    <div className="sticky top-0 z-10 border-b border-[#F0F0F0] bg-white px-3 py-2 text-[11px] font-bold tracking-wide text-[#757575]">
                      {g.districtLabel.toUpperCase()}
                    </div>
                  ) : null}
                  <ul className="m-0 list-none p-0">
                    {g.mandals.map((m) => {
                      const id = `${m.state}-mandal-${m.district}-${m.name}`
                      const sel = selectedIds.has(id)
                      return (
                        <li key={id} className="border-b border-[#F5F5F5]">
                          <button
                            type="button"
                            className="map-ui-focus flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#FAFAFA]"
                            onClick={() => pickMandal(m)}
                          >
                            <span className="min-w-0 truncate font-medium text-[#212121]">
                              {m.name}{' '}
                              <span className="ml-1 text-[11px] font-normal text-[#9E9E9E]">{m.district}</span>
                            </span>
                            {sel ? (
                              <span className="shrink-0 text-xs font-medium text-[#00796B]">✓ Selected</span>
                            ) : (
                              <span className="shrink-0 text-xs font-semibold text-[#00796B]">+ Select</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
