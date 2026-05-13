# Andhra Pradesh & Telangana Field Map

Geographic intelligence map for field operations across **Andhra Pradesh** and **Telangana** (post–June 2014 bifurcation). Built with React 18, Vite, TypeScript, Leaflet, Turf, and Tailwind CSS.

## Setup

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (typically `http://localhost:5173`).

```bash
npm run build   # production bundle
npm run preview # serve production build locally
```

## District GeoJSON (local files)

The app loads bundled districts from `public/geojson/`:

- `ap_districts.geojson` — Andhra Pradesh districts  
- `tg_districts.geojson` — Telangana districts (legacy name `telangana_districts.geojson` is also tried)

To **refresh** these files from the Geohacker India district dump plus GADM Telangana fallback when the dump has no `NAME_1: Telangana` row:

```bash
curl -L "https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson" \
  -o public/geojson/india_districts_raw.geojson

# Optional: unzip GADM India level 2 to public/geojson/gadm_extract/gadm41_IND_2.json
# (see scripts/extract-district-geojson.mjs header)

npm run geo:extract
```

The script writes `ap_districts.geojson` and `tg_districts.geojson`. If counts are still low (Telangana often missing from the Geohacker file), replace `tg_districts.geojson` with a full 33-district GeoJSON from an official or licensed source, then reload the app.

Optional fallback URL in code: `public/geojson/india_districts.geojson` (copy of a large India-wide file) for the district loader’s second-stage filter.

## Mandal / block GeoJSON (optional)

The app first tries DataMeet `Blocks/Andhra_Pradesh.geojson` and `Blocks/Telangana.geojson`. If those fail, it looks for:

- `public/geojson/AP_blocks.geojson`
- `public/geojson/TG_blocks.geojson`

## References

- [DataMeet India Maps](https://github.com/datameet/maps) — open community boundary datasets.  
- [GADM](https://gadm.org/download_country.html) — administrative boundaries (used in the extract script when needed).  

## Scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Start Vite dev server                            |
| `npm run build`    | Typecheck + production build                     |
| `npm run lint`     | ESLint                                           |
| `npm run geo:extract` | Build `ap_districts.geojson` / `tg_districts.geojson` from raw inputs |

## License

Application code is provided as-is for your use. **Verify data licenses** for any GeoJSON you attach (DataMeet, GADM, government portals, etc.) before redistribution.
