import type { LatLngBoundsExpression } from 'leaflet'

/** Bundled district boundaries (Vite serves from `public/geojson/`). */
export const LOCAL_AP_DISTRICTS_GEOJSON = '/geojson/ap_districts.geojson'
export const LOCAL_TG_DISTRICTS_GEOJSON = '/geojson/tg_districts.geojson'
/** Bundled mandal polygons (Telangana + Andhra Pradesh). */
export const LOCAL_TG_MANDALS_GEOJSON = '/geojson/tg_mandals.geojson'
export const LOCAL_AP_MANDALS_GEOJSON = '/geojson/ap_mandals.geojson'

export const CARTO_POSITRON = {
  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '© OpenStreetMap contributors © CARTO',
  maxZoom: 18,
} as const

export const INITIAL_MAP = {
  center: [17.0, 80.5] as [number, number],
  zoom: 7,
}

export const AP_BOUNDS: LatLngBoundsExpression = [
  [12.5, 76.0],
  [20.2, 84.9],
]

export const TG_BOUNDS: LatLngBoundsExpression = [
  [15.6, 76.8],
  [19.9, 81.9],
]

export const BOTH_BOUNDS: LatLngBoundsExpression = [
  [12.4, 76.0],
  [20.3, 84.9],
]

export const AP_EXPECTED_DISTRICTS = 28
export const AP_APRIL_2022_DISTRICTS = 26

/** Dec 2025 reorganized districts — listed for awareness when polygons are missing */
export const AP_DEC_2025_NEW_DISTRICTS = [
  {
    name: 'Rampachodavaram',
    note: 'Carved from Alluri Sitarama Raju; HQ Rampachodavaram',
  },
  {
    name: 'Markapuram',
    note: 'Carved from Prakasam',
  },
  {
    name: 'Madanapalle',
    note: 'Carved from Annamayya (Rayachoti constituency shifted)',
  },
] as const

export const MAX_SELECTIONS = 6

export const README_LINKS = {
  datameet: 'https://github.com/datameet/maps',
  gadm: 'https://gadm.org/download_country.html',
  lgd: 'https://lgdirectory.gov.in/',
} as const
