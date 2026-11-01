#!/usr/bin/env python3
"""Generate the /work/sentinel/ figures from recorded evidence.

Every line, number and label drawn here comes from one of two sources:

* the seven sealed PX4/Gazebo SITL runs published on the evidence/sitl-run-*
  branches of github.com/lesnargitonga/LesnarAI, read by the commit pinned in
  RUNS below, each file checked against the SHA-256 in that run's MANIFEST.json;
* the site's own perception-diagnostics record, assets/home/sentinel-detections.json.

The figures are written between <!-- gen:NAME --> and <!-- /gen:NAME --> markers
in work/sentinel/index.html, so the page stays plain static HTML and the figures
stay reproducible. Re-running on unchanged inputs produces byte-identical output.

usage:
    python3 tools/sentinel/build_figures.py [--repo PATH_TO_LesnarAI_CLONE]

The clone needs the evidence branches fetched (git fetch origin).
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html import escape
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
PAGE = SITE / "work" / "sentinel" / "index.html"
DETECTIONS = SITE / "assets" / "home" / "sentinel-detections.json"
DEFAULT_REPO = Path(os.environ.get("SENTINEL_REPO", Path.home() / "workspace" / "LesnarAI"))

# Evidence commits, in flight order. `code` names the bridge revision each run
# flew, as recorded in its RUN.json; the label is ours, the revision is theirs.
RUNS = [
    ("px4_teacher_20260928_194728_d1", "991b5dfd88bf5b1bfc0d817a0ba9b63e6d823085", "original bridge"),
    ("px4_teacher_20260928_203728_d1", "6e61e1df5a79fe27323964360fcbed706aa1b36f", "offboard fix"),
    ("px4_teacher_20260928_205942_d1", "3210f529485881984c177db2ec0c01f8cc72d27a", "geometry fix"),
    ("px4_teacher_20260929_082014_d1", "b7dcf59d6705601cacb4cf6fa84dac0435e2720b", "stack on plain Linux"),
    ("px4_teacher_20260929_084045_d1", "b217ebb5d924602d69211eb14fbc96ed12604a0c", "stack on plain Linux"),
    ("px4_teacher_20260930_071703_d1", "80e429516951b5cc555b0ebcb39056329b2a6728", "stack on plain Linux"),
    ("px4_teacher_20260930_074210_d1", "511dc9b3d9fd6ab91be591e3b9f875f23573c153", "stack on plain Linux"),
]
PHANTOM_RUN = 1      # index into RUNS: the run held by the phantom wall
RECOVERED_RUN = 2    # the first run flown after the geometry fix
PHANTOM_OBSTACLE = "Wall_1"
PLAN_EXTENT = (-8.0, 56.0, -6.0, 47.0)   # metres: west, east, south, north
EARTH_RADIUS_M = 6378137.0
LIDAR_RAYS = 72
LIDAR_RANGE_M = 20.0
HOLD_SPEED_MPS = 0.1    # below this ground speed, airborne, the aircraft is holding
AIRBORNE_ALT_M = 5.0


@dataclass(frozen=True)
class Sample:
    t: float          # seconds since the run's first sample
    x: float          # metres east of the world origin
    y: float          # metres north of the world origin
    alt: float
    speed: float
    heading: float    # PX4 heading, degrees clockwise from north
    scan: tuple[float, ...]


@dataclass(frozen=True)
class Obstacle:
    name: str
    x: float
    y: float
    yaw: float        # radians, counter-clockwise from +x
    dx: float = 0.0
    dy: float = 0.0
    radius: float = 0.0

    @property
    def is_box(self) -> bool:
        return self.radius == 0.0


@dataclass(frozen=True)
class Run:
    run_id: str
    commit: str
    code_label: str
    code_rev: str
    outcome: str
    samples: list[Sample]
    obstacles: list[Obstacle]

    @property
    def duration(self) -> float:
        return self.samples[-1].t


# ── reading the evidence ─────────────────────────────────────────────────────

def git_bytes(repo: Path, rev: str, path: str) -> bytes:
    return subprocess.run(["git", "-C", str(repo), "show", f"{rev}:{path}"],
                          check=True, capture_output=True).stdout


def run_files(repo: Path, commit: str, run_id: str) -> dict[str, str]:
    listing = subprocess.run(["git", "-C", str(repo), "ls-tree", "-r", "--name-only", commit],
                             check=True, capture_output=True, text=True).stdout.split()
    files = {p.rsplit("/", 1)[1]: p for p in listing if f"/{run_id}/" in p}
    if "MANIFEST.json" not in files:
        sys.exit(f"{run_id}: no MANIFEST.json at {commit[:9]}")
    return files


def verified(repo: Path, commit: str, files: dict[str, str], name: str, manifest: dict) -> bytes:
    data = git_bytes(repo, commit, files[name])
    listed = {f["path"]: f["sha256"] for f in manifest["files"]}
    if name in listed and hashlib.sha256(data).hexdigest() != listed[name]:
        sys.exit(f"{files[name]}: SHA-256 does not match its manifest")
    return data


def world_bytes(repo: Path, commit: str, files: dict[str, str], run_meta: dict) -> bytes:
    """The world a run flew in.

    Earlier runs seal world_used.sdf alongside the telemetry. Later ones record
    only the code revision and the world's SHA-256, so the file is read from
    that revision and must match the recorded hash.
    """
    if "world_used.sdf" in files:
        return git_bytes(repo, commit, files["world_used.sdf"])
    data = git_bytes(repo, run_meta["repo_git_rev"], "obstacles.sdf")
    if hashlib.sha256(data).hexdigest() != run_meta["obstacles_sdf_sha256"]:
        sys.exit(f"{run_meta['run_id']}: obstacles.sdf at {run_meta['repo_git_rev'][:9]} "
                 "does not match the hash the run recorded")
    return data


def world_origin(sdf: ET.Element) -> tuple[float, float]:
    sc = sdf.find("world/spherical_coordinates")
    if sc is None:
        sys.exit("world has no spherical_coordinates: cannot place telemetry")
    return float(sc.findtext("latitude_deg")), float(sc.findtext("longitude_deg"))


def obstacles_from(sdf: ET.Element) -> list[Obstacle]:
    out = []
    for model in sdf.findall("world/model"):
        geometry = model.find(".//collision/geometry")
        if geometry is None or len(geometry) == 0:
            continue
        pose = [float(v) for v in (model.findtext("pose") or "0 0 0 0 0 0").split()]
        shape = geometry[0]
        if shape.tag == "box":
            sx, sy, _ = (float(v) for v in shape.findtext("size").split())
            out.append(Obstacle(model.get("name"), pose[0], pose[1], pose[5], dx=sx, dy=sy))
        elif shape.tag == "cylinder":
            out.append(Obstacle(model.get("name"), pose[0], pose[1], 0.0,
                                radius=float(shape.findtext("radius"))))
    return out


def load_run(repo: Path, run_id: str, commit: str, code_label: str) -> Run:
    files = run_files(repo, commit, run_id)
    manifest = json.loads(git_bytes(repo, commit, files["MANIFEST.json"]))
    run_meta = json.loads(verified(repo, commit, files, "RUN.json", manifest))
    mission = json.loads(verified(repo, commit, files, "mission.json", manifest))
    sdf = ET.fromstring(world_bytes(repo, commit, files, run_meta))
    lat0, lon0 = world_origin(sdf)
    telemetry = verified(repo, commit, files, "telemetry_live_0.csv", manifest).decode()

    rows = list(csv.DictReader(io.StringIO(telemetry)))
    t0 = float(rows[0]["timestamp"])
    k = math.radians(1.0) * EARTH_RADIUS_M
    samples = [Sample(
        t=float(r["timestamp"]) - t0,
        x=(float(r["lon"]) - lon0) * k * math.cos(math.radians(lat0)),
        y=(float(r["lat"]) - lat0) * k,
        alt=float(r["rel_alt"]),
        speed=float(r["ground_speed_mps"] or 0.0),
        heading=float(r["yaw"]),
        scan=tuple(json.loads(r["lidar_json"])),
    ) for r in rows]
    return Run(run_id, commit, code_label, run_meta["repo_git_rev"][:7], mission["outcome"],
               samples, obstacles_from(sdf))


def longest_hold(run: Run) -> tuple[Sample, Sample]:
    """The longest airborne stretch with the aircraft effectively stationary."""
    best, start = (None, None), None
    for s in run.samples:
        holding = s.speed < HOLD_SPEED_MPS and s.alt > AIRBORNE_ALT_M
        if holding and start is None:
            start = s
        if (not holding or s is run.samples[-1]) and start is not None:
            if best[0] is None or s.t - start.t > best[1].t - best[0].t:
                best = (start, s)
            start = None
    if best[0] is None:
        sys.exit(f"{run.run_id}: no airborne hold found")
    return best


# ── drawing ──────────────────────────────────────────────────────────────────

def f1(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".") if abs(v) >= 0.05 else "0"


class Plan:
    """Plan view: metres east/north mapped into an SVG viewBox, y flipped."""

    def __init__(self, xmin: float, xmax: float, ymin: float, ymax: float, scale: float):
        self.xmin, self.ymax, self.s = xmin, ymax, scale
        self.w, self.h = (xmax - xmin) * scale, (ymax - ymin) * scale

    def p(self, x: float, y: float) -> str:
        return f"{f1((x - self.xmin) * self.s)},{f1((self.ymax - y) * self.s)}"

    def path(self, pts: list[tuple[float, float]]) -> str:
        return "M" + " L".join(self.p(x, y) for x, y in pts)


def box_corners(o: Obstacle) -> list[tuple[float, float]]:
    c, s = math.cos(o.yaw), math.sin(o.yaw)
    hx, hy = o.dx / 2, o.dy / 2
    return [(o.x + c * px - s * py, o.y + s * px + c * py)
            for px, py in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]


def thinned(samples: list[Sample], every: int) -> list[Sample]:
    return samples[::every] + [samples[-1]]


def plan_figure(phantom: Run, recovered: Run) -> str:
    view = Plan(*PLAN_EXTENT, 9.0)
    hold_from, hold_to = longest_hold(phantom)
    at = min(phantom.samples, key=lambda s: abs(s.t - (hold_from.t + hold_to.t) / 2))
    wall = next(o for o in phantom.obstacles if o.name == PHANTOM_OBSTACLE)
    phantom_r = max(wall.dx, wall.dy) / 2   # the pre-fix model: every box a disc
    hits = [r for r in at.scan if r < LIDAR_RANGE_M]

    def visible(o: Obstacle) -> bool:
        reach = max(o.dx, o.dy, o.radius * 2)
        xmin, xmax, ymin, ymax = PLAN_EXTENT
        return xmin - reach < o.x < xmax + reach and ymin - reach < o.y < ymax + reach

    out = [f'<svg class="plan" viewBox="0 0 {f1(view.w)} {f1(view.h)}" role="img" '
           f'aria-labelledby="plan-t plan-d">',
           '<title id="plan-t">Plan view of the training box, sealed runs 2 and 3</title>',
           f'<desc id="plan-d">Run 2 flies north 25 metres, turns east and stops at '
           f'{f1(at.x)} metres east, {f1(at.y)} metres north. Its recorded scan there reads '
           f'{f1(min(hits))} to {f1(max(hits))} metres across the {len(hits) * 360 // LIDAR_RAYS} degrees ahead '
           f'of it, and {f1(LIDAR_RANGE_M)} metres, its range, everywhere else. The nearest real obstacle, {PHANTOM_OBSTACLE}, is a wall '
           f'{f1(wall.dx)} by {f1(wall.dy)} metres centred at {f1(wall.x)}, {f1(wall.y)}. The '
           f'pre-fix lidar model treated it as a disc of radius {f1(phantom_r)} metres. Run 3 '
           f'flies the whole box.</desc>']

    out.append('<g class="plan__world">')
    for o in phantom.obstacles:
        if not visible(o) or o.name == PHANTOM_OBSTACLE:
            continue
        if o.is_box:
            out.append(f'<path d="{view.path(box_corners(o))} Z"/>')
        else:
            out.append(f'<circle cx="{view.p(o.x, o.y).split(",")[0]}" '
                       f'cy="{view.p(o.x, o.y).split(",")[1]}" r="{f1(o.radius * view.s)}"/>')
    out.append('</g>')

    cx, cy = view.p(wall.x, wall.y).split(",")
    out.append(f'<circle class="plan__phantom" cx="{cx}" cy="{cy}" r="{f1(phantom_r * view.s)}"/>')
    out.append(f'<path class="plan__wall" d="{view.path(box_corners(wall))} Z"/>')

    box = [(0, 0), (0, 25), (25, 25), (25, 0), (0, 0)]
    out.append(f'<path class="plan__mission" d="{view.path(box)}"/>')

    # The whole recorded scan as one footprint: open to the 20 m range where
    # nothing was seen, and notched wherever the lidar reported a return.
    ox, oy = at.x, at.y
    yaw0 = math.radians(90.0 - at.heading)
    ends = []
    for i, r in enumerate(at.scan):
        a = math.radians(-180 + i * 360 / LIDAR_RAYS) + yaw0
        r = min(r, LIDAR_RANGE_M)
        ends.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    out.append(f'<path class="plan__scan" d="{view.path(ends)} Z"/>')

    out.append(f'<path class="plan__ok" d="{view.path([(s.x, s.y) for s in thinned(recovered.samples, 5)])}"/>')
    out.append(f'<path class="plan__bad" d="{view.path([(s.x, s.y) for s in thinned(phantom.samples, 5)])}"/>')
    sx, sy = view.p(ox, oy).split(",")
    out.append(f'<circle class="plan__stop" cx="{sx}" cy="{sy}" r="7"/>')

    def label(x: float, y: float, text: str, cls: str = "", anchor: str = "start") -> str:
        lx, ly = view.p(x, y).split(",")
        return f'<text class="plan__lbl {cls}" x="{lx}" y="{ly}" text-anchor="{anchor}">{escape(text)}</text>'

    out += [
        label(-1.2, -3.6, "home", anchor="start"),
        label(25.0, 27.6, "waypoint 2", anchor="middle"),
        label(wall.x + 1.8, wall.y + wall.dy / 2 - 1.6, f"{PHANTOM_OBSTACLE} · {f1(wall.dx)} × {f1(wall.dy)} m", "is-wall"),
        label(wall.x + 2.0, wall.y - phantom_r - 2.4, f"the old model: a {f1(phantom_r)} m disc", "is-bad", "middle"),
        label(ox - 1.2, oy + 2.4, "held here", "is-bad", "end"),
        label(ox - 10.0, oy + 9.5, "its scan", "is-scan", "middle"),
    ]
    out.append("</svg>")
    return "\n".join(out)


def speed_figure(phantom: Run, recovered: Run) -> str:
    w, h, pad_l, pad_b, pad_t = 640.0, 200.0, 34.0, 26.0, 10.0
    t_max = 660.0
    v_max = 2.5

    def pt(s: Sample) -> str:
        x = pad_l + s.t / t_max * (w - pad_l - 6)
        y = pad_t + (1 - min(s.speed, v_max) / v_max) * (h - pad_t - pad_b)
        return f"{f1(x)},{f1(y)}"

    hold_from, hold_to = longest_hold(phantom)
    x0 = pad_l + hold_from.t / t_max * (w - pad_l - 6)
    x1 = pad_l + hold_to.t / t_max * (w - pad_l - 6)
    base = h - pad_b
    out = [f'<svg class="speed" viewBox="0 0 {f1(w)} {f1(h)}" role="img" aria-labelledby="spd-t spd-d">',
           '<title id="spd-t">Ground speed against mission time, runs 2 and 3</title>',
           f'<desc id="spd-d">Run 3 finishes the mission in {round(recovered.duration)} seconds. '
           f'Run 2 holds at under {HOLD_SPEED_MPS} metres per second, airborne, from '
           f'{round(hold_from.t)} to {round(hold_to.t)} seconds, '
           f'{f1((hold_to.t - hold_from.t) / 60)} minutes, until the mission times out at '
           f'{round(phantom.duration)} seconds.</desc>',
           f'<rect class="speed__hold" x="{f1(x0)}" y="{f1(pad_t)}" width="{f1(x1 - x0)}" '
           f'height="{f1(base - pad_t)}"/>',
           f'<path class="speed__axis" d="M{f1(pad_l)},{f1(base)} L{f1(w - 6)},{f1(base)}"/>']
    for t in range(0, int(t_max) + 1, 120):
        x = pad_l + t / t_max * (w - pad_l - 6)
        out.append(f'<text class="speed__tick" x="{f1(x)}" y="{f1(h - 8)}" text-anchor="middle">{t // 60} min</text>')
    for v in (0, 1, 2):
        y = pad_t + (1 - v / v_max) * (base - pad_t)
        out.append(f'<text class="speed__tick" x="{f1(pad_l - 6)}" y="{f1(y + 4)}" text-anchor="end">{v}</text>')
    out.append(f'<polyline class="speed__ok" points="{" ".join(pt(s) for s in thinned(recovered.samples, 2))}"/>')
    out.append(f'<polyline class="speed__bad" points="{" ".join(pt(s) for s in thinned(phantom.samples, 2))}"/>')
    out.append(f'<text class="speed__note" x="{f1((x0 + x1) / 2)}" y="{f1(pad_t + 22)}" text-anchor="middle">'
               f'{f1((hold_to.t - hold_from.t) / 60)} minutes at a standstill</text>')
    out.append("</svg>")
    return "\n".join(out)


def ledger(runs: list[Run]) -> str:
    longest = max(r.duration for r in runs)
    out = ['<table class="ledger">',
           '<caption class="sr">Seven sealed SITL runs, in the order flown</caption>',
           '<thead><tr><th scope="col">Run</th><th scope="col">Flown</th><th scope="col">Bridge code</th>'
           '<th scope="col">Outcome</th><th scope="col">Duration</th></tr></thead><tbody>']
    for n, r in enumerate(runs, 1):
        stamp = re.match(r"px4_teacher_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})", r.run_id)
        day = int(stamp.group(3))
        flown = f"{day} Sep, {stamp.group(4)}:{stamp.group(5)}"
        url = f"https://github.com/lesnargitonga/LesnarAI/tree/evidence/sitl-run-{r.run_id}"
        cls = "is-ok" if r.outcome == "completed" else "is-bad"
        word = "Completed" if r.outcome == "completed" else "Timed out"
        out.append(
            f'<tr class="{cls}"><th scope="row"><a href="{url}">{n}</a></th><td>{flown}</td>'
            f'<td><code>{r.code_rev}</code> {escape(r.code_label)}</td><td>{word}</td>'
            f'<td><span class="ledger__bar" style="--d:{r.duration / longest:.3f}"></span>'
            f'<span class="ledger__s">{round(r.duration)} s</span></td></tr>')
    out.append("</tbody></table>")
    return "\n".join(out)


def detections_figure() -> str:
    data = json.loads(DETECTIONS.read_text())
    runs = data["runs"]
    days = data["days"]
    peak = math.sqrt(max(r["n"] for r in runs))
    w, h, gap, base = 640.0, 170.0, 18.0, 146.0
    col = (w - gap * (len(days) - 1)) / len(runs)
    out = [f'<svg class="det" viewBox="0 0 {f1(w)} {f1(h)}" role="img" aria-labelledby="det-t det-d">',
           '<title id="det-t">Perception diagnostics, 87 runs, 13 to 16 April 2026</title>',
           f'<desc id="det-d">{data["withData"]} of {data["allRuns"]} runs recorded detections. '
           f'{sum(r["p"] for r in runs):,} of {data["totalEvents"]:,} events were proximity alerts. '
           f'Column height is the square root of each run\'s event count.</desc>']
    x = 0.0
    for d_i, day in enumerate(days):
        day_runs = [r for r in runs if r["d"] == day]
        x0 = x
        for r in day_runs:
            if r["n"] == 0:
                out.append(f'<rect class="det__none" x="{f1(x + col * .2)}" y="{f1(base - 3)}" '
                           f'width="{f1(col * .6)}" height="3"/>')
            else:
                hh = math.sqrt(r["n"]) / peak * (base - 8)
                foot = hh * r["p"] / r["n"]
                out.append(f'<rect class="det__body" x="{f1(x + col * .15)}" y="{f1(base - hh)}" '
                           f'width="{f1(col * .7)}" height="{f1(hh - foot)}"/>')
                if foot > 0:
                    out.append(f'<rect class="det__foot" x="{f1(x + col * .15)}" y="{f1(base - foot)}" '
                               f'width="{f1(col * .7)}" height="{f1(foot)}"/>')
            x += col
        label = f"{int(day[6:8])} Apr"
        out.append(f'<text class="det__day" x="{f1(x0)}" y="{f1(h - 6)}">{label}</text>')
        x += gap
    out.append("</svg>")
    return "\n".join(out)


def facts(runs: list[Run], phantom: Run) -> dict[str, str]:
    hold_from, hold_to = longest_hold(phantom)
    done = [r for r in runs if r.outcome == "completed"]
    return {
        "runs": str(len(runs)),
        "completed": str(len(done)),
        "fastest": str(round(min(r.duration for r in done))),
        "slowest": str(round(max(r.duration for r in done))),
        "timeout": str(round(phantom.duration)),
        "hold_min": f1((hold_to.t - hold_from.t) / 60),
        "obstacles": str(len(phantom.obstacles)),
    }


# ── writing ──────────────────────────────────────────────────────────────────

def inject(html: str, name: str, body: str, inline: bool = False) -> str:
    """Replace what sits between a marker pair; every pair with that name is filled."""
    pattern = re.compile(rf"(<!-- gen:{name} -->)(.*?)(<!-- /gen:{name} -->)", re.S)
    if not pattern.search(html):
        sys.exit(f"{PAGE.relative_to(SITE)}: marker gen:{name} not found")
    sep = "" if inline else "\n"
    return pattern.sub(lambda m: f"{m.group(1)}{sep}{body}{sep}{m.group(3)}", html)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO,
                        help="clone of lesnargitonga/LesnarAI with evidence branches fetched")
    args = parser.parse_args()
    if not (args.repo / ".git").exists():
        sys.exit(f"{args.repo} is not a git clone; pass --repo")

    runs = [load_run(args.repo, *spec) for spec in RUNS]
    phantom, recovered = runs[PHANTOM_RUN], runs[RECOVERED_RUN]

    html = PAGE.read_text()
    html = inject(html, "ledger", ledger(runs))
    html = inject(html, "plan", plan_figure(phantom, recovered))
    html = inject(html, "speed", speed_figure(phantom, recovered))
    html = inject(html, "detections", detections_figure())
    for key, value in facts(runs, phantom).items():
        html = inject(html, f"fact-{key}", value, inline=True)
    PAGE.write_text(html)
    print(f"wrote figures into {PAGE.relative_to(SITE)}")
    for key, value in facts(runs, phantom).items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
