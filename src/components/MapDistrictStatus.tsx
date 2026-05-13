interface MapDistrictStatusProps {
  apLoading: boolean
  tgLoading: boolean
  apError: string | null
  tgError: string | null
  onRetryAp: () => void
  onRetryTg: () => void
}

export function MapDistrictStatus({
  apLoading,
  tgLoading,
  apError,
  tgError,
  onRetryAp,
  onRetryTg,
}: MapDistrictStatusProps) {
  const districtsLoading = apLoading || tgLoading
  const hasErr = Boolean(apError || tgError)

  return (
    <>
      {hasErr ? (
        <div
          className="pointer-events-auto absolute left-3 right-3 top-3 z-[950] rounded-md border border-[#EF9A9A] bg-[#FFEBEE] px-3 py-2 font-sans text-[13px] text-[#B71C1C] shadow-sm"
          style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          {apError ? (
            <p className="m-0 mb-1 flex flex-wrap items-center gap-2">
              <span>⚠ Andhra Pradesh: {apError}</span>
              <button
                type="button"
                className="map-ui-focus cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#B71C1C] underline"
                onClick={onRetryAp}
              >
                Retry
              </button>
            </p>
          ) : null}
          {tgError ? (
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span>⚠ Telangana: {tgError}</span>
              <button
                type="button"
                className="map-ui-focus cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#B71C1C] underline"
                onClick={onRetryTg}
              >
                Retry
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {districtsLoading && !hasErr ? (
        <div className="pointer-events-none absolute inset-0 z-[940] flex items-center justify-center">
          <div
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-[#E0E0E0] bg-white px-6 py-4 text-[14px] text-[#212121] shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
            style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#00796B] border-t-transparent"
              aria-hidden
            />
            Loading district boundaries…
          </div>
        </div>
      ) : null}
    </>
  )
}
