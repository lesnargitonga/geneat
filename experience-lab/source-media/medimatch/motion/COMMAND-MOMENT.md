# MediMatch command moment, 6 s loop

Cut from the real product recording `medimatch-detect-rank-route-impact-1920x1080.webm`.
Nothing added: the interface states the case and its own synthetic-data disclosure in frame.

Reproduce exactly (from the repository root):

```bash
node experience-lab/motion-system/tools/sample_frames.mjs \
  experience-lab/source-media/medimatch/motion/medimatch-detect-rank-route-impact-1920x1080.webm cut/ 4.3 10.3 145 o
# frames o000..o144 -> c000..c144 with an 8-frame linear fade at each end, so the loop has no seam
SIZE=1600x900 MAXRATE=2600000 experience-lab/motion-system/tools/encode_master.sh enc/ medimatch-command-moment-6s-1600x900 24 24
```

The 2026-10-01 version of this file was encoded with canvas + MediaRecorder and
hitched at every loop restart (one frame doubled, one skipped, 2 frames short).
Replaced by the frame-exact encode, which passes `check_decode.py` in Chromium and
Firefox for both containers.
