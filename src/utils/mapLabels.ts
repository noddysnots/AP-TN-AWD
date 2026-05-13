import type { DistrictProperties, StateCode } from '../types'

function strTrim(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.trim()
}

/** District / mandal display name from bundled GeoJSON property variants. */
export function getName(props: DistrictProperties | Record<string, unknown> | null | undefined): string {
  if (!props) return 'Unknown'
  const p = props as DistrictProperties & {
    district_name?: string
    NEW_DIST?: string
    NAME_2?: string
    DISTRICT?: string
  }
  const raw =
    strTrim(p.dtname) ||
    strTrim(p.district_name) ||
    strTrim(p.NEW_DIST) ||
    strTrim(p.NAME_2) ||
    strTrim(p.DISTRICT) ||
    strTrim(p.name)
  return raw.length > 0 ? raw : 'Unknown'
}

/** Map/list label (same as {@link getName} for this app). */
export function getPolygonMapLabel(props: DistrictProperties | Record<string, unknown> | null | undefined): string {
  return getName(props)
}

/** State code from GeoJSON only (`_state`). */
export function getStateCode(props: DistrictProperties | Record<string, unknown> | null | undefined): StateCode | null {
  if (!props) return null
  const s = (props as DistrictProperties)._state
  return s === 'AP' || s === 'TG' ? s : null
}

/** Human-readable state label for display only. */
export function getStateNameFromProps(props: DistrictProperties | Record<string, unknown> | null | undefined): string {
  if (!props) return ''
  const p = props as DistrictProperties
  if (p._state === 'AP') return 'Andhra Pradesh'
  if (p._state === 'TG') return 'Telangana'
  const st = p.stname
  if (typeof st === 'string' && st.trim().length > 0) return st.trim()
  return ''
}
