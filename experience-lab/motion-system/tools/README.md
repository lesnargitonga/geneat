# LESNAR Motion Pipeline

Company infrastructure, not project tooling. Every LESNAR motion asset goes
through it; MediMatch and Sentinel Film 001 MC2 already have.

```
source (recordings, real assets, sealed state)
  ↓
deterministic frames
  ↓
audio master
  ↓
frame-exact encoder (encode_master.sh)
  ├── VP9 / WebM
  └── H.264 / MP4
  ↓
browser decode verification (decode_frames.mjs + check_decode.py)
  ↓
website asset
```

Every delivered asset is encoded with `encode_master.sh` and must pass
`check_decode.py` in Chromium and Firefox before it ships. There is no other
production encoder.

## Never: canvas + MediaRecorder

Real-time capture paces frames by a wall clock, so it drops and doubles them
whenever the encoder lags. Measured on 2026-10-01 by decoding every frame:

| asset | encoded with MediaRecorder |
|---|---|
| Film 001 recut | 11 moving frames doubled, 9 skipped; picture and sound both ~125 ms late |
| MediMatch loop | a hitch at every loop restart, 2 frames short |
| Reality opens | one frame dropped at peak camera speed |

Re-encoded with `encode_master.sh`, all three measured 0 doubled, 0 skipped,
0 off-timeline, audio at 0.00 ms.

## Encode

```bash
AUDIO=master.wav tools/encode_master.sh frames/ out/film 24 18
# -> out/film.webm (VP9 + Opus) and out/film.mp4 (H.264 High + AAC), same frames, same audio
SIZE=1600x900 MAXRATE=2600000 tools/encode_master.sh frames/ out/loop 24 24   # scaled, no audio
```

Frames are a contiguous PNG sequence from index 0 (`f000.png`, `f0000.png`, `c000.png`).
Pages carry both files, WebM first, MP4 as the fallback for Safari:

```html
<video ...><source src="clip.webm" type="video/webm"><source src="clip.mp4" type="video/mp4"></video>
```

## Verify — required for every encode

```bash
node tools/decode_frames.mjs out/film.webm /tmp/dec 512 24 chromium
python tools/check_decode.py frames/ /tmp/dec 24 master.wav      # exit 1 on any failure
```

`decode_frames.mjs` decodes the file as a viewer's browser does: every frame at
(i + 0.5)/fps, plus a playback probe, a seek probe and the engine's own audio
decode, with a timeout on every wait. `check_decode.py` fails on a seek timeout,
playback that does not advance, a wrong duration, any moving frame doubled or
skipped or off its timeline, audio offset more than 1 ms from the master, or a
decoded true peak more than 0.5 dB above the master's. Run it for both
containers in `chromium` and `firefox`. Safari cannot be driven on the build
machine (Playwright WebKit fails to load pages); the MP4 is its standards path.

## Gotchas this encoder already handles, all measured

- **Colour.** BT.601 limited range round-trips flat colours to within 2 levels
  in Chromium and Firefox. BT.709 signalling caused a colour-managed shift
  (blue −9 levels); full-range flags were ignored.
- **Opus in WebM.** GStreamer's webmmux leaves the keyframe flag clear on Opus
  blocks; Chromium then stalls on play and seek. `webm_audio_keyframes.py` sets
  that bit in place.
- **AAC in MP4.** mp4mux presents the 1024 samples of encoder priming (sound
  21.33 ms late). `mp4_aac_priming.py` marks them in the audio edit list, in
  place, so players trim them.
- **Silent exits.** Under `pipefail`, `find | sort | head` can SIGPIPE and make
  `set -e` quit before encoding; the script uses a glob, and deletes the output
  first so a failed encode never leaves an older file to be verified.
