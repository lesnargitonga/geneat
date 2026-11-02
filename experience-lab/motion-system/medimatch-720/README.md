# MediMatch command moment, 1280×720 (2026-11-01)

**Superseded on 2026-11-01 by `../medimatch-roads/`.** The files below were removed from the site; this recipe is kept as a record.

The site's MediMatch recording, re-cut from the original product recording and encoded through
the LESNAR Motion Pipeline at 1280×720. It replaces the 1600×900 loop (1.49 MB WebM, 1.02 MB MP4).

```bash
W=/srv/ai/cache/medimatch-720
node experience-lab/motion-system/tools/sample_frames.mjs \
  experience-lab/source-media/medimatch/motion/medimatch-detect-rank-route-impact-1920x1080.webm $W/cut 4.3 10.3 145 o
python3 experience-lab/motion-system/medimatch-720/make_frames.py $W/cut $W/frames     # 8-frame fades, c000..c144
SIZE=1280x720 MAXRATE=560000 bash experience-lab/motion-system/tools/encode_master.sh $W/frames $W/mm720 24 32
ONLY=mp4 SIZE=1280x720 MAXRATE=900000 bash experience-lab/motion-system/tools/encode_master.sh $W/frames $W/mm720 24 27
# decode gate, per engine and container (reference = frames resized to 1280x720, Lanczos)
node experience-lab/motion-system/tools/decode_frames.mjs $W/mm720.webm $W/dec 145 24 chromium
python3 experience-lab/motion-system/tools/check_decode.py $W/ref720 $W/dec 24
```

| File | Size | Decode gate (Chromium and Firefox) |
|---|---|---|
| `medimatch-command-720.webm` | 421,120 B | 145/145 frames; 0 doubled, 0 skipped, 0 off timeline; PSNR min 33.3 / median 36.9 dB |
| `medimatch-command-720.mp4` | 453,058 B | 145/145 frames; 0 doubled, 0 skipped, 0 off timeline; PSNR min 32.9 / median 36.8 dB |

The MP4 is encoded at q27, not q32. At q32 (262 KB), both engines put one moving frame off its
timeline, so the gate failed it.

Poster: `medimatch-command-720-poster.jpg`, frame 96 of the reference, 1280×720, 56.5 KB.
The page embeds the recording click-to-play (`preload="none"`), so nothing downloads until asked.
