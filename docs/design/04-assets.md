# 04 · Asset pipeline

Generated masters (108 PNGs, ~210 MB) are **not** committed. They live in the shared archive
`f1land-generated.zip` (Google Drive, linked in the project thread) and unpack into `assets-src/`:

```
assets-src/{plates,cars,helmets,objects,badges,art,brand,textures}/<name>.png
```

`node scripts/build-assets.mjs` encodes them into `public/assets/<group>/<name>-<w>.{avif,webp}` and
regenerates `src/assets/manifest.ts` (size, mean colour for the placeholder, widths). It re-encodes only
masters newer than their outputs; `--force` rebuilds everything, `--only plates,objects` limits groups.
Flags are rasterised from `flag-icons` (MIT, dev dependency) for every country code in the data.

| Group | Widths | Notes |
|---|---|---|
| plates (B, F, G) | 390 / 780 / 1170 | AVIF q50 + WebP q72; largest 1170 AVIF is 121 KB |
| art (J, K) | 390 / 780 / 1024 | portrait scenes; transparent empty-state objects use 160 / 320 / 480 |
| cars (C) | 390 / 780 | alpha-trimmed |
| helmets, objects, badges (D, E, H) | 96 / 192 / 288 | alpha-trimmed and padded square; ≤ 16 KB at 192 |
| textures (I) | 512 | WebP only |

One device class (DPR 2, AVIF) downloads at most ~2.1 MB if it fetched every asset; everything is lazy
except hero plates marked `priority`.

Components: `<Art>` (plates/scenes with scrim), `<HeroPlate>`, `<Obj>` (objects/badges), `<Helmet>`,
`<CarArt>`, `<Flag>`. Lookups with fallbacks: `circuitPlate()`, `poolPlate()`, `helmetAsset()`, `carAsset()`,
`TYRE_OBJ` in `src/assets/index.ts`. Kitchen sink: `/dev/ui.html` (`node dev/shot-ui.mjs`).

To replace an image, drop a new PNG with the same name into `assets-src/<group>/` and rerun the script.
