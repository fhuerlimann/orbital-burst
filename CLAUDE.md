# orbital-burst: project handover

**One nuclear blast vs. 17,000 satellites.** This is an interactive 3D simulation of a high-altitude nuclear explosion. It covers the prompt X-ray flash, the artificial radiation belt that the fission electrons form, and the total ionizing dose this belt delivers to every active satellite in CelesTrak's catalogue.

The project was built in a claude.ai chat (23 Nov 2026) and handed over to Claude Code. The application in this folder is identical to the last published version (artifact "One nuclear blast vs. 17,000 satellites", version `1795464189-e5ed`). **Treat the current behaviour, look and defaults as intentional.** Every design decision below was requested or approved by the user. Don't "clean up" or restyle anything without being asked.

The user communicates tersely, often in one line ("Hide this", "Shorter title", "Only during the first second"). Make exactly the change requested, keep everything else as it is, and summarise briefly. The user is based in the Geneva area and writes in English.

---

## 1. Run, files, workflow

```bash
python3 -m http.server 8000      # sats.json is fetched, so file:// won't work
open http://localhost:8000
node tools/validate.js all       # physics regression (about 3 minutes total)
python3 tools/build_sats.py      # rebuild sats.json from data/satcat.csv
```

| Path | Purpose |
|---|---|
| `index.html` | **The entire app**: HTML, CSS and two inline scripts. No build step, no framework. |
| `sats.json` | 17,405 active satellites: `[name, norad_id, owner, group, perigee_km, apogee_km, incl_deg]`, one per line |
| `data/satcat.csv` | CelesTrak SATCAT export (latest launch 2026‑11‑20), the source of sats.json |
| `tools/build_sats.py` | SATCAT → sats.json, including the group classification. Reproduces the current file exactly. |
| `tools/physics.js` | Loads the physics core out of index.html into Node |
| `tools/validate.js` | Headless checks: `telstar`, `benchmark`, `starfish`, `flash`, `all` |
| `README.md` | Public README for GitHub |
| `.nojekyll` | So GitHub Pages serves the files as they are |

Runtime dependencies (CDN, pinned versions; keep them):
- `https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js`. A stub `window.echarts={registerMap:(n,g)=>window.WORLD=g}` is defined before it, so it just hands over GeoJSON (UTF8-encoded with encodeOffsets; the decoder is in the texture code). If it fails, hand-drawn continent polygons are the fallback.
- `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`
- Google Fonts: Archivo (variable wdth 62–125, wght 400–800) and IBM Plex Mono 400/500

Hosting: the claude.ai artifact (private until the user shares it) and the GitHub repo `fhuerlimann/orbital-burst` (public), served with GitHub Pages from `main` / root at https://fhuerlimann.github.io/orbital-burst/. Licence: MIT for the code (`LICENSE`); the CelesTrak satellite data is not covered by it.

---

## 2. Architecture of index.html

### Script 1: physics core (`//PHYS-START` … `//PHYS-END`, defines `var PHYS`)
Pure math with no DOM and no three.js, so Node can load it (`tools/physics.js`). **Keep the markers and keep it DOM-free.**

Units: distances in Earth radii (RE = 6371 km) unless noted, time in seconds. Coordinates: three.js convention, y = spin axis (north), x toward lon 0, z = −(lon 90°E) side. `geo(lat,lon,r)` gives `[r cosφ cosλ, r sinφ, −r cosφ sinλ]`.

- **Geomagnetic field: eccentric tilted dipole.** Pole `U = geo(80.8, −72.6)`; centre offset `O = geo(22, 142, 570 km)`, toward the western Pacific, which produces the South Atlantic Anomaly; basis `A, U, Zm`. `toLocal(p)` / `toFixed(l)` convert between Earth-fixed and magnetic-local coordinates. `magPoint(r, λ, φ)` uses the same convention in magnetic coordinates. Field-line geometry: `r = L cos²λ`. `Brat(λ) = √(1+3sin²λ)/cos⁶λ`.
- **Particle physics (guiding centre):**
  - `mirrorLat(sin²α_eq)` by bisection.
  - Bounce period `Tb = 4·L·RE/v · (1.3802 − 0.3198(y+√y))` (Hamlin), with y = sin α_eq.
  - Drift angular rate `wd = 3·L·γ·mₑ·v²·(0.35+0.15y)/(q·B0·RE²)`, B0 = 3.0e‑5 T, eastward for electrons. A 1 MeV electron at L≈1.2 has a drift period of about an hour.
- **`makeParticles(N, lat, lon, altKm, Ymt, src)`**, with N = 4000 in the app.
  - **Debris injection:** burst point plus an isotropic offset of |N(0,1)|·400 km, plus an upward rise of Exp(600 km) capped at 4000 km. This large spread is needed to reproduce Starfish's measured L≈1.1–2 belt; a compact cloud at 400 km over Johnston loses everything over the SAA.
  - **Energy:** the Carter fission beta spectrum `exp(−0.575E − 0.055E²)`, 0.05–7 MeV, by rejection sampling.
  - **Pitch angle:** isotropic at the injection point, mapped to the equatorial pitch angle and mirror latitude.
  - **Loss classification:** the mirror altitude is checked at 72 drift longitudes, both hemispheres. If it's below 100 km at the start longitude: `kind=1`, lost in the first bounce. If it's below 100 km later along the drift: `kind=2`, lost when the electron drifts there (drift loss cone, mostly over the SAA). Otherwise `kind=0`, with lifetime `τ = 1 day·exp((hmin−150)/70)`, capped at 5 years, where hmin is the lowest mirror altitude over the drift. This empirical atmospheric-scattering decay is roughly Starfish-like.
  - **Inventory:** `w = Ymt·1000·1.45e23 fissions/kt · 0.5 (fission fraction) · pf / N`, with pf = 0.40, 1.29 or 5.21 electrons per fission for the low, central and high sources. **Birth time `tb`:** log-uniform over 0.1–2 s (low) or 0.1–20 s (central); for high, a 1.29/5.21 share in 0.1–20 s and the rest log-uniform over 20 s to 6 months.
  - **Dose weight:** `k = w·v[cm/s]·doseFac(E)/pathLen(L, λm)`. `doseFac(E) = 2.72e‑8 · clamp((E−0.9)/1.0, 0, 1)` rad(Si)·cm² per electron behind 2 mm of aluminium (0.54 g/cm²; electrons below about 0.9 MeV are stopped; above that they deposit about 1.7 MeV·cm²/g in Si). `pathLen` is the field-line length between the mirror points.
  - Helpers: `alive(p,t) = t≥tb && t<tb+death`, and `phiAt(p,t) = φ0 + wd·(t−tb)`.
- **Dose-rate grid:** `buildGrid(P,t)` bins the weights `k` into L (0.01 steps, 1.00–2.50) × φ (36 bins) × mirror latitude (5° bins). It accumulates cumulatively from high to low mirror latitude, so a cell holds every electron that reaches that latitude. `gridA` is the same without φ.
- **`doseRate(pfixed, t)`** gives rad/s at an Earth-fixed position. It uses φ-resolved bins for t < 6 h and the φ-averaged grid after that (better statistics once drift has smoothed the belt), and divides by the flux-tube cross-section `A = 0.01·L·RE²·cos⁶λ/√(1+3sin²λ)` per radian.
- **Satellites:** `satFromOrbit` builds Keplerian orbits from perigee, apogee and inclination. It adds J2 nodal and apsidal precession and random RAAN, argument of perigee and mean anomaly, since SATCAT has no phase information. `satPos(s,t)` returns an inertial position (solving Kepler's equation). `inertialToFixed(p,t)` rotates by Earth rotation (ω = 7.2921e‑5 rad/s). `makeSats()` makes generic fallback shells, used only if sats.json fails to load.

### Script 2: app (wrapped in `{ }`)
- **Scene:**
  - three.js r128 with OrbitControls (damping, distance 1.4–30). **Rotation only starts when the drag begins on the Earth** (user request): a capture-phase `pointerdown`/`touchstart` listener on `#fig` ray-tests a sphere of radius 1.02 and sets `controls.enabled` for that drag; it is re-enabled on release. Two-finger touch and the mouse wheel always work. The cursor is `grab` only over the Earth.
  - `earth` group: rotates by ω·t. Its texture is a 2048×1024 canvas: ocean #121a26, land #33404f, faint country borders, a 30° graticule.
  - `mag` group: a child of `earth`, positioned at O with the basis A,U,Zm. It holds field lines, electron points and the density cloud.
  - Satellites are drawn in the inertial frame (`scene`).
- **Electrons:** `pts` (N points, additive blending, colour by energy). Bounce motion is drawn slowed down (period 1.6–3.2 s of wall time), with the true drift.
- **Density cloud** (`cloud`, on by default): `CK` blobs per electron (24 on desktop, 12 on mobile, with opacity scaled by 24/CK), opacity 0.1125 (raised 50% from 0.075 on user request), size 0.075, additive. Each blob has a fixed random bounce phase, ±0.012 in L (Gaussian), and a longitude spread of ±σ with `σ = min(π, 0.05 + 0.5·wd·age)`, imitating the energy spread within each simulated bundle. The electron dots are drawn at 0.525 opacity (raised 50% from 0.35 on user request); the "Radiation belt" checkbox hides both cloud and dots.
- **Field lines:** shells at L = 1.15, 1.3, 1.6 and 2.0, plus the belt-core shell (median L of trapped electrons) in pink. Off by default.
- **Burst effects** (`setupFx`/`updFx`, wall-clock time `fxT`, sizes scaled by `cbrt(Y/1.4)`):
  - **Flash:** a white flash sprite (opacity `min(1, 1.6·e^(−T/0.2))`, scale `(1.6+5T)k`) and a point light on Earth (`8·e^(−T/0.35)`).
  - **Full-view flash overlay** (`#bflash`): a white veil `0.9·e^(−T/0.07)` plus a radial glow at the projected burst position (`e^(−T/0.3)`). It's dimmed when the burst is behind Earth. Under prefers-reduced-motion the veil is off and the glow is at 40%.
  - **Debris shell:** a custom fresnel shader on a sphere stretched along B, cooling from white to orange to red over about 6 s.
  - **Ground effects:** a red X-ray-heated disc at 90 km (900 km·k radius); green and red aurora discs at both 100 km footpoints of the burst field line (for Johnston, the southern one is at 10°S 174°W, next to Samoa, matching history); a violet tube streamer along the field line.
  - **Flash-damage sphere** (`promptSph`): visible **only during the first second**, full opacity for 0.5 s then fading by 1 s (user request).
  - Everything is hidden after 90 s.
- **Dose integration:** `step(dt)` calls `buildGrid`, then for each satellite with r ≤ 3 RE: `dose += doseRate·dt·cal`. On mobile, steps are batched to at most 30 Hz. `cal` comes from the "Dose model" select: **0.15** (default, calibrated to Petersen et al.) or 1 (field-line model).
- **Damage:**
  - `thr` is in rad (from the threshold select in krad; default 40 krad).
  - `promptR() = √(0.7·Y·4.184e15 / (4π·F))/1000` km, with `F = 40 J/m²·max(1, thr/40 krad)`.
  - `s.dist` is computed at detonation: the distance from burst to satellite at t=0, or ∞ if the line of sight passes below 100 km altitude.
  - `isDead(s) = s.dose > thr || s.dist < promptR()`.
- **UI:** group table with a checkbox per group (`off` set; hidden groups still accumulate dose), All/None buttons, stats tiles, histogram (SVG, log x from 0.1 to 100,000 krad, 60 bins, dashed lines at 10/40/120/300 krad, the selected one solid in the accent colour, red bars past the threshold), HUD (Flash kills / Radiation belt kills, counted over **all** satellites whatever the group toggles; belt kills exclude flash kills; below them a pie chart `#pie` (CSS conic-gradient: flash kills warm white #fff4e0, belt kills red #ff4a3d, survivors translucent mint) with the caption "N% of all satellites lost", user request), clock (`T+ hh:mm:ss` → `d hh:mm` → days → years), a Burst label projected onto the globe (hidden when on the far side; the SAA label is permanently hidden), and a floating Detonate button (`.fab`) at the bottom right of the scene, shown on desktop and mobile (user request).
- **Time warp options:** real time, 1 min/s (default), 10 min/s, 1 h/s, 1 day/s, 1 week/s, 1 month/s. Wall dt is capped at 0.1 s per frame.

---

## 3. Calibration and validation (rerun after any physics change)

`node tools/validate.js <case>`. These are Monte Carlo runs: results vary from run to run, typically by ±5–15 percentage points on failure fractions.

| Check | Expected (this code) | Reference |
|---|---|---|
| `telstar`: Starfish, field-line model, mean >0.5 MeV flux on Telstar 1's orbit (952×5632 km, 44.8°), days 1–200 | ≈ 4–4.5e12 e/cm²/day | ≈ 6e12 measured (arXiv:1611.03390, Rosenzweig et al. 1963) |
| `flash`, 1 Mt at 500 km over the South Atlantic | radius 2414 km, about 2.7–2.9% of low-orbit satellites | Petersen 2026: 2.9% at 40 J/m² |
| `benchmark`: 1 Mt, 500 km, 20°S 35°W, central source, cal 0.15; failed at 40 krad, d1/d3/d7 | ≈ 16 / 93–95 / 100% | Petersen 2026: ≈ 25 / 78 / 98% |
| same, at 120 krad, d7 | ≈ 45–70% | Petersen 2026: ≈ 72% (97% by d15, >99% by d30) |
| `starfish`: 1.4 Mt, 400 km, Johnston | trapped ≈ 15%; 40 krad d3 ≈ 55–70%, d7 ≈ 98%; 120 krad d30 ≈ 95% | 1962: 7 satellites lost within months |

**Why `cal = 0.15`:** the uncalibrated field-line model puts electron density along field lines, concentrated where low orbits cross them. It reproduces the Telstar measurement but gives about 7× more low-orbit dose than Petersen et al., who spread the electrons uniformly over the shell volume and scale by the local retained fraction. The scale factor 0.15 was fitted to their benchmark failure timeline (fits ranged 0.11–0.20). Both options are exposed in the UI, and the user approved the calibrated default.

**Known gap:** at low yields this model is more forgiving than Petersen (100 kt: about 40% failed at 30 d against their about 90%; 10 kt: about 16% failed at 1 year against their 92%). The cause is faster loss of the low-mirroring electrons; they use radial diffusion and lifetimes up to 8 years. This is documented on the page as "read low-yield results as a lower bound". Possible fix: longer lifetimes for mid-altitude mirror points, then re-check Starfish and the benchmark.

---

## 4. Design system (user-specified; follow exactly)

**Typefaces** (adopted from the user's "Wing Section Solver" page):
- `--f-display: "Archivo","Helvetica Neue",Arial,sans-serif`
- `--f-body: "Archivo",system-ui,-apple-system,"Segoe UI",sans-serif`
- `--f-mono: "IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace`
- Base: body 14px / 1.5, Archivo at normal width.
- **Principle:** Archivo carries words, and its width axis sets the hierarchy. IBM Plex Mono carries every number, with tabular figures so values don't jitter while the simulation runs. Small labels are uppercase with wide tracking.

**Hierarchy:**
- **h1:** Archivo, stretch 72%, weight 800, `clamp(28px, 4.2vw, 44px)`, line-height 1. **Sentence case** ("One nuclear blast vs. 17,000 satellites"). The user rejected all caps and Frutiger.
- **Subtitle** (`.top p`): Archivo 16px, 400, muted, max 72ch. The user rejected mono for it.
- **Block headings** (`.blk h2`): Archivo, stretch 80%, 700, 17px. (The old side panel and its small uppercase `.ph` headings are gone; `.ph` CSS remains but is unused.)
- **Labels** (`.lab`, stat-tile labels, table headers, HUD labels, scene labels): Archivo 10.5px, 600, uppercase, 0.07–0.08em tracking, muted.
- **Buttons:** Archivo 11px, 700, uppercase, 0.08em tracking. Primary (Detonate) uses the accent background.
- **Large values:** IBM Plex Mono 21px, 500, tabular (stat tiles). HUD counters and clock: Plex Mono 26px (19px on phones).
- **Small data** (slider values, table numbers, notes, histogram text): Plex Mono 11–12px, muted. Search input: Plex Mono with 0.1em tracking.

**Colours** (dark is the default; `:root[data-theme=light]` switches to light):
- Dark: bg #0c1217, panel #131b22, text #e2e8ed, muted #8b99a5, lines #26323c, accent #ff8a4c, second series #6fb4ff
- Light: bg #e9edf1, panel #f8fafb, text #111b24, muted #56636f, lines #cfd7df, accent #c2410c, second series #1d5fa8
- **Approved exceptions:** the 3D stage is always dark (#05070b), including in light mode. Scene colours are independent of the theme: electrons and cloud **pink #ff4f8b**, healthy satellites **mint #8ff0c8**, failed satellites **red #ff4a3d** (histogram bars use the same mint and red). Flash kills in the HUD are warm white #fff4e0.

**Layout and approved UI decisions:**
- **Single column, user-specified order:** header (h1 and subtitle), the full-width 3D scene, then the speed bar (`.pb`), then `<main class="blocks">` with one `.blk` section each, in this order: 1 Scenario (controls in an auto-fit grid), 2 Dose across the visible satellites (histogram), 3 Satellite groups (All/None, table, catalogue note; the "Find a satellite" search was removed on user request), 4 Damage model, 5 Status (tiles; electron period note), 6 What is physically modelled, and what isn't, 7 References (CelesTrak SATCAT satellite data first, then Petersen 2026, Stassinopoulos 2015, arXiv:1611.03390, DTRA 2001, three.js / ECharts credits), 8 MIT License (links to LICENSE and the repo). There is no side panel any more.
- **Playback bar** (`.pb`, user request): directly under the 3D scene, inside the left column (`.left`). It has no heading and holds Simulation speed and the Field lines / Radiation belt / Satellites checkboxes (no Detonate or Pause buttons and no "Zoom out to GEO", user request; re-detonation happens via the floating `.fab` on the scene or by changing a scenario control). "Radiation belt" (`#cl`, formerly "Density cloud") is checked by default; unchecking it hides the density cloud **and** all electron points. "Satellites" (`#sv`) is checked by default and toggles `satG`, the group holding the satellite points and the search highlight.
- **HUD and clock have no background panels.** They use a text shadow only (user request).
- **Colour legend** (`.legend`, bottom left of the scene, user request): "Satellite" mint #8ff0c8 and "Killed satellite" red #ff4a3d, stacked, label style with text shadow and no panel. (It used to be hidden and also listed trapped electrons.)
- **The "South Atlantic Anomaly" scene label (`#lb2`) is hidden** (`style="display:none"`, and it is no longer positioned each frame); keep it in the DOM (user request).
- **Desktop (≥901px) side margins** (user request): `body` has a side gutter of max(24px, 4vw), and the header, stage and blocks are centred at max 1480px, with 1px `--line` borders left and right of the stage and blocks.
- Mobile (≤900px or coarse pointer): scene 58–62svh, `touch-action:none` on the scene, pixel ratio ≤1.5, CK=12, dose steps ≤30 Hz. At ≤600px: 16px form text, 44px targets, smaller HUD, "of all…" line hidden.
- The page's head `<style>` starts with the five-line design comment (VOICE / IDEA / PICTURE / COLOUR and TYPE / LAYOUT). Keep it updated.

---

## 5. Defaults (all user-requested)

- Location preset: **Johnston Island, 400 km (Starfish Prime site, 1962)**. Other presets: Kazakhstan 290 km (K‑3 site), equator mid-Atlantic 400 km, South Atlantic Anomaly 400 km, Custom. Presets set only latitude, longitude and altitude; **yield stays as selected**.
- Yield options: 10 kt, 100 kt, 1 Mt, **1.4 Mt (Starfish Prime), the default**, 10 Mt.
- Altitude slider 100–2000 km (2000 km matches Cosmos 2553's orbit), latitude −60…60, longitude −180…180. Changing any of them re-detonates.
- Threshold **40 krad(Si)** (options 10 / 40 / 120 / 300). Electron source **Central**. Dose model **calibrated (0.15)**.
- **Radiation belt (density cloud + electrons) on, field lines off, all satellite groups visible**, satellites shown.
- Camera: looks at 21°N 105°W from 4.51 RE (North America centred, the Starfish burst over Johnston visible on the western limb). User-requested.
- Speed: 1 minute per second. The page detonates once, 0.5 s after load (user request), or as soon as sats.json has loaded if that takes longer (`boot()` waits for both). Before that the scene shows Earth and satellites with no burst, and the Burst label is hidden.
- Satellite groups (the order in `GROUPS` must match build_sats.py): Starlink 11,199 · Other LEO 3,682 · OneWeb 651 · GEO and high orbits 593 · Qianfan / Guowang 545 · Kuiper 391 · Navigation (GPS, GLONASS, Galileo, BeiDou) 160 · Iridium 80 · Highly elliptical 55 · O3b / mPOWER 33 · Other MEO 16.

---

## 6. Content and framing

- The page title is also the `<title>`: "One nuclear blast vs. 17,000 satellites". The public framing is education and science communication: replaying Starfish Prime against today's fleet.
- The methods section on the page lists what is accurate, approximate, calibrated and illustrative. **Keep it in sync with any physics change.** It covers the field model, electron physics, inventory, dose, validation, the low-yield gap, thresholds, density cloud and burst appearance.
- Keep results explicitly labelled as a simplified model, and keep damage thresholds illustrative. Don't add features that turn it into a targeting or optimisation tool (for example "find the burst that kills the most satellites" or per-operator attack planning). The project's purpose is to show the indiscriminate, self-defeating nature of such a burst.
- Planned X post (history hook): "In 1962 a US nuclear test 400 km above the Pacific killed a third of the satellites in orbit. I built a 3D simulation of what the same physics would do to today's 17,000 satellites. Pick a site and yield, watch the radiation belt form."

---

## 7. Ideas not yet done (only if asked)

- Longer-lived mid-L electrons to close the low-yield gap with Petersen 2026 (re-validate afterwards).
- A full IGRF field instead of the eccentric dipole; natural inner-belt protons; solar-cell degradation; spacecraft charging.
- Load live TLEs (CelesTrak) with SGP4 (satellite.js) for real orbital phases.
- Intensity slider for the density cloud (offered, not requested).
- Social preview image (og:image) for X link cards.

## 8. Sources

- Petersen, Qin, Thiele & Philippe (2026), *Effects of a Nuclear Detonation in Low Earth Orbit*, arXiv:2611.09827: benchmark, source cases, 40/120 krad thresholds, 40 J/m² flash criterion, 50% fission fraction.
- Stassinopoulos (2015), NASA NTRS 20150018896: Starfish facts (1.4 Mt, 400 km, seven satellites lost, Telstar dose 100× expected).
- Telstar 1 flux of about 6×10¹² e/cm²/day: arXiv:1611.03390 (*Anthropogenic Space Weather*).
- DTRA (2001), HAND/HALEOS study.
- CelesTrak SATCAT, satellite catalogue.
- Cosmos 2553 (NORAD 51511): about 2000 km, 67.1°, linked by US officials to Russia's nuclear anti-satellite programme. Not active in the catalogue.
