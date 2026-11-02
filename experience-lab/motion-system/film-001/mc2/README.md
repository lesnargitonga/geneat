# Film 001 — Master Candidate 2

27.75 s · 1920×1080 · 24 fps · WebM (VP9 + Opus) and MP4 (H.264 + AAC) from one
frame sequence and one WAV master, encoded with `motion-system/tools/encode_master.sh`.

## What changed from MC1 and the recut

- **The opening.** The generated Higgsfield plate is gone. The film now opens on a
  true-3D deterministic reconstruction (see `RECONSTRUCTION.md`) that resolves into
  the real frame 0321, followed by *Reality opens*, the real frame separating into the
  surfaces it is made of. **Nothing generated appears anywhere in MC2.**
- **Shot 002** starts at its frame 24. It was built to hold still on the previous
  shot's last frame for 27 frames; after *Reality opens*' own soft landing that read as a
  dead beat. Three still frames remain and its overlays fade in over an 8-frame seam.
- **Sound** is MC1's design, re-expressed relative to section starts read from the
  edit (`edit.json`), with a new opening: the room bed, then the physical cues
  withdrawn as recorded time decelerates, so the 0321 freeze arrives in near-silence
  and the real frame brings the room back. Nothing imitates rotor noise.
- **Encoding** is frame-exact. MC1 and the recut came out of real-time MediaRecorder
  capture, measured doubling and skipping frames.

## Edit

| section | frames | starts | length |
|---|---|---|---|
| true-3D, dissolving into real 0321 over its last 16 frames | 140 | 0.00 s | 5.83 s |
| Reality opens | 96 | 5.83 s | 4.00 s |
| Shot 002, architecture | 168 | 9.83 s | 7.00 s |
| Shot 003, operator replay | 102 | 16.83 s | 4.25 s |
| Shot 004, the explanation collapses (real 0321 restored at 23.67 s) | 108 | 21.08 s | 4.50 s |
| ending: 0321 hold, 0323, black | 52 | 25.58 s | 2.17 s |

Locked editorial structure, unchanged: world → aircraft reveal → 0321 freeze →
spatial system journey → operator replay → spatial collapse → 0321 → 0323 → black.

## Rebuild

`film/` holds the depth layers and scene for *Reality opens*, Shot 002 with the recut's
contrast edits, the grade, the assembly and the sound. The operator frames are
`tools/sample_frames.mjs` on `operator-replay/video/op-sealed-run-through-operator-surface-1920x1080.webm`
at 99.50–103.75 s (102 frames) and 103.7917–104.4583 s (17 frames).

## Site encode, 1280×720 (2026-11-01)

The site served the 1920×1080 master (WebM 3,966,071 B, MP4 4,282,823 B, audio at 192 kb/s). It
now serves a 720p cut of the same picture and sound:

```bash
C=/srv/ai/cache/film001-720; T=experience-lab/motion-system/tools; M=experience-lab/motion-system/film-001/mc2/master
node $T/sample_frames.mjs $M/sentinel-film-001-mc2.webm $C/src 0.0208333 27.7291667 666 f   # every frame, at its centre
SIZE=1280x720 MAXRATE=600000 AUDIO=$M/sentinel-film-001-mc2-sound-48k.wav ABITRATE=96000 bash $T/encode_master.sh $C/src $C/film001-720 24 32
ONLY=mp4 SIZE=1280x720 MAXRATE=800000 AUDIO=$M/sentinel-film-001-mc2-sound-48k.wav ABITRATE=96000 bash $T/encode_master.sh $C/src $C/film001-720 24 27
```

| File | Size | Decode gate (Chromium and Firefox; reference = master frames, Lanczos to 1280×720) |
|---|---|---|
| `sentinel-film-001.webm` | 1,173,085 B | 666/666 frames; 0 doubled, 0 skipped, 0 off timeline; PSNR min 37.8 / median 41.5 dB |
| `sentinel-film-001.mp4` | 1,389,236 B | 666/666; 0 / 0 / 0; PSNR min 37.0 / median 41.0 dB |

Sound: Opus and AAC at 96 kb/s from the same 48 kHz WAV master (was 192 kb/s). The frames come
from the lossy master, not the original sequence, so this is a second generation. At this size and
bitrate the decoded PSNR against the master stays at 37 dB or higher.
