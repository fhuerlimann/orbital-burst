# orbital-burst

**One nuclear blast vs. 17,000 satellites** – an interactive 3D simulation of how a high-altitude nuclear explosion creates an artificial radiation belt, and what that belt does to today's satellites.

Pick a burst location, altitude and yield, then watch the burst unfold. Fission-debris electrons get trapped in Earth's magnetic field. They bounce between hemispheres and drift east until they form a shell around the planet, then slowly decay, mostly over the South Atlantic Anomaly. Along the way, every active satellite builds up radiation dose until it fails.

The default scenario replays **Starfish Prime** (9 July 1962, 1.4 Mt, 400 km above Johnston Island). Within months that test disabled about a third of the satellites in orbit at the time.

## Features

- Rotating 3D Earth with a tilted, off-centre geomagnetic dipole, including the South Atlantic Anomaly
- Electrons drawn from the fission beta spectrum, with relativistic bounce and drift motion, loss cones and atmospheric decay
- All 17,405 active satellites from CelesTrak's catalogue (20 Nov 2026) on their real orbits (perigee, apogee, inclination, with precession from Earth's oblateness)
- Total ionizing dose in krad(Si) behind 2 mm of aluminium, with threshold presets of 10, 40, 120 and 300 krad
- Prompt X-ray flash damage, using a 40 J/m² fluence criterion with a line-of-sight check
- Burst visuals based on 1962 observations: flash, debris shell, red X-ray-heated patch, field-line streamer and aurora at both ends of the field line
- Live counters (flash kills, belt kills), mission clock, dose histogram, satellite search and toggles for each satellite group

## Run it

It's a static page with no build step. Because it loads `sats.json` with `fetch`, it has to be served over HTTP rather than opened as a file:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**GitHub Pages:** push the repository, then go to *Settings → Pages → Deploy from branch → main / root*. The empty `.nojekyll` file makes GitHub serve the files as they are.

## Files

| File | Contents |
|---|---|
| `index.html` | The whole application: HTML, CSS and JavaScript |
| `sats.json` | Active Earth-orbiting satellites in compact column form: name, NORAD ID, owner, group, perigee (km), apogee (km), inclination (hundredths of a degree) |
| `data/satcat.csv` | CelesTrak SATCAT export that sats.json is built from |
| `tools/build_sats.py` | Rebuilds sats.json from a SATCAT CSV (`python3 tools/build_sats.py`) |
| `tools/validate.js` | Headless physics checks (`node tools/validate.js all`) |
| `CLAUDE.md` | Full developer handover: architecture, physics, calibration, design system |

Libraries load from CDNs at runtime: [three.js](https://threejs.org) r128 (MIT) and the ECharts 4.9 world map (Apache 2.0).

## Model and validation

This is a simplified physics model for education, not a predictive tool. The page's methods section has the full details. In short:

- **Electron inventory:** 1.45×10²³ fissions per kiloton, assuming 50% of the yield comes from fission, times 0.40, 1.29 or 5.21 beta electrons per fission (the low, central and high source cases of Petersen et al., 2026).
- **Flux check:** for Starfish, the field-line model gives about 4.5×10¹² electrons/cm² per day above 0.5 MeV along Telstar 1's orbit. Telstar measured about 6×10¹².
- **Benchmark:** the default dose calibration reproduces the Petersen et al. (2026) case of 1 Mt at 500 km over the South Atlantic. The flash kills 2.7% of satellites (paper: 2.9%), and 95% fail at 40 krad by day 3 (paper: about 78%).
- **Known limitations:** low-yield results are conservative, because the belt decays too fast compared with radial-diffusion models. The model leaves out natural radiation belts, protons, solar-cell degradation, spacecraft charging and a full geomagnetic field model. Damage thresholds are illustrative. Real satellite tolerances vary widely and are mostly unpublished.

## Sources

- Petersen, Qin, Thiele & Philippe (2026), *Effects of a Nuclear Detonation in Low Earth Orbit*, arXiv:2611.09827
- E. G. Stassinopoulos (2015), *The STARFISH Exo-atmospheric, High-altitude Nuclear Weapons Test*, NASA NTRS 20150018896
- DTRA (2001), *High Altitude Nuclear Detonations (HAND) Against Low Earth Orbit Satellites*
- Satellite catalogue: [CelesTrak SATCAT](https://celestrak.org)

## License

The code is released under the [MIT License](LICENSE). The satellite data in `sats.json` and `data/satcat.csv` comes from CelesTrak and is not covered by this licence; credit CelesTrak when you reuse it.
