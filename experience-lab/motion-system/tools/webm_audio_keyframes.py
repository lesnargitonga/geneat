"""Mark every audio SimpleBlock in a WebM file as a keyframe (flag 0x80).

GStreamer's webmmux writes Opus blocks with the keyframe flag clear; Chromium
then finds no audio random-access point and stalls on play and seek. libwebm
and ffmpeg flag every Opus block as a keyframe. This sets that one bit in place:
no sizes change, no other byte is touched.

usage: webm_audio_keyframes.py <in.webm> <out.webm>
"""
import sys
src, dst = sys.argv[1], sys.argv[2]
data = bytearray(open(src, "rb").read())
def vint(p, keep=False):
    b = data[p]; n = 1; m = 0x80
    while n <= 8 and not (b & m): n += 1; m >>= 1
    v = b if keep else b & (m - 1)
    for k in range(1, n): v = (v << 8) | data[p + k]
    return v, n
def els(s, e):
    p = s
    while p < e:
        i, a = vint(p, True); z, b = vint(p + a); body = p + a + b
        if z == (1 << (7 * b)) - 1: z = e - body
        yield i, body, min(body + z, e); p = body + z
audio_tracks, patched, already = set(), 0, 0
for i, a, b in els(0, len(data)):
    if i != 0x18538067: continue                       # Segment
    for i2, a2, b2 in els(a, b):
        if i2 == 0x1654AE6B:                           # Tracks
            for i3, a3, b3 in els(a2, b2):
                kids = {k: (c, d) for k, c, d in els(a3, b3)}
                if 0x83 in kids and int.from_bytes(data[slice(*kids[0x83])], "big") == 2:
                    audio_tracks.add(int.from_bytes(data[slice(*kids[0xD7])], "big"))
        if i2 == 0x1F43B675:                           # Cluster
            for i3, a3, b3 in els(a2, b2):
                if i3 != 0xA3: continue                # SimpleBlock
                tn, n = vint(a3)
                if tn not in audio_tracks: continue
                f = a3 + n + 2                         # track vint, 2-byte timecode, then flags
                if data[f] & 0x80: already += 1
                else: data[f] |= 0x80; patched += 1
if not audio_tracks: raise SystemExit("no audio track found")
open(dst, "wb").write(bytes(data))
print(f"  audio blocks marked keyframe: {patched} (already marked: {already})")
