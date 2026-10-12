#!/usr/bin/env bash
# The production encoder for LESNAR motion work. The only one.
#
# One PNG sequence (+ optional WAV master) in; frame-exact WebM (VP9 + Opus) and
# MP4 (H.264 + AAC) out, both cut from the same frames and the same audio.
#
# Every frame gets the timestamp its index implies (n / fps). Nothing is paced
# by a wall clock, so nothing can be dropped or doubled, and the audio sits on
# the same timeline sample-accurately. Never encode delivered motion through
# canvas + MediaRecorder: on 2026-10-01 that path was measured doubling 11 and
# skipping 9 moving frames in Film 001 and putting picture and sound ~125 ms
# late. See README.md in this directory.
#
# usage: encode_master.sh <frames_dir> <out_basename> [fps] [quality]
#   writes <out_basename>.webm and <out_basename>.mp4
#   frames: <prefix><digits>.png from index 0, contiguous (f000.png, f0000.png, c000.png)
#   quality: VP9 cq-level (default 18); H.264 uses the same number as its CRF-like quantizer + 2
# env:
#   SIZE=WxH        Lanczos scale before encoding (default: source size)
#   AUDIO=file.wav  audio master; Opus 192 kb/s in WebM, AAC 192 kb/s in MP4
#   MAXRATE=bps     VP9 constrained-quality ceiling (default 20 Mb/s)
#   ONLY=webm|mp4   produce just one container
#
# Colour: BT.601 limited range, chosen by measurement. Decoded in Chromium and
# Firefox, BT.601 round-trips flat colours to within 2 levels; BT.709 signalling
# triggered a colour-managed conversion that dropped blue by up to 9 levels, and
# full-range flags were ignored outright.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
frames_dir=$1
base=$2
fps=${3:-24}
q=${4:-18}
maxrate=${MAXRATE:-20000000}
only=${ONLY:-}

# a sorted glob, not find|sort|head: under pipefail, head closing the pipe early
# can SIGPIPE sort and make set -e quit silently before anything is encoded
shopt -s nullglob; pngs=("$frames_dir"/*.png); shopt -u nullglob
(( ${#pngs[@]} )) || { echo "no png frames in $frames_dir" >&2; exit 1; }
first=$(basename "${pngs[0]}")
[[ $first =~ ^([a-zA-Z_-]*)(0+)\.png$ ]] || { echo "first frame '$first' is not <prefix>000.png" >&2; exit 1; }
prefix=${BASH_REMATCH[1]}
digits=${#BASH_REMATCH[2]}
count=0
while [[ -f $(printf "%s/%s%0${digits}d.png" "$frames_dir" "$prefix" "$count") ]]; do count=$((count + 1)); done
total=$(find "$frames_dir" -maxdepth 1 -regextype posix-extended -regex ".*/${prefix}[0-9]{${digits}}\.png" | wc -l)
(( count == total )) || { echo "sequence has a gap: $count contiguous of $total frames" >&2; exit 1; }
pattern="$frames_dir/${prefix}%0${digits}d.png"

# one caps filter only: gst-launch reads a second caps string in a row as an element name
scale=(); caps="video/x-raw,format=I420,colorimetry=bt601"
if [[ -n ${SIZE:-} ]]; then
  scale=(! videoscale method=lanczos); caps+=",width=${SIZE%x*},height=${SIZE#*x}"
fi
if [[ -n ${AUDIO:-} ]]; then [[ -f $AUDIO ]] || { echo "no audio file $AUDIO" >&2; exit 1; }; fi
source_video=(multifilesrc location="$pattern" index=0 stop-index=$((count - 1))
              caps="image/png,framerate=${fps}/1" ! pngdec ! videoconvert "${scale[@]}" ! "$caps")
source_audio=(filesrc location="${AUDIO:-}" ! wavparse ! audioconvert ! audioresample
              ! "audio/x-raw,rate=48000,channels=2")

if [[ $only != mp4 ]]; then
  out="$base.webm"; rm -f "$out"   # a failed encode must never leave an older file behind
  audio=(); [[ -n ${AUDIO:-} ]] && audio=("${source_audio[@]}" ! opusenc bitrate=192000 ! queue ! mux.)
  gst-launch-1.0 -q -e webmmux name=mux ! filesink location="$out" \
    "${source_video[@]}" \
    ! vp9enc end-usage=cq cq-level="$q" target-bitrate="$maxrate" min-quantizer=0 max-quantizer=48 \
        deadline=0 cpu-used=1 row-mt=true threads=8 keyframe-max-dist=48 lag-in-frames=25 auto-alt-ref=true \
    ! queue ! mux. "${audio[@]}"
  # GStreamer's webmmux leaves the keyframe flag clear on Opus blocks; Chromium
  # then has no audio random-access point and stalls on play and seek.
  [[ -n ${AUDIO:-} ]] && python3 "$here/webm_audio_keyframes.py" "$out" "$out.kf" && mv "$out.kf" "$out"
  echo "  webm: $count frames (${prefix}%0${digits}d) @ ${fps} fps${SIZE:+, $SIZE}${AUDIO:+, Opus} -> $out ($(stat -c %s "$out") bytes)"
fi

if [[ $only != webm ]]; then
  out="$base.mp4"; rm -f "$out"
  audio=(); [[ -n ${AUDIO:-} ]] && audio=("${source_audio[@]}" ! avenc_aac bitrate=192000 ! aacparse ! queue ! mux.)
  gst-launch-1.0 -q -e mp4mux name=mux faststart=true ! filesink location="$out" \
    "${source_video[@]}" \
    ! x264enc pass=qual quantizer=$((q + 2)) speed-preset=slower psy-tune=film key-int-max=48 bframes=2 \
    ! "video/x-h264,profile=high" ! h264parse ! queue ! mux. "${audio[@]}"
  # mp4mux presents the 1024 samples of AAC priming (sound 21.33 ms late); mark
  # them in the audio edit list so players trim them, as gapless encoders do.
  if [[ -n ${AUDIO:-} ]]; then
    samples=$(python3 -c "import wave,sys; w=wave.open(sys.argv[1]); print(round(w.getnframes()*48000/w.getframerate()))" "$AUDIO")
    python3 "$here/mp4_aac_priming.py" "$out" "$samples"
  fi
  echo "  mp4:  $count frames (${prefix}%0${digits}d) @ ${fps} fps${SIZE:+, $SIZE}${AUDIO:+, AAC} -> $out ($(stat -c %s "$out") bytes)"
fi
