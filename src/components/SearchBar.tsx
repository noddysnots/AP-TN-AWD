import { useCallback, useEffect, useMemo, useState } from 'react'

import type { DistrictCollection, DistrictFeature, LayerMode, StateCode } from '../types'
import { getDistrictLabel } from '../utils/geo'

export interface SearchHit {
  id: string
  name: string
  state: StateCode
  layer: LayerMode
  feature: DistrictFeature
}

interface SearchBarProps {
  collections: DistrictCollection[]
  searchText: string
  onSearchTextChange: (value: string) => void
  onPick: (hit: SearchHit) => void
  disabled?: boolean
}

function buildIndex(collections: DistrictCollection[]): SearchHit[] {
  const hits: SearchHit[] = []
  for (const fc of collections) {
    for (const f of fc.features) {
      const id = String(f.properties?._fid ?? '')
      const state = f.properties?._state as StateCode | undefined
      const layer = f.properties?._layer as LayerMode | undefined
      if (!id || !state || !layer) continue
      const name = getDistrictLabel(f.properties)
      hits.push({ id, name, state, layer, feature: f as DistrictFeature })
    }
  }
  return hits
}

export function SearchBar({
  collections,
  searchText,
  onSearchTextChange,
  onPick,
  disabled,
}: SearchBarProps) {
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(searchText.trim()), 200)
    return () => window.clearTimeout(t)
  }, [searchText])

  const index = useMemo(() => buildIndex(collections), [collections])

  const results = useMemo(() => {
    if (debounced.length < 1) return []
    const q = debounced.toLowerCase()
    return index
      .filter((h) => h.name.toLowerCase().includes(q))
      .slice(0, 40)
  }, [debounced, index])

  const handlePick = useCallback(
    (hit: SearchHit) => {
      onPick(hit)
      onSearchTextChange('')
      setDebounced('')
      setOpen(false)
    },
    [onPick, onSearchTextChange],
  )

  return (
    <div className="relative">
      <label className="section-header mb-1 block">Search districts / mandals</label>
      <input
        type="search"
        autoComplete="off"
        disabled={disabled}
        placeholder="Type a name…"
        value={searchText}
        onChange={(e) => {
          onSearchTextChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className="map-ui-focus w-full rounded border border-[#E0E0E0] bg-white px-3 py-2 font-sans text-sm text-[#212121] outline-none placeholder:text-[#9E9E9E]"
      />
      {open && results.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded border border-[#E0E0E0] bg-white py-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
          {results.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="map-ui-focus flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#F5F5F5]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(h)}
              >
                <span className="truncate font-medium text-[#212121]">{h.name}</span>
                <span className="shrink-0 font-mono text-xs text-[#757575]">
                  {h.state} · {h.layer === 'district' ? 'Dist' : 'Mandal'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
