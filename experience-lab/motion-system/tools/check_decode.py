"""Judge a decoded clip against the frames and audio it was encoded from.

Fails (exit 1) on any of: a seek that timed out, playback that did not advance,
a duration off the frame count, a frame doubled or skipped while the source is
moving, picture running ahead of or behind its own timeline, audio offset from
the WAV master by more than 1 ms, or a decoded true peak above the master's by
more than 0.5 dB.

usage: python check_decode.py <source_frames_dir> <decoded_dir> [fps] [audio_master.wav]
"""
import glob
import json
import sys
import wave

import numpy as np
from PIL import Image

MOVING = 4.0          # MSE between neighbouring source frames above which they are unmistakable
WINDOW = 8            # a drop or duplicate shifts by 1-2 frames; search +/- this many
THUMB = (320, 180)


def thumbs(paths):
    return [np.asarray(Image.open(p).convert("RGB").resize(THUMB, Image.BILINEAR), dtype=np.float32) for p in paths]


def true_peak_db(x, sr):
    peak = 0.0
    for s in range(0, len(x), sr):
        blk = x[s:s + sr]
        up = np.fft.irfft(np.fft.rfft(blk), len(blk) * 4) * 4      # 4x oversampled
        peak = max(peak, float(np.abs(up).max()))
    return 20 * np.log10(max(peak, 1e-12))


def main():
    src_dir, dec_dir = sys.argv[1], sys.argv[2]
    fps = float(sys.argv[3]) if len(sys.argv) > 3 else 24.0
    wav = sys.argv[4] if len(sys.argv) > 4 else None
    probe = json.load(open(f"{dec_dir}/probe.json"))
    srcf = sorted(glob.glob(f"{src_dir}/*.png"))
    decf = sorted(glob.glob(f"{dec_dir}/f*.png"))
    fails = []

    if probe["seek_timeouts"]: fails.append(f"{probe['seek_timeouts']} seeks timed out")
    if probe["play_error"] or probe["played_s"] < 1.0: fails.append(f"playback did not advance ({probe['play_error']})")
    want = len(srcf) / fps
    if abs(probe["duration"] - want) > 0.5 / fps: fails.append(f"duration {probe['duration']:.3f}s, frames imply {want:.3f}s")

    src, dec = thumbs(srcf), thumbs(decf)
    step = [((src[k + 1] - src[k]) ** 2).mean() for k in range(len(src) - 1)]
    match = []
    for i, d in enumerate(dec):
        win = range(max(0, i - WINDOW), min(len(src), i + WINDOW + 1))
        mse = {j: ((d - src[j]) ** 2).mean() for j in win}
        j = min(mse, key=mse.get)
        match.append(i if i < len(src) and mse[i] <= mse[j] + 0.05 else j)
    dups = [i for i in range(1, len(match)) if match[i - 1] < len(step) and step[match[i - 1]] > MOVING and match[i] == match[i - 1]]
    skips = [i for i in range(1, len(match)) if match[i] - match[i - 1] >= 2
             and all(step[k] > MOVING for k in range(match[i - 1], match[i]))]
    lag = [i - match[i] for i in range(len(match)) if 0 < match[i] < len(step) and step[match[i] - 1] > MOVING and step[match[i]] > MOVING]
    moving = sum(s > MOVING for s in step)
    if dups: fails.append(f"{len(dups)} moving frames doubled, at {dups[:10]}")
    if skips: fails.append(f"{len(skips)} moving frames skipped, at {skips[:10]}")
    if any(lag): fails.append(f"picture off its timeline on {sum(1 for x in lag if x)} moving frames")

    full = lambda p: np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
    psnr = []
    for i in range(0, min(len(srcf), len(decf)), max(1, len(decf) // 24)):
        a, b = full(srcf[i]), full(decf[i])
        if a.shape != b.shape:
            a = np.asarray(Image.open(srcf[i]).convert("RGB").resize(b.shape[1::-1], Image.LANCZOS), dtype=np.float32)
        psnr.append(10 * np.log10(255 ** 2 / max(((a - b) ** 2).mean(), 1e-6)))

    print(f"  {probe['engine']} {probe['clip']}: {len(decf)}/{len(srcf)} frames, {moving} in motion; "
          f"doubled {len(dups)}, skipped {len(skips)}, off-timeline {sum(1 for x in lag if x)}; "
          f"PSNR min {min(psnr):.1f} / median {np.median(psnr):.1f} dB")

    if wav:
        w = wave.open(wav); sr = w.getframerate(); ch = w.getnchannels(); sw = w.getsampwidth()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype={2: np.int16, 4: np.int32}[sw]).astype(np.float64)
        w.close(); x = x.reshape(-1, ch).mean(1) / (2 ** (8 * sw - 1))
        try:
            d = np.fromfile(f"{dec_dir}/audio.f32", dtype=np.float32).astype(np.float64)
        except FileNotFoundError:
            d = None
        if d is None or len(d) == 0:
            fails.append("no decodable audio track")
        else:
            n = min(len(x), len(d), 8 * sr)
            L = 1 << int(np.ceil(np.log2(2 * n)))
            xc = np.fft.irfft(np.fft.rfft(d[:n], L) * np.conj(np.fft.rfft(x[:n], L)), L)
            lags = np.concatenate([np.arange(0, n), np.arange(-n, 0)]); xc = np.concatenate([xc[:n], xc[-n:]])
            k = int(lags[np.argmax(xc)])
            tp_src, tp_dec = true_peak_db(x, sr), true_peak_db(d, sr)
            print(f"  audio: offset {1000 * k / sr:+.2f} ms, length {len(d) / sr:.3f}s vs master {len(x) / sr:.3f}s, "
                  f"true peak {tp_dec:.2f} dBTP vs master {tp_src:.2f}")
            if abs(k) > sr / 1000: fails.append(f"audio offset {1000 * k / sr:+.2f} ms")
            if tp_dec > tp_src + 0.5: fails.append(f"decoded true peak {tp_dec:.2f} dBTP exceeds master by >0.5 dB")

    if fails:
        print("  FAIL: " + "; ".join(fails)); sys.exit(1)
    print("  PASS")


if __name__ == "__main__":
    main()
