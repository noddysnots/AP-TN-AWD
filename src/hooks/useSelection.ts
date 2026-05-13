import { useCallback, useMemo, useState } from 'react'

import { selectionColorAtIndex } from '../utils/colors'
import { MAX_SELECTIONS } from '../utils/constants'
import { normalizeDistrictForMandals } from '../data/mandals'
import { getDistrictLabel } from '../utils/geo'
import type { DistrictFeature, LayerMode, SelectedFeature, StateCode } from '../types'

export type ToggleFeatureAction = 'added' | 'removed' | 'unchanged'

export interface ToggleFeatureResult {
  ok: boolean
  action: ToggleFeatureAction
}

export interface AddFeatureResult {
  ok: boolean
  /** True only when a new row was inserted (not duplicate, not at cap). */
  added: boolean
}

export interface UseSelectionResult {
  items: SelectedFeature[]
  selectedIds: ReadonlySet<string>
  toggleFeature: (feature: DistrictFeature, layer: LayerMode) => ToggleFeatureResult
  removeById: (id: string) => void
  clearAll: () => void
  /** Add if not present; does not remove. `ok` false at cap; `added` false if duplicate. */
  addFeature: (feature: DistrictFeature, layer: LayerMode) => AddFeatureResult
}

export function useSelection(): UseSelectionResult {
  const [items, setItems] = useState<SelectedFeature[]>([])

  const selectedIds = useMemo(() => new Set(items.map((i) => i.id)), [items])

  const removeById = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id)
      if (!it) return prev
      if (it.layer === 'district') {
        const label = getDistrictLabel(it.feature.properties)
        const dn = normalizeDistrictForMandals(label)
        return prev.filter((x) => {
          if (x.id === id) return false
          if (x.layer === 'mandal') {
            const dProp = String(x.feature.properties?.district ?? '')
            const md = normalizeDistrictForMandals(dProp)
            return !(md === dn && x.state === it.state)
          }
          return true
        })
      }
      return prev.filter((x) => x.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => setItems([]), [])

  const toggleFeature = useCallback((feature: DistrictFeature, layer: LayerMode): ToggleFeatureResult => {
    const id = String(feature.properties?._fid ?? '')
    const state = feature.properties?._state as StateCode | undefined
    if (!id || !state) return { ok: false, action: 'unchanged' }

    let ok = true
    let action: ToggleFeatureAction = 'unchanged'
    setItems((prev) => {
      const hit = prev.find((i) => i.id === id)
      if (hit) {
        action = 'removed'
        ok = true
        if (hit.layer === 'district') {
          const label = getDistrictLabel(hit.feature.properties)
          const dn = normalizeDistrictForMandals(label)
          return prev.filter((x) => {
            if (x.id === id) return false
            if (x.layer === 'mandal') {
              const dProp = String(x.feature.properties?.district ?? '')
              const md = normalizeDistrictForMandals(dProp)
              return !(md === dn && x.state === hit.state)
            }
            return true
          })
        }
        return prev.filter((x) => x.id !== id)
      }
      if (prev.length >= MAX_SELECTIONS) {
        ok = false
        action = 'unchanged'
        return prev
      }
      action = 'added'
      const name = getDistrictLabel(feature.properties)
      const color = selectionColorAtIndex(prev.length)
      ok = true
      return [
        ...prev,
        {
          id,
          name,
          state,
          layer,
          color,
          feature: feature as SelectedFeature['feature'],
        },
      ]
    })
    return { ok, action }
  }, [])

  const addFeature = useCallback((feature: DistrictFeature, layer: LayerMode): AddFeatureResult => {
    const id = String(feature.properties?._fid ?? '')
    const state = feature.properties?._state as StateCode | undefined
    if (!id || !state) return { ok: false, added: false }

    let ok = true
    let added = false
    setItems((prev) => {
      if (prev.some((i) => i.id === id)) {
        ok = true
        added = false
        return prev
      }
      if (prev.length >= MAX_SELECTIONS) {
        ok = false
        added = false
        return prev
      }
      added = true
      const name = getDistrictLabel(feature.properties)
      const color = selectionColorAtIndex(prev.length)
      ok = true
      return [
        ...prev,
        {
          id,
          name,
          state,
          layer,
          color,
          feature: feature as SelectedFeature['feature'],
        },
      ]
    })
    return { ok, added }
  }, [])

  return { items, selectedIds, toggleFeature, removeById, clearAll, addFeature }
}
