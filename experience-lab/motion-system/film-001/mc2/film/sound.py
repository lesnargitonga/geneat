"""Film 001 — sound for Master Candidate 2 (true-3D opening).

Every sound here is DESIGNED. No recorded audio of any kind exists for this
film: the Gazebo capture produced none, and the operator recording carries no
decodable audio track. Nothing in this mix is evidence, and nothing imitates
rotor noise or anything else that would imply captured Run 2 audio.

The one place the sound is tied to real data: the interface ticks in the
operator beats land on the frames where the replay's telemetry display actually
updates, measured from the picture (ui_events.json, in MC1 film time).

Every cue is placed relative to a section start computed from the edit's frame
counts (edit.json, written by the assembly), so picture and sound cannot drift.
From Shot 002 onward the cues are MC1's, unchanged in content, at the same
offsets from the picture they were designed against.

usage: python sound.py <edit.json> <ui_events.json> <out.wav>
"""
import json, sys
import numpy as np

EDIT = json.load(open(sys.argv[1]))
UI_PATH, OUT_WAV = sys.argv[2], sys.argv[3]
FPS     = 24.0
SR      = 48000
DUR     = EDIT["total"] / FPS
N       = int(round(DUR * SR))
rng     = np.random.default_rng(20260930)
CUES    = []
sec     = {k: v / FPS for k, v in EDIT["starts"].items()}     # section starts in seconds
S3D, SRO, S2, S3, S4, SREAL, S0323, SBLACK = (sec[k] for k in ("x3d", "ro", "s2", "op", "s4", "real", "f0323", "black"))
T_SLOW, T_STOP = S3D + EDIT["x3d_ramp"][0], S3D + EDIT["x3d_ramp"][1]   # recorded time decelerates, stops at 0321
S2_TRIM = EDIT["s2_trim"] / FPS                                         # MC1 Shot 002 content starts this far in

def t2i(t): return int(round(t * SR))

def cue(t, name, kind, detail):
    CUES.append((t, name, kind, detail))

# ---------------------------------------------------------------- primitives
def noise(n):
    return rng.standard_normal(n).astype(np.float64)

def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(x.size):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def onepole_lp_var(x, fc_curve):
    """low-pass whose cutoff moves — used to open and close bandwidth."""
    y = np.empty_like(x); acc = 0.0
    a = np.exp(-2 * np.pi * np.clip(fc_curve, 20, SR / 2.2) / SR)
    for i in range(x.size):
        acc = (1 - a[i]) * x[i] + a[i] * acc; y[i] = acc
    return y

def hp(x, fc):
    return x - onepole_lp(x, fc)

def biquad(x, b, a):
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(x.size):
        v = b[0]*x[i] + b[1]*x1 + b[2]*x2 - a[1]*y1 - a[2]*y2
        y[i] = v; x2, x1 = x1, x[i]; y2, y1 = y1, v
    return y

def reson(n, f, q, decay):
    """a damped resonance — struck, not synthesised-melodic."""
    t = np.arange(n) / SR
    env = np.exp(-t / decay)
    return np.sin(2 * np.pi * f * t + rng.random() * 6.283) * env / max(1.0, q * 0.0 + 1.0)

def env_ad(n, a, d, shape=2.0):
    t = np.arange(n) / SR
    e = np.where(t < a, (t / max(a, 1e-6)), np.exp(-(t - a) / max(d, 1e-6)) ** 1.0)
    return np.clip(e, 0, 1) ** 1.0

def place(buf, x, t, gain=1.0, pan=0.0):
    i = t2i(t); n = min(x.size, buf.shape[0] - i)
    if n <= 0: return
    l = gain * np.sqrt(0.5 * (1 - pan)) * 1.4142
    r = gain * np.sqrt(0.5 * (1 + pan)) * 1.4142
    buf[i:i+n, 0] += x[:n] * l
    buf[i:i+n, 1] += x[:n] * r

def db(x): return 10 ** (x / 20.0)

mix = np.zeros((N, 2))

# ============================================================== TRUE-3D OPENING
# the reconstructed world: the same grounded room bed and air as the film's close.
# As recorded time decelerates toward 0321 the physical cues are withdrawn, so the
# freeze arrives in near-silence; the real frame then brings the room back.
n0 = t2i(SRO + 0.9)
tt = np.arange(n0) / SR
bed = onepole_lp(noise(n0), 420) + 0.35 * onepole_lp(noise(n0), 120)
air = hp(onepole_lp(noise(n0), 9000), 3500) * 0.22
slow = np.clip((tt - T_SLOW) / (T_STOP - T_SLOW), 0, 1)
slow = slow * slow * (3 - 2 * slow)
real = np.clip((tt - (SRO - 0.65)) / 0.65, 0, 1)                 # the dissolve into the real frame
bed = onepole_lp_var(bed, 900 - 760 * slow + 620 * real)
air *= (1 - slow) ** 1.4 * (1 - 0.6 * real)
level = np.clip(tt / 0.9, 0, 1) * (1 - 0.82 * slow + 0.62 * real)
place(mix, (bed * 0.9 + air) * level, 0.0, db(-27))
cue(0.0, "Room bed — the reconstructed world", "designed", "filtered noise bed, 120/420 Hz, quiet air on top")
cue(T_SLOW, "Recorded time slows: physical cues withdraw", "designed",
    "bandwidth closes 900 -> 140 Hz, air drains, level falls 15 dB into the 0321 freeze")
cue(SRO - 0.65, "The real frame: the room returns", "designed", "bandwidth and presence restored across the dissolve into 0321")

# ============================================================== REALITY OPENS
n1 = t2i(S2 - SRO + 0.3)
t1 = np.arange(n1) / SR
opn = np.clip((t1 - 0.35) / 3.2, 0, 1)
rb = onepole_lp(noise(n1), 420) + 0.35 * onepole_lp(noise(n1), 120)
rb = onepole_lp_var(rb, 880 - 600 * opn)
rair = hp(onepole_lp(noise(n1), 7000), 3000) * 0.16 * (1 - opn) ** 1.6
place(mix, (rb * 0.9 + rair) * (1 - 0.55 * opn), SRO + 0.9, db(-27) * 0.6)
cue(SRO + 1.0, "Reality opens: physical cues withdraw", "designed", "the room narrows as the frame separates into its surfaces")
for k, (dt, f) in enumerate([(1.30, 62), (2.10, 78), (2.90, 55)]):
    n = t2i(1.4)
    s = reson(n, f, 1, 0.52) * env_ad(n, 0.05, 0.48)
    place(mix, s, SRO + dt, db(-27), pan=[-0.4, 0.35, -0.25][k])
cue(SRO + 1.30, "Structural separation x3", "designed", "low struck resonances, 55-78 Hz, on the surfaces pulling apart")

# ============================================================== SHOT 002
# 6.04-14.04  system architecture: sound follows causality
n2 = t2i(8.10)
t2 = np.arange(n2) / SR
sysbed = onepole_lp(noise(n2), 180) * 0.8 + 0.5 * np.sin(2 * np.pi * 46 * t2)
sysbed *= (0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t2))
place(mix, sysbed * np.clip(t2 / 0.6, 0, 1), S2, db(-29))
cue(S2, "System-space bed", "designed", "46 Hz pressure + low noise, slow drift")

# the architecture boundary crossing — the strongest transient in the film,
# built as a ramp because the picture ramps (0 → 1.8 → 2.4 → 5.1 → 17%)
n = t2i(1.45)
bx = onepole_lp(noise(n), 260) * env_ad(n, 0.52, 0.55)
bx += 0.8 * onepole_lp(noise(n), 58) * env_ad(n, 0.56, 0.62)
place(mix, bx, S2 + 6.95 - 6.04 - S2_TRIM, db(-12))
n = t2i(0.55)
edge = hp(noise(n), 1800) * env_ad(n, 0.004, 0.10)
place(mix, edge, S2 + 7.52 - 6.04 - S2_TRIM, db(-21))
cue(S2 + 6.95 - 6.04 - S2_TRIM, "Boundary crossing", "designed",
    "strongest transient in the film; ramped to match the picture's build, peak −15 dBFS")

# each layer sounds like its function, from one family
LAYER_CUES = [
    (S2 + 7.29 - 6.04 - S2_TRIM,  "Gazebo world",    "air",    None),
    (S2 + 8.79 - 6.04 - S2_TRIM,  "PX4 SITL",        "tick",   232.0),
    (S2 + 10.29 - 6.04 - S2_TRIM, "MAVSDK teacher",  "reson",  336.0),
    (S2 + 11.79 - 6.04 - S2_TRIM, "Telemetry",       "grain",  None),
    (S2 + 13.09 - 6.04 - S2_TRIM, "Operator system", "open",   None),
]
for ts, name, kind, f in LAYER_CUES:
    if kind == "air":
        n = t2i(0.9); s = hp(onepole_lp(noise(n), 5200), 900) * env_ad(n, 0.10, 0.35)
        place(mix, s, ts, db(-26), -0.15)
        cue(ts, f"Layer · {name}", "designed", "broadband air fragment — physical ground truth")
    elif kind == "tick":
        n = t2i(0.5)
        s = hp(noise(n), 3000) * env_ad(n, 0.002, 0.012) * 1.0
        s += reson(n, f, 1, 0.16) * env_ad(n, 0.003, 0.15) * 0.7
        place(mix, s, ts, db(-23), 0.22)
        cue(ts, f"Layer · {name}", "designed", "electrical tick + 232 Hz resonance — control")
    elif kind == "reson":
        n = t2i(1.1); s = reson(n, f, 1, 0.42) * env_ad(n, 0.012, 0.40)
        s += reson(n, f * 1.5, 1, 0.22) * 0.35 * env_ad(n, 0.012, 0.22)
        place(mix, s, ts, db(-24), -0.25)
        cue(ts, f"Layer · {name}", "designed", "336 Hz damped pair — mission/control logic")
    elif kind == "grain":
        # the recorded stream: fine grains, not beeps; density follows the trace
        for g in range(42):
            gt = ts + 0.032 * g + 0.004 * rng.random()
            n = t2i(0.030)
            s = hp(noise(n), 2400) * env_ad(n, 0.001, 0.008)
            place(mix, s, gt, db(-31) * (0.45 + 0.55 * min(1.0, g / 24)), (g % 5 - 2) * 0.16)
        cue(ts, f"Layer · {name}", "designed",
            "42 fine grains over 1.35 s — the stream consolidating, no beeps")
    else:
        n = t2i(1.7)
        s = onepole_lp(noise(n), 700) * env_ad(n, 0.55, 0.75)
        place(mix, s, ts, db(-27))
        cue(ts, f"Layer · {name}", "designed", "room opening — the operational view")

# ============================================================== SHOT 003
# 14.04-18.29  the real operator replay: simplify and let it settle
n3 = t2i(4.45)
t3 = np.arange(n3) / SR
opbed = onepole_lp(noise(n3), 150) * 0.7 + 0.35 * np.sin(2 * np.pi * 52 * t3)
place(mix, opbed * np.clip(t3 / 0.8, 0, 1), S3, db(-32))
cue(S3, "Operator room bed", "designed", "quiet 52 Hz room, deliberately uneventful")

ui = json.load(open(UI_PATH))
for e in ui:
    n = t2i(0.09)
    s = hp(noise(n), 4200) * env_ad(n, 0.0015, 0.010)
    s += reson(n, 1900, 1, 0.03) * 0.25 * env_ad(n, 0.002, 0.03)
    place(mix, s, S3 + e["t"] - 14.04, db(-33) * (0.6 + 0.4 * min(1.0, e["mag"] / 4.0)), 0.1)
cue(S3 + 0.29, f"Interface ticks ×{len(ui)}", "designed, real-data timed",
    "each tick lands on a frame where the replay's telemetry display actually updates")

# ============================================================== SHOT 004
# 18.29-22.79  the explanation withdraws: elements narrow and leave
n4 = t2i(2.70)
t4 = np.arange(n4) / SR
close = np.clip(t4 / 2.10, 0, 1)
wd = onepole_lp(noise(n4), 200) * 0.8 + 0.45 * np.sin(2 * np.pi * 48 * t4)
wd = onepole_lp_var(wd, 800 - 690 * close)          # loses bandwidth as it goes
place(mix, wd * (1 - close) ** 1.5, S4 + 0.70, db(-28))
cue(S4 + 0.70, "Architecture withdraws", "designed",
    "bed loses bandwidth and level as the layers compress; nothing is reversed")

for k, ts in enumerate([S4 + 0.96, S4 + 1.56, S4 + 2.06]):
    n = t2i(0.8)
    s = reson(n, [300, 232, 150][k], 1, 0.22) * env_ad(n, 0.02, 0.20)
    place(mix, s, ts, db(-28) * (1 - 0.3 * k), [0.3, -0.25, 0.1][k])
cue(S4 + 0.96, "Layers leave ×3", "designed",
    "300 → 232 → 150 Hz, each shorter and quieter: complexity dropping away")

# 20.88 literal source reality returns. The system-space sound is already gone,
# and the room from the opening comes back — the same bed and air used at
# 00.000, not a new cue. Presence and bandwidth are restored gradually so the
# held reality is inhabited rather than abandoned. Non-rhythmic, no tonal rise:
# nothing here may suggest a landing is coming.
n5 = t2i(3.47)
t5 = np.arange(n5) / SR
room = onepole_lp(noise(n5), 420) + 0.35 * onepole_lp(noise(n5), 120)
room = onepole_lp_var(room, np.interp(t5, [0.0, 1.30, 3.47], [340.0, 880.0, 880.0]))
airhi = hp(onepole_lp(noise(n5), 6200), 3000) * np.interp(t5, [0.0, 0.55, 1.35, 3.47],
                                                          [0.0, 0.05, 0.12, 0.12])
# rises into the hold, then steps back under the 0323 body and leaves for black
pres = np.interp(t5, [0.0, 0.14, 0.50, 1.05, 2.41, 3.05, 3.47],
                     [0.30, 0.70, 0.92, 1.00, 1.00, 0.42, 0.00])
place(mix, (room + airhi) * pres, SREAL, db(-28))
cue(SREAL, "Room returns — opening air family", "designed",
    "same bed/air as cue 00.000; presence and bandwidth restored gradually across the 0321 hold")

# ============================================================== ENDING
# 23.29 0323 — physical and unresolved. No touchdown: we have no such audio and
# the aircraft never contacts the ground in frame.
n = t2i(1.15)
body = onepole_lp(noise(n), 190) * env_ad(n, 0.07, 0.42) * 0.9
body += reson(n, 88, 1, 0.30) * env_ad(n, 0.02, 0.30) * 0.7
place(mix, body, S0323, db(-20))
cue(S0323, "0323 — physical, unresolved", "designed",
    "low body that decays without landing; no impact, no touchdown implied")

# 24.29 black: let the silence register, with only a tail falling away
n = t2i(0.62)
tail = onepole_lp(noise(n), 60) * np.exp(-np.arange(n) / SR / 0.16)
place(mix, tail, SBLACK, db(-31))
cue(SBLACK, "Black", "designed", "low tail decays to true silence; 0.67 s of space")

# ------------------------------------------------------------ finish + safety
mix[-t2i(0.25):] *= np.linspace(1, 0, t2i(0.25))[:, None]     # clean tail to zero

# Normalise to a true-peak ceiling rather than to a loudness target: the film is
# deliberately quiet with long silences, so hitting a streaming loudness number
# would mean compressing dynamics the picture depends on. Level is set by the
# ceiling; the integrated figure is then reported as it falls.
def truepeak(x):
    n = x.shape[0]
    o = np.stack([np.interp(np.linspace(0, n - 1, n * 4), np.arange(n), x[:, c])
                  for c in range(2)], axis=1)
    return np.abs(o).max()
CEIL = db(-2.0)
tp0 = truepeak(mix)
if tp0 > 0:
    mix *= CEIL / tp0

# ---------------------------------------------------------- loudness (BS.1770)
def k_weight(x):
    x = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285],
                  [1.0, -1.69065929318241, 0.73248077421585])
    return biquad(x, [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])

kw = np.stack([k_weight(mix[:, 0]), k_weight(mix[:, 1])], axis=1)
blk, hop = int(0.4 * SR), int(0.1 * SR)
ms = []
for i in range(0, N - blk, hop):
    ms.append((kw[i:i+blk] ** 2).mean(axis=0).sum())
ms = np.array(ms)
lk = -0.691 + 10 * np.log10(np.maximum(ms, 1e-12))
abs_keep = lk > -70
if abs_keep.any():
    gamma = -0.691 + 10 * np.log10(ms[abs_keep].mean()) - 10
    keep = abs_keep & (lk > gamma)
    integrated = -0.691 + 10 * np.log10(ms[keep].mean()) if keep.any() else float("nan")
else:
    integrated = float("nan")
short = np.max(lk) if lk.size else float("nan")

# 4× oversample for an approximate true peak
os_ = np.stack([np.interp(np.linspace(0, N - 1, N * 4), np.arange(N), mix[:, c])
                for c in range(2)], axis=1)
tp = 20 * np.log10(np.abs(os_).max() + 1e-12)
sp = 20 * np.log10(np.abs(mix).max() + 1e-12)

import wave
with wave.open(OUT_WAV, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())

print(f"  wrote {OUT_WAV.split('/')[-1]}  {DUR:.2f}s  {SR} Hz stereo")
print(f"  sample peak    {sp:6.2f} dBFS")
print(f"  true peak (4x) {tp:6.2f} dBTP")
print(f"  integrated     {integrated:6.2f} LUFS")
print(f"  max momentary  {short:6.2f} LUFS  (400 ms block)")
print()
print("  CUE SHEET")
for t, name, kind, detail in sorted(CUES):
    print(f"    {int(t//60):02d}:{t%60:06.3f}  {name:46s} [{kind}]  {detail}")
