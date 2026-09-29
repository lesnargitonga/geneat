# Where every asset came from

- medimatch-map.svg: outline from MediMatch client/src/data/kenya.ts (Natural Earth 50m, public domain); facility names and coordinates from server/src/mock/db.ts ids 2-17; transfers from the supply panel in docs/screenshots/conference-command-routed.png, origins matched by straight-line distance within 6 km.

- sentinel-mission.svg: sealed simulation run px4_teacher_20260929_082014_d1 on lesnargitonga/lesnarai branch evidence/sitl-run-px4_teacher_20260929_082014_d1. Planned box from its mission.json (the waypoints dispatched), local metres from home; flown path from telemetry_live_0.csv (sha256 68f064929b56a279...), 608 samples with a position, drawn as recorded without interpolation. Distance flown counts only samples at least 0.5 m apart.

- sentinel-columns.json: the CSV header in training/px4_teacher_collect_gz.py, 59 columns.

- flight.json: every second sample of px4_teacher_20260929_082014_d1's sealed telemetry (positions in metres from home, altitude, ground speed, heading) and the events its teacher log stamped. The CSV, mission.json and teacher log are each checked against the run's MANIFEST.json before anything is written.

- medimatch-*: MediMatch docs/screenshots (the interface itself). bizmtaani, carepro, jamii, geneat, hazina, biz-m-*: captures already published on the v4 site (geneat experience/lesnarai-v4-home media/).

- reel/*.mp4: 1000x624 screen recordings from geneat commit ccf4d69, removed from v3 in 396f5ac for weight. Audio stripped, video stream copied. Prototype material only: re-record before any release.

- reel/showreel.*: seconds 1 to 4 of each of the five recordings above, cross-faded, no other change. reel/*.webm: VP9 copies of the same recordings.

- vendor/*.min.js: GSAP 3.15.0 (gsap, ScrollTrigger, SplitText, DrawSVGPlugin, ScrambleTextPlugin) from the npm package, unchanged. GSAP's standard license: free, including commercial use.

- fonts/mona-sans.woff2: Mona Sans (SIL OFL 1.1) from @fontsource-variable/mona-sans, limited to wght 400-700 and wdth 100-125, Basic Latin plus the few symbols the page uses.
