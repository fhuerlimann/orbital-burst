#!/usr/bin/env node
// Headless validation of the physics core in index.html.
// Usage: node tools/validate.js [telstar|benchmark|starfish|flash|all]
// 'all' takes ~5-8 minutes. Expected results are documented in CLAUDE.md.
const fs = require('fs'), path = require('path');
const load = require('./physics');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sats.json'), 'utf8'));
const CAL = 0.15; // must match the default "Dose model" option in index.html

function flashKills(P_, S, lat, lon, alt, Y, F = 40) {
  const bp = P_.geo(lat, lon, 1 + alt / 6371), Rb = 1 + 100 / 6371;
  const R = Math.sqrt(0.7 * Y * 4.184e15 / (4 * Math.PI * F)) / 1000;
  let n = 0;
  for (const s of S) {
    const q = P_.satPos(s, 0), d = [q[0] - bp[0], q[1] - bp[1], q[2] - bp[2]];
    const L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    let k = -(bp[0] * d[0] + bp[1] * d[1] + bp[2] * d[2]) / L2; k = Math.max(0, Math.min(1, k));
    const c = Math.hypot(bp[0] + k * d[0], bp[1] + k * d[1], bp[2] + k * d[2]);
    s.pk = !(c < Rb) && Math.sqrt(L2) * 6371 < R; if (s.pk) n++;
  }
  return { R, n };
}

function scenario(label, lat, lon, alt, Y, days, cal = CAL) {
  const P_ = load(), N = 4000;
  const P = P_.makeParticles(N, lat, lon, alt, Y, 'central');
  const S = P_.makeSatsFromData(rows).filter(s => s.per < 2000 && s.apo < 2000);
  const fk = flashKills(P_, S, lat, lon, alt, Y);
  const trapped = P.filter(p => p.kind === 0).length / N;
  let t = 0, ci = 0; const out = [];
  const cps = days.map(d => d * 86400);
  while (ci < cps.length) {
    const dt = t < 7 * 86400 ? 120 : t < 60 * 86400 ? 900 : 3600;
    P_.buildGrid(P, t);
    for (const s of S) s.dose += P_.doseRate(P_.inertialToFixed(P_.satPos(s, t), t), t) * dt * cal;
    t += dt;
    if (t >= cps[ci]) {
      const f = th => Math.round(100 * S.filter(s => s.pk || s.dose > th).length / S.length);
      out.push(`d${days[ci]}: ${f(4e4)}% / ${f(1.2e5)}%`); ci++;
    }
  }
  console.log(`${label}\n  trapped ${(100 * trapped).toFixed(0)}% | flash radius ${Math.round(fk.R)} km, kills ${(100 * fk.n / S.length).toFixed(1)}% of LEO\n  failed @40 krad / @120 krad: ${out.join(' | ')}`);
}

function telstar() {
  const P_ = load({ fluxMode: true }), N = 5000;
  const P = P_.makeParticles(N, 16.7, -169.5, 400, 1.4, 'central');
  const reps = []; for (let i = 0; i < 40; i++) reps.push(P_.makeSatsFromData([['T', 'x', 'US', 'x', 952, 5632, 44.8]])[0]);
  let t = 86400, flu = 0; const T = 200 * 86400;
  while (t < T) { P_.buildGrid(P, t); let f = 0; for (const s of reps) f += P_.doseRate(P_.inertialToFixed(P_.satPos(s, t), t), t); flu += f / reps.length * 1800; t += 1800; }
  console.log(`Telstar 1 orbit after Starfish (field-line model, uncalibrated)\n  mean >0.5 MeV omnidirectional flux: ${(flu / (T - 86400) * 86400).toExponential(2)} e/cm²/day   (measured ≈ 6e12)`);
}

const which = process.argv[2] || 'all';
if (which === 'telstar' || which === 'all') telstar();
if (which === 'benchmark' || which === 'all') scenario('Petersen et al. 2026 benchmark: 1 Mt, 500 km, 20°S 35°W', -20, -35, 500, 1, [1, 3, 7]);
if (which === 'starfish' || which === 'all') scenario('Starfish Prime: 1.4 Mt, 400 km, Johnston Island', 16.7, -169.5, 400, 1.4, [1, 3, 7, 30]);
if (which === 'flash') { const P_ = load(); const S = P_.makeSatsFromData(rows).filter(s => s.per < 2000 && s.apo < 2000);
  for (const Y of [0.01, 0.1, 1, 1.4, 10]) { const r = flashKills(P_, S, -20, -35, 500, Y); console.log(`${Y} Mt: flash radius ${Math.round(r.R)} km, kills ${(100 * r.n / S.length).toFixed(1)}%`); } }
