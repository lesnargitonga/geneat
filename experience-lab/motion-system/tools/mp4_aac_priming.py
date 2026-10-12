"""Signal AAC encoder priming in an MP4 so players trim it (gapless start).

GStreamer's mp4mux writes the audio track's edit list with media_time=0, so the
1024 samples of AAC encoder priming are presented and the sound lands 21.33 ms
late against the picture (measured in Chromium and Firefox). This rewrites that
single edit-list entry in place: media_time = priming samples, segment duration
= the audio master's exact length. Fixed-size fields only: no box changes size
and no chunk offset moves. The track and movie durations are set to match.

usage: mp4_aac_priming.py <file.mp4> <master_samples_at_48k> [priming=1024]
"""
import struct
import sys

PATH = sys.argv[1]
MASTER_SAMPLES = int(sys.argv[2])
PRIMING = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
data = bytearray(open(PATH, "rb").read())


def boxes(start, end):
    p = start
    while p + 8 <= end:
        size, kind = struct.unpack(">I4s", data[p:p + 8])
        header = 8
        if size == 1:
            size = struct.unpack(">Q", data[p + 8:p + 16])[0]; header = 16
        elif size == 0:
            size = end - p
        yield p, kind.decode("latin1"), size, header
        p += size


def child(start, end, kind):
    for p, k, size, h in boxes(start, end):
        if k == kind:
            return p, size, h
    raise SystemExit(f"no {kind} box")


moov, moov_size, moov_h = child(0, len(data), "moov")
mvhd, _, _ = child(moov + moov_h, moov + moov_size, "mvhd")
if data[mvhd + 8] != 0: raise SystemExit("mvhd version 1 not handled")
movie_scale = struct.unpack(">I", data[mvhd + 20:mvhd + 24])[0]
presented = round(MASTER_SAMPLES / 48000 * movie_scale)

patched = False
for trak, kind, size, h in boxes(moov + moov_h, moov + moov_size):
    if kind != "trak": continue
    mdia, msize, mh = child(trak + h, trak + size, "mdia")
    hdlr, _, _ = child(mdia + mh, mdia + msize, "hdlr")
    if data[hdlr + 16:hdlr + 20] != b"soun": continue
    mdhd, _, _ = child(mdia + mh, mdia + msize, "mdhd")
    if data[mdhd + 8] != 0: raise SystemExit("mdhd version 1 not handled")
    media_scale = struct.unpack(">I", data[mdhd + 20:mdhd + 24])[0]
    if media_scale != 48000: raise SystemExit(f"audio timescale {media_scale}, expected 48000")
    edts, esize, eh = child(trak + h, trak + size, "edts")
    elst, _, _ = child(edts + eh, edts + esize, "elst")
    if data[elst + 8] != 0 or struct.unpack(">I", data[elst + 12:elst + 16])[0] != 1:
        raise SystemExit("expected a single version-0 edit-list entry")
    old = struct.unpack(">Ii", data[elst + 16:elst + 24])
    struct.pack_into(">Ii", data, elst + 16, presented, PRIMING)
    tkhd, _, _ = child(trak + h, trak + size, "tkhd")
    if data[tkhd + 8] != 0: raise SystemExit("tkhd version 1 not handled")
    struct.pack_into(">I", data, tkhd + 28, presented)
    patched = True
    print(f"  audio edit list: segment {old[0]} -> {presented} (movie scale {movie_scale}), media_time {old[1]} -> {PRIMING}")
if not patched: raise SystemExit("no audio track found")

# the movie lasts as long as its longest presented track
longest = 0
for trak, kind, size, h in boxes(moov + moov_h, moov + moov_size):
    if kind == "trak":
        tkhd, _, _ = child(trak + h, trak + size, "tkhd")
        longest = max(longest, struct.unpack(">I", data[tkhd + 28:tkhd + 32])[0])
struct.pack_into(">I", data, mvhd + 24, longest)
open(PATH, "wb").write(bytes(data))
