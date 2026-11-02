# Operation Sentinel flight film (2026-11-02)

The Sentinel page's film. It replaces Film 001 MC2, which the owner judged the weakest piece of
Sentinel media: a reconstruction rather than the system flying. This is the system flying.

**Source:** Episode 003 capture `px4_teacher_capture_20261031_013252_follow_bcf9e52-follow.mp4`
(1080×1920, 30 fps, 104.1 s, sha256 1496613609824f1d…). A real PX4 SITL + Gazebo flight of the
corrected autonomy stack (`bcf9e52`) flying Run 2's sealed mission to completion, filmed by a
follow camera moved every frame by `follow_cam.py`. Approved by the owner on 31 Oct 2026; full
provenance in `~/Productions/LESNAR-Episode-003/02-footage/captures/PROVENANCE.md`.

```bash
O=/srv/ai/cache/sentinel-follow; T=experience-lab/motion-system/tools
gst-launch-1.0 -q filesrc location=<source.mp4> ! qtdemux ! h264parse ! avdec_h264 ! videoconvert \
  ! videoscale method=lanczos ! "video/x-raw,width=720,height=1280,format=RGB" ! pngenc ! multifilesink location="$O/all/f%04d.png"
python3 experience-lab/motion-system/sentinel-follow/make_frames.py $O/all $O/cut     # 880 frames, 29.33 s
MAXRATE=900000 bash $T/encode_master.sh $O/cut $O/sentinel-flight 30 32
ONLY=mp4 MAXRATE=1200000 bash $T/encode_master.sh $O/cut $O/sentinel-flight 30 27
```

The cut: three spans of real flight (6–13 s, 44–60 s, 97–104 s), joined by 10-frame dissolves. It
skips the documented 2 s replan pause at 79.6 s.

| File | Size | Decode gate (Chromium and Firefox) |
|---|---|---|
| `sentinel-flight.webm` | 903,617 B | 880/880 frames; 0 doubled, 0 skipped, 0 off timeline; PSNR min 39.0 / median 42.4 dB |
| `sentinel-flight.mp4` | 833,725 B | 880/880; 0 / 0 / 0; PSNR min 37.5 / median 40.8 dB |

Poster: `sentinel-flight-poster.jpg`, the full frame at 58 s (the turn beside the wall), 720×1280.
The site still `assets/field/sentinel.*` is the frame at 70 s, cropped 1080×648.
