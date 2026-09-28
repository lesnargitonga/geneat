# Where every asset came from

- medimatch-map.svg: outline from MediMatch client/src/data/kenya.ts (Natural Earth 50m, public domain); facility names and coordinates from server/src/mock/db.ts ids 2-17; transfers from the supply panel in docs/screenshots/conference-command-routed.png, origins matched by straight-line distance within 6 km.

- sentinel-mission.svg: LesnarAI training/px4_waypoints.json, local metres from W1. sentinel-columns.json: the CSV header in training/px4_teacher_collect_gz.py, 59 columns.

- sentinel-record.svg: telemetry.json from geneat experience/lesnarai-v5-static (experience-lab/creative-reset/final2), the aggregate of 87 seg_diag CSVs; totals asserted against the evidence registry EV-SENTINEL-DETECT-01.

- medimatch-*: MediMatch docs/screenshots (the interface itself). bizmtaani, carepro, jamii, geneat, hazina, biz-m-*: captures already published on the v4 site (geneat experience/lesnarai-v4-home media/).

- reel/*.mp4: 1000x624 screen recordings from geneat commit ccf4d69, removed from v3 in 396f5ac for weight. Audio stripped, video stream copied. Prototype material only: re-record before any release.

- fonts/mona-sans.woff2: Mona Sans (SIL OFL 1.1) from @fontsource-variable/mona-sans, limited to wght 400-700 and wdth 100-125, Basic Latin plus the few symbols the page uses.
