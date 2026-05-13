import { normalizeDistrictForMandals } from '../data/mandals'
import type { AutoDistanceState, MeasurePoint, SelectedFeature } from '../types'
import { getDistrictLabel, getMandalParentDistrictLabel } from '../utils/geo'

const FONT = "'IBM Plex Sans', sans-serif"

export interface SidebarProps {
  open: boolean
  onToggleOpen: () => void
  layout: 'desktop' | 'tablet' | 'mobile'
  items: SelectedFeature[]
  onRemove: (id: string) => void
  onClearAll: () => void
  pointA: MeasurePoint | null
  pointB: MeasurePoint | null
  distanceKm: number | null
  onMeasureBetweenSelected?: () => void
  onDistanceClear: () => void
  autoDistance: AutoDistanceState
  autoPairHint: string | null
  onAutoMeasure: () => void
  onAutoDistanceClear: () => void
  /** Exactly one district selected — show area info. */
  singleDistrict: SelectedFeature | null
  districtLoadError: boolean
  districtError: string | null
  onRetryDistricts: () => void
}

export function Sidebar({
  open,
  onToggleOpen,
  layout,
  items,
  onRemove,
  onClearAll,
  pointA,
  pointB,
  distanceKm,
  onMeasureBetweenSelected,
  onDistanceClear,
  autoDistance,
  autoPairHint,
  onAutoMeasure,
  onAutoDistanceClear,
  singleDistrict,
  districtLoadError,
  districtError,
  onRetryDistricts,
}: SidebarProps) {
  const overlay = layout === 'mobile' || layout === 'tablet'
  const p = singleDistrict?.feature.properties as { D_C?: string; DT_C?: string } | undefined
  const code = p?.D_C ?? p?.DT_C

  const selectedMandals = items.filter((i) => i.layer === 'mandal')
  // Allow distance measurement between any two selected mandals as long as
  // they are not the same district within the same state. Cross-state pairs
  // (TG mandal + AP mandal) are explicitly allowed, even when district names
  // coincidentally collide.
  const isSameDistrict = (a: SelectedFeature, b: SelectedFeature) =>
    a.state === b.state &&
    normalizeDistrictForMandals(String(a.feature.properties?.district ?? '')) ===
      normalizeDistrictForMandals(String(b.feature.properties?.district ?? ''))
  const showAutoMeasureButton =
    selectedMandals.length === 2 && !isSameDistrict(selectedMandals[0], selectedMandals[1])

  const autoMeasureButtonLabel =
    showAutoMeasureButton && selectedMandals[0] && selectedMandals[1]
      ? `↔ Measure: ${selectedMandals[0].name} → ${selectedMandals[1].name}`
      : ''

  const twoDistrictsOnly =
    items.length === 2 && items[0].layer === 'district' && items[1].layer === 'district'

  const mandalMandalMeasure =
    pointA &&
    pointB &&
    pointA.source === 'mandal' &&
    pointB.source === 'mandal' &&
    Boolean(pointA.sublabel) &&
    Boolean(pointB.sublabel)

  const districtDistrictMeasure = pointA && pointB && pointA.source === 'feature' && pointB.source === 'feature'

  const kmDecimals = mandalMandalMeasure ? 1 : 2

  return (
    <>
      {overlay && open ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="pointer-events-auto fixed inset-0 z-[1050] bg-black/20 md:hidden"
          onClick={onToggleOpen}
        />
      ) : null}

      <aside
        className={`pointer-events-auto fixed right-0 top-[52px] z-[1100] flex h-[calc(100dvh-52px)] w-[min(100vw,360px)] flex-col border-l border-[#e0e0e0] bg-white shadow-[-2px_0_12px_rgba(0,0,0,0.06)] transition-transform duration-200 md:relative md:top-0 md:z-0 md:h-full md:w-[320px] md:min-w-[280px] md:max-w-[360px] md:shrink-0 md:border-l md:shadow-none ${
          open ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
        style={{ fontFamily: FONT }}
      >
        <div className="flex items-center justify-between border-b border-[#eeeeee] px-3 py-2 md:hidden">
          <span className="text-[14px] font-semibold text-[#212121]">Panel</span>
          <button
            type="button"
            className="map-ui-focus rounded px-2 py-1 text-[13px] text-[#616161]"
            onClick={onToggleOpen}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {districtLoadError && districtError ? (
            <div className="mb-3 rounded border border-[#ffcdd2] bg-[#ffebee] px-2 py-2 text-[12px] text-[#b71c1c]">
              <p className="m-0 mb-1">{districtError}</p>
              <button type="button" className="text-[12px] font-medium underline" onClick={onRetryDistricts}>
                Retry
              </button>
            </div>
          ) : null}

          <section className="mb-5">
            <h2 className="section-header m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-[#757575]">
              Selected areas
            </h2>
            {items.length === 0 ? (
              <p className="m-0 text-[13px] text-[#757575]">Click map or use dropdowns to select areas.</p>
            ) : (
              <>
                <ul className="m-0 mb-2 flex list-none flex-col gap-2 p-0">
                  {items.map((it) => {
                    const parent =
                      it.layer === 'mandal'
                        ? getMandalParentDistrictLabel(it.feature.properties) ||
                          String(it.feature.properties?.district ?? '')
                        : ''
                    return (
                      <li key={it.id}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex min-h-[28px] items-center gap-2 rounded-[14px] border border-[#e0e0e0] bg-[#fafafa] py-1 pl-2 pr-1 text-[12px]">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full border border-[#e0e0e0]"
                              style={{ background: it.color }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-[#212121]">
                              {it.name}
                              <span className="ml-1 font-mono text-[11px] font-normal text-[#757575]">
                                · {it.state}
                                {it.layer === 'mandal' && parent ? ` · ${parent}` : ''}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="map-ui-focus flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#e53935] hover:bg-[#ffebee]"
                              aria-label={`Remove ${it.name}`}
                              onClick={() => onRemove(it.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {showAutoMeasureButton ? (
                  <button
                    type="button"
                    onClick={onAutoMeasure}
                    title={autoMeasureButtonLabel}
                    className="mt-2 flex w-full min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md border-0 bg-[#1565c0] px-2 py-2 text-xs font-semibold text-white hover:bg-[#1976d2]"
                  >
                    <span className="min-w-0 truncate">{autoMeasureButtonLabel}</span>
                  </button>
                ) : null}
                {autoPairHint ? (
                  <p className="m-0 mt-2 text-[12px] text-[#888]">{autoPairHint}</p>
                ) : null}
                {autoDistance?.ok === true ? (
                  <div className="mt-3 rounded-md border border-[#e0e0e0] bg-[#fafafa] p-3">
                    <h3 className="section-header m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-[#757575]">
                      Distance measurement
                    </h3>
                    <div className="space-y-0.5">
                      <div>
                        <p className="m-0 text-[13px] font-semibold leading-snug text-[#212121]">
                          {autoDistance.displayA.mandalName}
                        </p>
                        <p className="m-0 text-[11px] leading-snug text-[#757575]">
                          {autoDistance.displayA.district
                            ? `${autoDistance.displayA.district} district · ${autoDistance.displayA.state}`
                            : autoDistance.displayA.state}
                        </p>
                      </div>
                      <p className="m-0 py-1 text-center text-[14px] leading-none text-[#bdbdbd]">↕</p>
                      <div>
                        <p className="m-0 text-[13px] font-semibold leading-snug text-[#212121]">
                          {autoDistance.displayB.mandalName}
                        </p>
                        <p className="m-0 text-[11px] leading-snug text-[#757575]">
                          {autoDistance.displayB.district
                            ? `${autoDistance.displayB.district} district · ${autoDistance.displayB.state}`
                            : autoDistance.displayB.state}
                        </p>
                      </div>
                    </div>
                    <p
                      className="m-0 mt-2 text-[22px] font-bold leading-tight text-[#1565c0]"
                      style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
                    >
                      {autoDistance.km.toFixed(1)} km
                    </p>
                    <button
                      type="button"
                      onClick={onAutoDistanceClear}
                      className="m-0 mt-1.5 cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[#e53935] hover:underline"
                    >
                      Clear ×
                    </button>
                  </div>
                ) : null}
                {autoDistance?.ok === false ? (
                  <div className="mt-2 rounded border border-[#ffcdd2] bg-[#ffebee] px-2 py-2 text-[12px] text-[#b71c1c]">
                    <p className="m-0 mb-1">{autoDistance.error}</p>
                    <button
                      type="button"
                      onClick={onAutoDistanceClear}
                      className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-medium text-[#b71c1c] underline"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="map-ui-focus mt-2 text-[12px] font-medium text-[#00796b] underline"
                  onClick={onClearAll}
                >
                  Clear all
                </button>
              </>
            )}
          </section>

          <section className="mb-5">
            <h2 className="section-header m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-[#757575]">
              Distance measurement
            </h2>
            {!pointA && !pointB ? (
              <p className="m-0 text-[13px] text-[#757575]">
                Use Measure tool above to calculate distances.
              </p>
            ) : (
              <div className="space-y-2 text-[13px] text-[#212121]">
                {distanceKm !== null ? (
                  <p className="m-0 text-[18px] font-semibold leading-tight text-[#212121]">
                    {distanceKm.toFixed(kmDecimals)} km
                  </p>
                ) : null}
                {mandalMandalMeasure && pointA && pointB ? (
                  <>
                    <p className="m-0 leading-snug">
                      {pointA.label} · {pointA.sublabel}
                      <span className="text-[#757575]"> →</span>
                    </p>
                    <p className="m-0 leading-snug">
                      {pointB.label} · {pointB.sublabel}
                    </p>
                  </>
                ) : districtDistrictMeasure && pointA && pointB ? (
                  <p className="m-0 leading-snug">
                    {pointA.label} → {pointB.label}
                  </p>
                ) : (
                  <>
                    <p className="m-0">
                      <span className="text-[#757575]">A:</span>{' '}
                      <span className="font-mono text-xs">
                        {pointA?.sublabel ? `${pointA.label} · ${pointA.sublabel}` : (pointA?.label ?? '—')}
                      </span>
                    </p>
                    <p className="m-0">
                      <span className="text-[#757575]">B:</span>{' '}
                      <span className="font-mono text-xs">
                        {pointB?.sublabel ? `${pointB.label} · ${pointB.sublabel}` : (pointB?.label ?? '—')}
                      </span>
                    </p>
                  </>
                )}
                <button
                  type="button"
                  className="map-ui-focus rounded border border-[#e0e0e0] bg-white px-2 py-1 text-[12px] font-medium text-[#424242] hover:bg-[#f5f5f5]"
                  onClick={onDistanceClear}
                >
                  Clear
                </button>
              </div>
            )}
            {twoDistrictsOnly && onMeasureBetweenSelected ? (
              <button
                type="button"
                className="map-ui-focus mt-2 w-full rounded border border-[#00796b] bg-[#e0f2f1] py-2 text-[12px] font-semibold text-[#00796b] hover:bg-[#b2dfdb]"
                onClick={onMeasureBetweenSelected}
              >
                Measure between these 2
              </button>
            ) : null}
          </section>

          {singleDistrict ? (
            <section>
              <h2 className="section-header m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-[#757575]">
                Area info
              </h2>
              <dl className="m-0 space-y-1 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#757575]">Name</dt>
                  <dd className="m-0 font-medium">{getDistrictLabel(singleDistrict.feature.properties)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#757575]">State</dt>
                  <dd className="m-0 font-mono">{singleDistrict.state}</dd>
                </div>
                {code !== undefined && code !== null && String(code).length > 0 ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#757575]">District code</dt>
                    <dd className="m-0 font-mono">{String(code)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}
        </div>
      </aside>

      {layout === 'mobile' || layout === 'tablet' ? (
        <button
          type="button"
          aria-label="Open sidebar"
          className="pointer-events-auto fixed bottom-4 right-4 z-[1080] flex h-12 w-12 items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-[#212121] shadow-md md:hidden"
          onClick={onToggleOpen}
        >
          ☰
        </button>
      ) : null}
    </>
  )
}
