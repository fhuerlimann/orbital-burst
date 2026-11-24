#!/usr/bin/env python3
"""Rebuild sats.json from a CelesTrak SATCAT CSV.

Usage:  python3 tools/build_sats.py [data/satcat.csv] [sats.json]

Keeps active (+ P B S X), Earth-orbiting, not-decayed objects with orbit data.
Output: one compact JSON object in column form (format "sats-v2"), sorted by
group, then perigee, then apogee, which compresses well:
  groups  [[group_name, count], ...]   rows are stored group by group in this order
  owners  [owner_code, ...]            looked up by the `owner` index column
  name, id, owner, per, apo            one value per satellite (per/apo in km)
  inc                                  inclination in hundredths of a degree
Group names must match GROUPS in index.html.
"""
import csv, json, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'data/satcat.csv'
dst = sys.argv[2] if len(sys.argv) > 2 else 'sats.json'

NAV = ('NAVSTAR', 'GPS ', 'GSAT0', 'GALILEO', 'BEIDOU', 'COMPASS', 'QZS', 'IRNSS', 'NVS-')

def group(r):
    n = r['OBJECT_NAME']; per, apo = int(r['PERIGEE']), int(r['APOGEE']); a = (per + apo) / 2
    if n.startswith('STARLINK'): return 'Starlink'
    if n.startswith('ONEWEB'): return 'OneWeb'
    if 'KUIPER' in n: return 'Kuiper'
    if n.startswith(('QIANFAN', 'GUOWANG', 'G60', 'SATNET', 'HULIANWANG')): return 'Qianfan / Guowang'
    if n.startswith('IRIDIUM'): return 'Iridium'
    if a < 2000: return 'Other LEO'
    # medium and high orbits
    if n.startswith(NAV) or 'GLONASS' in n or (n.startswith('COSMOS') and 18500 < per < 19800 and apo < 19800):
        return 'Navigation (GPS, GLONASS, Galileo, BeiDou)'
    if n.startswith(('O3B', '03B')): return 'O3b / mPOWER'
    if apo - per > 5000: return 'Highly elliptical'
    if a < 30000: return 'Other MEO'
    return 'GEO and high orbits'

rows = list(csv.DictReader(open(src, newline='')))
act = [r for r in rows if r['OPS_STATUS_CODE'] in ('+', 'P', 'B', 'S', 'X') and r['ORBIT_CENTER'] == 'EA'
       and not r['DECAY_DATE'] and r['APOGEE'] and r['PERIGEE'] and r['INCLINATION']]
out = [[r['OBJECT_NAME'], r['NORAD_CAT_ID'], r['OWNER'], group(r), int(r['PERIGEE']), int(r['APOGEE']), float(r['INCLINATION'])] for r in act]
out.sort(key=lambda x: (x[3], x[4], x[5], int(x[1])))
groups, owners = [], sorted({x[2] for x in out})
for x in out:
    if groups and groups[-1][0] == x[3]: groups[-1][1] += 1
    else: groups.append([x[3], 1])
oi = {o: i for i, o in enumerate(owners)}
cols = {
    'format': 'sats-v2',
    'source': 'CelesTrak SATCAT',
    'groups': groups,
    'owners': owners,
    'name': [x[0] for x in out],
    'id': [int(x[1]) for x in out],
    'owner': [oi[x[2]] for x in out],
    'per': [x[4] for x in out],
    'apo': [x[5] for x in out],
    'inc': [round(x[6] * 100) for x in out],
}
with open(dst, 'w') as f:
    f.write('{\n' + ',\n'.join(json.dumps(k) + ':' + json.dumps(v, separators=(',', ':'), ensure_ascii=False) for k, v in cols.items()) + '\n}\n')
print(f'{len(out)} satellites written to {dst}')
