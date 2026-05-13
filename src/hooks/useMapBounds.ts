import type { LatLngBoundsExpression } from 'leaflet'

import type { DistrictCollection } from '../types'
import type { StateView } from '../types'
import { AP_BOUNDS, BOTH_BOUNDS, TG_BOUNDS } from '../utils/constants'
import { leafletBoundsFromCollection, mergeCollections } from '../utils/geo'

export function boundsForStateView(
  view: StateView,
  ap: DistrictCollection | null,
  tg: DistrictCollection | null,
): LatLngBoundsExpression {
  if (view === 'AP') {
    return leafletBoundsFromCollection(ap) ?? AP_BOUNDS
  }
  if (view === 'TG') {
    return leafletBoundsFromCollection(tg) ?? TG_BOUNDS
  }
  const merged = mergeCollections(ap, tg)
  return leafletBoundsFromCollection(merged) ?? BOTH_BOUNDS
}

export function boundsForSelection(fc: DistrictCollection | null): LatLngBoundsExpression | null {
  return leafletBoundsFromCollection(fc)
}
