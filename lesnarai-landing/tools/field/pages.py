#!/usr/bin/env python3
"""Write the Field Record case and company pages into the shared shell.

    python3 tools/field/pages.py && python3 tools/field/build.py

The shell (head, header, footer, theme bootstrap) is copied from index.html so it
cannot drift, and the CSP hash of the inline bootstrap stays valid. Each page body
is written by hand below; facts come from docs/lesnarai/CONTENT_INVENTORY_2026-11-01.md
and the project repositories. Output is plain static HTML.
"""
import json, re
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
HOME = (SITE / "index.html").read_text()
TRANSFERS = json.loads((SITE / "tools/assets/medimatch-plan.json").read_text())["transfers"]
BOOT = re.search(r'<meta name="color-scheme".*?</script>', HOME, re.S).group(0)
FOOT = re.search(r'<footer class="fr-foot">.*?</footer>', HOME, re.S).group(0)
FONTS = '<link rel="preload" href="/assets/fonts/archivo-400-800-latin.woff2" as="font" type="font/woff2" crossorigin>'
NAV = [("/work/", "Work"), ("/capabilities/", "Capabilities"), ("/engineering/", "Engineering"), ("/company/", "Company")]


def header(current):
    links = "".join(f'<a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>' for h, t in NAV)
    start = '<a class="nav-start" href="/start/"' + (' aria-current="page"' if current == "/start/" else "") + ">Start</a>"
    return ('<header class="fr-head"><div class="w">\n  <a class="mark" href="/">LESNAR <span>AI</span></a>\n'
            '  <span class="meta">Engineering company · Nairobi</span>\n'
            f'  <nav class="site-nav" aria-label="Primary">{links}{start}</nav>\n</div></header>')


def shell(path, title, desc, current, body, image="sentinel", extra=""):
    url = f"https://lesnarai.com{path}"
    canon = "" if path is None else f'<link rel="canonical" href="{url}">\n<meta property="og:url" content="{url}">\n'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · LESNAR AI</title>
<meta name="description" content="{desc}">
{canon}<meta property="og:type" content="website">
<meta property="og:site_name" content="LESNAR AI">
<meta property="og:title" content="{title} · LESNAR AI">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://lesnarai.com/assets/field/{image}.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
{BOOT}
{FONTS}
<link rel="stylesheet" href="/field.css">
<link rel="stylesheet" href="/field-motion.css">
<script src="/theme.js" defer></script>
<script src="/field-motion.js" defer></script>{extra}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
{header(current)}
<main id="main">
{body}
</main>
{FOOT}
</body>
</html>
"""


DIMS = {}
MAN = json.loads((SITE / "tools/assets/manifest.json").read_text())


def pic(name, alt, eager=False):
    m = MAN[name]
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return (f'<picture><source type="image/webp" srcset="/assets/field/{name}.webp">'
            f'<img src="/assets/field/{name}.jpg" width="{m["w"]}" height="{m["h"]}" {load} alt="{alt}"></picture>')


def frame(name, span, edge, num, title, cap, alt, select=False, href=None, eager=False):
    inner = pic(name, alt, eager)
    inner = f'<a class="frame__pic" href="{href}">{inner}</a>' if href else f'<div class="frame__pic">{inner}</div>'
    return (f'<figure class="frame frame--{span}{" frame--select" if select else ""}">'
            f'<div class="frame__edge"><span>{edge}</span><span>{num}</span></div>{inner}'
            f'<figcaption><b>{title}</b>{cap}</figcaption></figure>')


def stage(kind, label):
    return f'<span class="stage stage--{kind}"><i></i>{label}</span>'


def opening(crumb, name, lede, stage_html, facts):
    fs = "".join(f'<span class="data">{f}</span>' for f in facts)
    return f"""<div class="w case-open">
  <p class="crumb"><a href="/work/">Work</a> / {crumb}</p>
  <h1 class="statement">{name}</h1>
  <p class="lede">{lede}</p>
  <div class="facts">{stage_html}{fs}</div>
</div>"""


def limits(items, title="What this page does not show"):
    li = "".join(f"<li>{i}</li>" for i in items)
    return f'<section class="w sec" aria-labelledby="lim-h"><div class="limits"><h2 id="lim-h">{title}</h2><ul>{li}</ul></div></section>'


def nxt(line, cta="Start a conversation"):
    return f"""<section class="w" aria-labelledby="next-h"><div class="next">
  <h2 class="h2" id="next-h">{line}</h2>
  <div class="acts"><a class="act" href="/start/">{cta}</a><a class="act act--quiet" href="/work/">All work</a></div>
</div></section>"""


def steps(items):
    return '<ol class="steps">' + "".join(f"<li><div><b>{b}</b><span>{s}</span></div></li>" for b, s in items) + "</ol>"


def readings(items):
    out = []
    for v, unit, u, h, st in items:
        small = f"<small>{unit}</small>" if unit else ""
        out.append(f'<div class="reading"><div class="reading__v">{v}{small}</div><div class="reading__u">{u}</div>'
                   f'<h3>{h}</h3>{st}</div>')
    return '<div class="readings">' + "".join(out) + "</div>"


def sec(hid, title, lede, inner, cls="w sec", attrs=""):
    head = f'<div class="sec-head"><h2 class="h2" id="{hid}">{title}</h2>' + (f'<p class="lede">{lede}</p>' if lede else "<span></span>") + "</div>"
    return f'<section class="{cls}" aria-labelledby="{hid}"{attrs}>{head}{inner}</section>'


def strip(frames, roll=None):
    if not roll:
        return '<div class="strip">' + "".join(frames) + "</div>"
    return (f'<div class="strip strip--roll" id="{roll}" data-label="Frames: swipe through the roll">' + "".join(frames) + "</div>"
            f'<p class="roll-count" data-roll-for="{roll}" aria-hidden="true"><span>Swipe the roll</span><span><b>01</b> / {len(frames):02d}</span></p>')


PAGES = {}

# ── MEDIMATCH ────────────────────────────────────────────────────────────────
PAGES["/work/medimatch/"] = ("MediMatch",
  "MediMatch makes medical-supply surplus and shortage visible across Kenyan facilities and routes transfers on real roads. A research prototype on synthetic inventory.",
  "mm-roads", "/work/",
  opening("Health · geospatial", "MediMatch",
    "Hospitals let surplus medical stock expire while county facilities run out, and neither can see the other. "
    "MediMatch makes the gap visible and routes surplus across it, on real roads.",
    stage("prototype", "Prototype"), ["synthetic inventory · no patient records", "never deployed in a health system"])
  + sec("j-h", "From the globe to the street", "Four frames from one recording of the running product, on synthetic inventory.",
    '<div class="w" style="padding:0">' + strip([
      frame("mm-globe", 6, "INTRO", "01", "The globe", "the product's own hand flicks the globe toward Africa", "MediMatch intro: a hand flicks a dark globe"),
      frame("mm-kenya", 6, "INTRO", "02", "Kenya", "the globe settles and the tap lands on Kenya", "MediMatch intro: Kenya highlighted on the globe as the tap lands"),
      frame("mm-roads", 6, "NATIONAL", "03", "On the roads", "Nairobi to Mandera selected; every transfer follows the road network", "MediMatch national view with transfers drawn along roads, Nairobi to Mandera highlighted", select=True),
      frame("mm-nairobi", 6, "NAIROBI COUNTY", "04", "Street scale", "43 transfers inside the county, ranked by distance, urgency and fit", "MediMatch Nairobi County close-up: transfers on city roads"),
    ], roll="roll-mm") + "</div>", attrs=" data-reveal")
  + f"""<section class="w sec" aria-labelledby="roads-h" data-reveal><div class="two">
  <div><h2 class="h2" id="roads-h">Every line<br>is a <em>road</em></h2>
    <p class="body">Transfers move by truck, not by air, so every route is drawn along the road network.
      The routes are computed once, with our own instance of the OSRM routing engine on OpenStreetMap,
      and stored with the product. Nairobi to Mandera is 1,141 km by road, about 18 hours of driving. The
      public OSRM demo server is not used.</p>
    <p class="data">Roads © OpenStreetMap contributors · ODbL · {len(TRANSFERS)} transfers on {len({t["route"] for t in TRANSFERS})} stored routes</p>
    <figure class="mm-nai sheet">
<!-- gen:medimatch-nairobi -->
<!-- /gen:medimatch-nairobi -->
      <figcaption class="data">Nairobi County at street scale. The squares are the seven hubs; each dot is a facility that receives stock.</figcaption>
    </figure></div>
  <div class="map map--mm sheet" style="padding:10px">
<!-- gen:medimatch-map -->
<!-- /gen:medimatch-map -->
  </div></div>
  <div class="kmfig"><h3 class="kmfig__h">Road km, every transfer</h3>
<!-- gen:medimatch-routes -->
<!-- /gen:medimatch-routes -->
  </div>
</section>"""
  + sec("vid-h", "The product, moving", "The whole journey in one take: globe, Kenya, the roads, then Nairobi. It plays only if you ask it to.",
    '<figure class="frame frame--paper" style="max-width:1100px"><div class="frame__edge"><span>MEDIMATCH · SCREEN RECORDING</span><span>18 s</span></div>'
    '<div class="frame__pic"><video controls muted playsinline preload="none" width="1280" height="720" poster="/media/mm-roads-film-poster.jpg">'
    '<source src="/media/mm-roads-film.webm" type="video/webm"><source src="/media/mm-roads-film.mp4" type="video/mp4"></video></div>'
    '<figcaption><b>Globe to street, recorded</b>running product · synthetic inventory · captured frame by frame on a virtual clock · '
    'one scripted tap, shown as a ring · the Nairobi panel is cropped above its survey strip</figcaption></figure>')
  + sec("data-h", "What is real, and what is not", "",
    steps([("Real", "Facility names and locations are public and real. Road geometry is real, from OpenStreetMap."),
           ("Synthetic", "Every inventory quantity is demonstration data. No patient record is used anywhere."),
           ("Curated", "The coordinator briefs on screen are prepared text, not live model output."),
           ("Not research", "A survey form behind earlier material showed 64 responses: 52 were generated by our synthetic-survey tool, and the provenance of the other 12 is unverified. No survey figure is presented here as a finding.")]))
  + sec("stack-h", "How it is built", "",
    steps([("Interface", "React 18 and TypeScript, MapLibre for the maps, three.js for the globe."),
           ("Engine", "Express and Zod: listings normalised into offers and urgent requests, matched urgent-first."),
           ("Routing", "Stored road routes from a self-hosted OSRM; a labelled estimate only if a route is missing."),
           ("Origin", "A research project at USIU-Africa, presented at a health conference hosted by Unique Conferences Canada. Source: <a href=\"https://github.com/lesnargitonga/MediMatch\">github.com/lesnargitonga/MediMatch</a>.")]))
  + limits(["Deployment inside any health system. It has not been deployed.", "Real stock levels: inventory is synthetic.",
            "Survey findings: the survey is not participant research.", "Live AI: the briefs are curated text."])
  + nxt("Moving supplies, people or assets across real roads?"))

# ── ZYGOS ────────────────────────────────────────────────────────────────────
PAGES["/work/zygos/"] = ("Zygos",
  "Zygos shows who is behind a business and what is known about it before you pay, weighing independent evidence above the business's own word.",
  "zygos", "/work/",
  opening("Trust and safety", "Zygos",
    "Before you pay a business you found online, Zygos shows who is behind it and what is known about it. "
    "It never calls anyone a scammer. It shows the evidence and where it came from.",
    stage("prototype", "Demonstrated · pre-production"), ["private source", "demonstration records are fictional"])
  + sec("rules-h", "Four rules the system will not break", "",
    steps([("A claim is not a fact", "What a reporter says happened is recorded as their claim, kept apart from the evidence about it."),
           ("A business's own word is not proof", "What a business declares about itself is evidence to weigh, never a verification."),
           ("Authority is not independence", "Different web addresses or authors never count as independent sources."),
           ("Every decision leaves a trail", "Reports, responses and moderation decisions are written to an audit chain.")]))
  + sec("line-h", "One fictional claim, traced", "A demonstration business, NovaCart, from search to the published record. These are fictional records, and the app says so on every screen.",
    '<div class="w" style="padding:0">' + strip([
      frame("zygos-search", 3, "SEARCH", "01", "Search", "a buyer checks a name before paying · fictional", "Zygos search results for NovaCart"),
      frame("zygos-claim", 3, "CLAIM", "02", "Claim", "the reporter's account, disputed by the business · fictional", "A reported claim about NovaCart, marked disputed", select=True),
      frame("zygos-compare", 3, "COMPARE", "03", "Compare", "two identities side by side; no score is invented · fictional", "Zygos comparing NovaCart and NovaCart Deals KE"),
      frame("zygos-method", 3, "METHOD", "04", "Method", "the rules, published to the people they apply to", "Zygos methodology page"),
    ]) + "</div>")
  + sec("t-h", "Tested before it is trusted", "Milestone 9, 9 October 2026.",
    readings([("438", "", "unit tests passing", "Unit", stage("prototype", "Milestone 9")),
              ("201", "", "integration tests passing", "Integration", stage("prototype", "Milestone 9")),
              ("136", "", "browser tests, with accessibility checks at 390 and 412 px", "Browser", stage("prototype", "Milestone 9")),
              ("118", "", "audit-chain events, chain unbroken", "Audit", stage("prototype", "Milestone 9"))]))
  + limits(["A real business: the final demonstration on one awaits approval.", "Multi-factor sign-in and notifications: not yet built.",
            "Real phones: testing used emulated devices.", "Real people or businesses: every record shown is fictional."])
  + nxt("Need a system people can trust with a decision?"))

# ── LESNAR TV ────────────────────────────────────────────────────────────────
PAGES["/work/lesnar-tv/"] = ("LESNAR TV",
  "LESNAR TV is a native Android TV home screen built for a 2 GB television, measured on the real device: cold start, memory and navigation jank.",
  "lesnartv", "/work/",
  opening("Devices", "LESNAR TV",
    "A fast, ad-free home screen for a 2 GB television. It learns which apps you use, on the TV itself.",
    stage("internal", "Internal alpha"), ["Kotlin · Android TV", "used daily on one television; not distributed"])
  + '<section class="sec" aria-labelledby="scr-h"><div class="w"><h2 class="h2" id="scr-h">Three homes, ten feet away</h2></div><div class="w">'
  + strip([frame("lesnartv", 12, "GLASS", "01", "Glass", "emulator · fictional fixture apps · 1920×1080", "LESNAR TV Glass home screen", select=True),
           frame("tv-ink", 6, "INK", "02", "Ink", "emulator · fictional fixture apps", "LESNAR TV Ink theme"),
           frame("tv-spaces", 6, "SPACES", "03", "Spaces", "emulator · fictional fixture apps", "LESNAR TV Spaces view")])
  + "</div></section>"
  + sec("walk-h", "A focus walk, measured on the TV", "Measured on a TCL Google TV: Android 11, ARMv7, 2 GB of RAM, 1920×1080.",
    readings([("440", "ms", "median cold start, 0.3.0-alpha.2", "Open", stage("internal", "Measured")),
              ("94.9", "MB", "settled memory; the stock launcher used 104 MB in an indicative v0.1 comparison", "Hold", stage("internal", "Measured")),
              ("8.1", "%", "janky frames on D-pad moves, p95 18 ms. Over the 3% and 16 ms budget.", "Move", stage("research", "Over budget")),
              ("128.5", "MB", "memory with the Glass theme, against a 95 MB budget. Open issue.", "Glass", stage("research", "Over budget")),
              ("14/14", "", "phone-remote key presses delivered through Link, 31 Oct 2026", "Link", stage("internal", "Measured")),
              ("472–529", "ms", "cold start at v0.1, before the redesign", "v0.1", stage("internal", "Measured"))]))
  + sec("what-h", "What it is", "",
    steps([("Learns, locally", "Orders your apps by how you use them, on the television, with no account."),
           ("Four themes", "Glass, Ink, Classic and High Contrast."),
           ("Spaces", "Groups apps by what you are doing: watch, listen, play."),
           ("Link", "A phone companion paired by QR code, usable as a remote.")]))
  + limits(["Distribution: it is not published, and there is no release signing key yet.",
            "Meeting its budgets: navigation smoothness and Glass memory are over target.",
            "A screensaver: one was pulled after it stopped responding to keys.",
            "Real apps in these frames: the screens are emulator captures with fictional apps."])
  + nxt("Building for low-cost devices people actually own?"))

# ── LESNAR PLAY ──────────────────────────────────────────────────────────────
PAGES["/work/lesnar-play/"] = ("LESNAR PLAY",
  "LESNAR PLAY runs co-op games on a television with its own local relay. Phones join as controllers by scanning a code, with no app and no account.",
  "lesnarplay", "/work/",
  opening("Devices", "LESNAR PLAY",
    "Couch co-op without a console. The television runs the game and its own local relay, and phones join as controllers by scanning a code.",
    stage("prototype", "Prototype"), ["game: Comet Circuit", "no app · no account · LAN only"])
  + '<section class="sec" aria-labelledby="pair-h"><div class="w"><h2 class="h2" id="pair-h">The phone is the controller</h2></div><div class="w">'
  + strip([frame("lesnarplay", 8, "TCL TV", "01", "On the television", "real TCL television · co-op wave 1 · adb capture, 28 Oct 2026", "Comet Circuit running on a television", select=True),
           frame("play-phone", 4, "PHONE", "02", "The pad", "desktop-browser capture of the phone controller", "LESNAR PLAY phone controller"),
           frame("play-lobby", 12, "LOBBY", "03", "Join by code", "desktop-browser capture · QR code and four-digit join code", "Comet Circuit lobby with a QR code and players joined")])
  + "</div></section>"
  + sec("relay-h", "No console, no laptop, no cloud", "",
    steps([("The TV hosts", "The game and a WebSocket relay run on the television itself."),
           ("A code to join", "The screen shows a QR code and a four-digit join code, rate-limited."),
           ("The phone plays", "The pad opens in the phone's browser. Nothing to install, no account."),
           ("Nothing leaves the room", "Inputs travel over the local network only, under a strict content policy.")]))
  + sec("pm-h", "Measured on the TCL", "With one real phone connected, version 0.4.0.",
    readings([("26.97", "%", "janky frames during play; the first prototype measured 43.11%", "Frames", stage("research", "Over budget")),
              ("14", "ms", "median frame time; p99 117 ms", "Pacing", stage("prototype", "Measured")),
              ("186.9", "MB", "memory in use on a 2 GB set", "Memory", stage("prototype", "Measured"))]))
  + limits(["Four real players: four-player play has only run with simulated pads.", "Smooth frame pacing: still well over budget on the TCL.",
            "Bluetooth gamepads: untested.", "Distribution: it is not published."])
  + nxt("Turning everyday devices into something new?"))

# ── CAREPRO ──────────────────────────────────────────────────────────────────
PAGES["/work/carepro/"] = ("CarePro",
  "CarePro matches families in Nairobi with verified home nurses and arranges payment. LESNAR AI engineered the platform; it is a controlled public beta.",
  "carepro", "/work/",
  opening("Health", "CarePro",
    "Home nursing for families in Nairobi. A family is matched to a verified nurse, and payment is arranged through the platform.",
    stage("live", "Controlled public beta"), ["LESNAR AI engineered the platform", "no claim about who owns or runs the service"])
  + f"""<section class="w sec" aria-labelledby="gate-h"><div class="two">
  <div><h2 class="h2" id="gate-h">The gate before<br>a nurse is sent</h2>
    <p class="body">No nurse reaches a family until every check has passed, and the last check is a registered nurse
      reading the whole file.</p></div>
  <div>{steps([("Documents", "The applicant submits identity and professional documents."),
                ("Licence", "The licence is checked against the Nursing Council register."),
                ("Interview", "A structured interview is scored against a clinical rubric."),
                ("Clinical review", "A registered nurse reviews the whole file and signs off."),
                ("Approval", "Only then can the nurse be offered work.")])}</div></div></section>"""
  + '<section class="sec" aria-labelledby="pub-h"><div class="w"><h2 class="h2" id="pub-h">What the public sees</h2></div><div class="w">'
  + strip([frame("carepro", 3, "HOME", "01", "Booking", "public home page · Oct 2026", "CarePro public home page"),
           frame("carepro-nurse", 3, "APPLY", "02", "Nurse sign-up", "public registration page · Oct 2026", "CarePro nurse registration form"),
           '<figure class="frame frame--6"><div class="frame__edge"><span>VERIFICATION</span><span>03</span></div><div class="frame__pic">'
           '<picture><source type="image/webp" srcset="/carepro-verification-2026-09-16.webp"><img src="/carepro-verification-2026-09-16.png" width="958" height="1086" loading="lazy" alt="CarePro published verification panel with four stages ending in clinical sign-off"></picture></div>'
           '<figcaption><b>The published gate</b>the product\'s own verification panel · captured 16 Sep 2026</figcaption></figure>'])
  + "</div></section>"
  + sec("book-h", "After the gate", "",
    steps([("A redacted offer", "The nurse sees the visit without the patient's details."),
           ("Acceptance", "Patient details are revealed only after the nurse accepts."),
           ("Payment", "Payment is confirmed through the platform before the visit."),
           ("Staff access", "Every staff account signs in with two factors; an audit browser records what was done.")]))
  + limits(["Any patient, nurse or booking screen: only public pages are shown.", "Automated refunds or payout runs: not built.",
            "Ownership of the service: this page describes our engineering only."])
  + nxt("Need a service where trust has to be earned before work starts?"))

# ── BIZMTAANI ────────────────────────────────────────────────────────────────
PAGES["/work/bizmtaani/"] = ("BizMtaani",
  "BizMtaani is a neighbourhood marketplace: shops list what they sell and customers order and pay from a phone. Live, with one merchant trading in Embu.",
  "bizmtaani", "/work/",
  opening("Commerce", "BizMtaani",
    "A neighbourhood marketplace. Shops list what they actually sell, and customers order and pay from a phone.",
    stage("live", "Live"), ["one merchant trading: The Villager, Embu", "built and operated by LESNAR AI"])
  + sec("order-h", "One order, start to finish", "Live storefront frames, then the merchant's side in the demonstration console, which runs on sample data and says so.",
    '<div class="w" style="padding:0">' + strip([
      frame("bizmtaani", 3, "FIND", "01", "Find", "live storefront · 12 Oct 2026", "BizMtaani storefront"),
      frame("biz-villager", 3, "ORDER", "02", "Order", "The Villager's live menu · Oct 2026", "The Villager on BizMtaani, open for orders", select=True),
      frame("biz-floor", 3, "STATIONS", "03", "Station tickets", "demonstration console · sample data", "BizMtaani station board"),
      frame("biz-daybook", 3, "DAYBOOK", "04", "Close the day", "demonstration console · sample data", "BizMtaani daybook"),
    ]) + "</div>")
  + sec("proof-h", "Proven before it carried money", "At the release of 27 October 2026.",
    readings([("2,066", "", "tests passing in 156 files, plus 37 database tests", "Tests", stage("live", "Release")),
              ("5/18", "", "orders accepted when 18 arrived at once for 5 in stock: exactly the stock", "Contention", stage("live", "In testing")),
              ("1", "", "merchant trading today", "Merchants", stage("live", "Live"))]))
  + '<section class="w sec" aria-labelledby="pl-h"><h2 class="h2" id="pl-h">Where it runs</h2><div class="gaz">'
    '<div class="gaz__row"><span class="place">Embu</span><span class="data">0°32′S 37°27′E</span><span class="gaz__sys"><b>The Villager</b>: bar and kitchen, the founding merchant.</span>'
    + stage("live", "Trading") + "</div></div></section>"
  + limits(["Riders: delivery riders are simulated.", "An enterprise offering: not built.",
            "Merchant-side screens with real data: those frames come from the demonstration console."])
  + nxt("Selling or ordering through phones in Kenya?"))

# ── JAMII ────────────────────────────────────────────────────────────────────
PAGES["/work/jamii-projects-hub/"] = ("Jamii Projects Hub",
  "Jamii Projects Hub keeps community projects in the open: ideas, votes, funding and reports, with records that survive scrutiny. Deployed; a pilot is being prepared.",
  "jamii-home", "/work/",
  opening("Community", "Jamii Projects Hub",
    "Community projects in the open: what is being planned, who voted for it, and a record that survives later scrutiny.",
    stage("prototype", "Prototype · deployed"), ["for families, chamas and welfare groups", "pilot in preparation"])
  + f"""<section class="w sec" aria-labelledby="trail-h"><div class="two">
  <div><h2 class="h2" id="trail-h">A paper trail<br>for every shilling</h2>
    <p class="body">Organising usually lives in notebooks and WhatsApp. Jamii gives each step a record,
      and lets people take part without a smartphone.</p></div>
  <div>{steps([("Idea", "A project is submitted, by phone, on paper or through a community champion."),
                ("Vote", "Members vote; verified votes are required for decisions."),
                ("Funding", "Contributions are recorded against the project, never as loans or donations."),
                ("Execution", "Progress is tracked in the open."),
                ("Report", "The outcome stays on the record.")])}</div></div></section>"""
  + '<section class="sec" aria-labelledby="js-h"><div class="w"><h2 class="h2" id="js-h">The public surface</h2></div><div class="w">'
  + strip([frame("jamii-home", 3, "HOME", "01", "Home", "public page · Oct 2026", "Jamii Projects Hub home page"),
           frame("jamii-projects", 3, "PROJECTS", "02", "Projects", "public project list · Oct 2026", "Jamii community projects list", select=True)])
  + "</div></section>"
  + '<section class="w sec" aria-labelledby="jp-h"><h2 class="h2" id="jp-h">Where the pilot is being prepared</h2><div class="gaz">'
    '<div class="gaz__row"><span class="place">Mbeere North</span><span class="data">Evurore · Muminji · Nthawa</span><span class="gaz__sys"><b>Controlled pilot</b>, as the product itself states.</span>'
    + stage("prototype", "In preparation") + "</div></div></section>"
  + limits(["Usage: no adoption or membership figure is evidenced.", "Lending or donations: the product does neither.", "Private member records: never shown."])
  + nxt("Need records a community can trust?"))

# ── GEN-EAT ──────────────────────────────────────────────────────────────────
PAGES["/work/gen-eat/"] = ("Gen-Eat",
  "Gen-Eat is a campus ordering demonstration: order from a café over WhatsApp and collect when ready. The portal is online as a demo; no café is live.",
  "geneat-flow", "/work/",
  opening("Commerce", "Gen-Eat",
    "Order from a campus café over WhatsApp and collect it when it is ready, instead of queueing between lectures.",
    stage("prototype", "Demonstration"), ["USIU campus", "no café live · no pilot has run"])
  + f"""<section class="w sec" aria-labelledby="walk-h"><div class="two">
  <div><h2 class="h2" id="walk-h">The walk between<br>lectures</h2>{steps([("Lecture ends", "A student has minutes, not a queue's worth of time."),
       ("Order", "The order goes to the café over WhatsApp."), ("Ready", "The café marks it ready."), ("Collect", "The student collects and walks on.")])}</div>
  <div>{frame("geneat-flow", 12, "PORTAL", "01", "The portal", "demonstration · stock café photo · synthetic till number", "Gen-Eat portal showing a café and the WhatsApp order flow", select=True).replace('<figure class="frame', '<figure style="background:var(--film);padding:14px" class="frame')}</div>
</div></section>"""
  + limits(["A live café: the four cafés are demonstration tenants.", "Working payments: the WhatsApp ordering and payment route is not active.",
            "A pilot: one at USIU is planned, not run.", "Its own platform: Gen-Eat ran as a tenant on Hazina Nomads' service."])
  + nxt("Ordering and payment for a campus or a chain?"))

# ── HAZINA ───────────────────────────────────────────────────────────────────
PAGES["/work/hazina-nomads/"] = ("Hazina Nomads",
  "Hazina Nomads sources Kenyan heritage pieces privately for travellers, diaspora families and companies. The storefront is online; ordering is paused.",
  "sentinel", "/work/",
  opening("Commerce", "Hazina Nomads",
    "Kenyan gifts and heritage pieces, sourced privately for travellers, diaspora families and corporate buyers.",
    stage("prototype", "Prototype"), ["storefront online", "ordering service paused"])
  + sec("brief-h", "A brief, not a checkout", "Buying starts with a private sourcing brief and continues on WhatsApp.",
    steps([("The brief", "The buyer describes the occasion, the person and the budget."), ("Sourcing", "Pieces are found and curated against the brief."),
           ("The conversation", "Choices are confirmed on WhatsApp, with a person."), ("Handoff", "Delivery to a hotel, the airport or for export.")]))
  + sec("svc-h", "Built as its own service", "",
    steps([("A dedicated API", "Its own service and database, separate from the shared platform. Paused."),
           ("A tenant inside it", "Gen-Eat ran inside this service as a separate tenant.")]))
  + limits(["Orders, clients or revenue: none is evidenced.", "A working order flow today: the service is paused."])
  + nxt("Selling something rare, to people far away?"))

# ── CYPHER ───────────────────────────────────────────────────────────────────
PAGES["/work/cypher/"] = ("Cypher",
  "Cypher is governed prospect intelligence: retrieval that fails closed at the tenant boundary, measured guardrails, and a person who approves what goes out.",
  "sentinel", "/work/",
  opening("AI systems", "Cypher",
    "Prospect research by an AI system that is only allowed to look inside its own tenant, and has to ask a person before anything leaves.",
    stage("prototype", "Prototype · internal"), ["private source", "synthetic tenant data only"])
  + sec("perm-h", "The system that must ask permission", "",
    steps([("Tenant check", "Every retrieval needs a validated tenant. Without one, it fails closed."),
           ("Retrieval", "Evidence comes only from that tenant; crossing tenants needs an explicit admin mode."),
           ("Guardrails", "Prompt-injection and unsupported-claim checks are pinned as tests."),
           ("Policy", "Policy and SHIELD runtimes decide what may be proposed."),
           ("A person", "An operator approves. Live sending is gated and not enabled.")]))
  + sec("bench-h", "Measured, not asserted", "The phase-3 retrieval benchmark, reviewed by a person and audited claim by claim.",
    readings([("30", "", "Hazina cases", "Tenant A", stage("prototype", "Benchmark")),
              ("30", "", "Jamii cases", "Tenant B", stage("prototype", "Benchmark")),
              ("20", "", "cross-tenant cases, where leaking is the failure", "Boundary", stage("prototype", "Benchmark"))]))
  + limits(["Production use: nothing is operated, and no message is sent to anyone.", "Real customer data: tenants are synthetic.",
            "A single score: the benchmark is reviewed case by case, not reduced to one number here."])
  + nxt("Putting AI near customer data, with a person in charge?"))

# ── GOLD TRADER ──────────────────────────────────────────────────────────────
PAGES["/work/gold-trader/"] = ("Gold Trader",
  "Gold Trader is research into automated gold trading. It proved the naive strategy loses money and keeps live orders locked in code until an edge is shown.",
  "sentinel", "/work/",
  opening("Finance research", "Gold Trader",
    "Research into automated XAUUSD trading, run on paper. Its most useful result is the one that says no.",
    stage("research", "Research"), ["paper trading only · never real money", 'source: <a href="https://github.com/lesnargitonga/Gold-Trader">github.com/lesnargitonga/Gold-Trader</a>'])
  + '<section class="w sec" aria-labelledby="lock-h"><div class="limits" style="border-color:var(--signal)"><h2 id="lock-h" style="color:var(--signal)">Live orders: locked</h2>'
    '<ul><li>Live trading is off by default in code, and the interface can never switch it on.</li>'
    '<li>The lock stays until at least 20 forward Grade-A trades show an edge.</li></ul></div></section>'
  + sec("neg-h", "The refusal to trade", "Replays and backtests, not live results.",
    readings([("−$79,297", "", "unfiltered, overlapping signals from nine strategy families", "The firehose", stage("research", "Backtest")),
              ("−$334", "", "the same signals, one position at a time", "Sequential", stage("research", "Backtest")),
              ("110→0", "", "entries allowed once a macro hard block was added, in a 30-day replay", "Macro block", stage("research", "Replay")),
              ("+2.65R", "", "Grade-A trades when macro was mixed, at a 71% win rate", "Mixed macro", stage("research", "Replay")),
              ("−10.29R", "", "Grade-A trades when macro was aligned", "Aligned macro", stage("research", "Replay")),
              ("421", "", "tests passing; one pre-existing failure, one skipped", "Tests", stage("research", "Suite"))]))
  + limits(["Live performance: no real order has ever been placed.", "A proven edge: it is unproven until forward trades confirm it.",
            "Advice: nothing here is a recommendation to trade."])
  + nxt("Need research that is allowed to say no?"))

# ── SENTINELCORE ─────────────────────────────────────────────────────────────
PAGES["/work/sentinelcore/"] = ("SentinelCore",
  "SentinelCore is the evidence, event and identity foundation for LESNAR AI's security work. Sentinel Assurance, its qualification layer, runs authorised assessment and retest.",
  "sentinel", "/work/",
  opening("Security", "SentinelCore",
    "The evidence, event and identity foundation for our own security work, with Sentinel Assurance as its proof and qualification layer.",
    stage("internal", "Internal"), ["not Operation Sentinel, the <a href=\"/work/sentinel/\">aerial simulation</a>", "no customer deployment"])
  + sec("loop-h", "The assurance loop", "Sentinel Assurance: every step is authorised, recorded and retested before anything is closed.",
    steps([("Asset", "A tenant asset with a stable, canonical identity."), ("Policy and authorisation", "Nothing is assessed without an explicit, recorded permission."),
           ("Assessment", "An assessment cycle produces raw evidence, kept as evidence."), ("Finding", "Findings are fingerprinted so a recurrence is recognised."),
           ("Remediation and retest", "A remediation case, then an authorised retest."), ("Closure or reopen", "Closed only on a passing retest; reopened if it recurs.")]))
  + sec("m-h", "Measured, not marketed", "",
    readings([("142", "", "tests passing in the qualified assurance vertical slice", "Sentinel Assurance", stage("internal", "Qualified slice")),
              ("133", "", "tests passing in 21 files at one commit, 16 September 2026", "v1.0 baseline", stage("internal", "Baseline")),
              ("242", "", "tracked files: an orchestrator and five modules", "v1.0 baseline", stage("internal", "Baseline"))]))
  + limits(["External use: it is ready for an internal pilot on owned or synthetic assets only.",
            "Clearance for an external pilot: a reality audit found two high-severity issues that block one.",
            "Targets, findings or clients: never published."])
  + nxt("Need security work that is authorised and evidenced?"))

# ── CAPABILITIES ─────────────────────────────────────────────────────────────
def cap(cid, title, problem, scope, deliver, proofs):
    links = " · ".join(f'<a href="{h}">{t}</a>' for t, h in proofs)
    return (f'<section class="w sec" id="{cid}" aria-labelledby="{cid}-h"><div class="two">'
            f'<h2 class="h2" id="{cid}-h">{title}</h2><div>'
            + steps([("The problem", problem), ("What we build", scope), ("What you get", deliver)])
            + f'<p class="data" style="margin-top:14px">Evidence: {links}</p></div></div></section>')

PAGES["/capabilities/"] = ("Capabilities",
  "What LESNAR AI builds for clients: payments, trust and verification, autonomy and simulation, geospatial logistics, devices, and AI with a person in the loop.",
  "mm-roads", "/capabilities/",
  '<div class="w case-open"><h1 class="statement" style="margin-top:40px">What we<br>take <em>on</em></h1>'
  '<p class="lede">Six kinds of work, each with a system you can inspect. Where the proof belongs to a client, we describe it without their name.</p></div>'
  + cap("payments", "Payments and reconciliation", "Money that has to move through the instruments people actually use, and add up at the end of the day.",
        "Ordering, booking and payment flows on mobile money and WhatsApp, with merchant and staff back offices.",
        "A working product, its reconciliation and its daybook, tested under contention.",
        [("BizMtaani", "/work/bizmtaani/"), ("CarePro", "/work/carepro/"), ("Gen-Eat demo", "/work/gen-eat/")])
  + cap("trust", "Trust and verification", "Decisions where a wrong answer costs someone money or safety.",
        "Evidence models, verification gates, audit chains and authorised security assessment.",
        "A system whose every decision can be traced and re-checked.",
        [("Zygos", "/work/zygos/"), ("SentinelCore", "/work/sentinelcore/")])
  + cap("autonomy", "Autonomy and simulation", "Machines that must be proven before they are trusted in the field.",
        "Control bridges, mission logic, telemetry and sealed simulation runs.",
        "A stack proven in simulation, with the failures it found and fixed.",
        [("Operation Sentinel", "/work/sentinel/")])
  + cap("geospatial", "Geospatial and logistics", "Supply and demand that sit in different places and cannot see each other.",
        "Maps, matching and routing on real roads, from your data or open data.",
        "A map-led product with the routing stored and licensed properly.",
        [("MediMatch", "/work/medimatch/")])
  + cap("devices", "Devices and television", "Low-cost devices people already own, made to do more.",
        "Native Android TV software and local multiplayer, measured on the real hardware.",
        "Software tuned to the device, with its measurements on record.",
        [("LESNAR TV", "/work/lesnar-tv/"), ("LESNAR PLAY", "/work/lesnar-play/")])
  + cap("ai", "AI with a person in the loop", "AI near customers, money or code, where errors are expensive.",
        "Tenant-bounded retrieval, pinned guardrails, model evaluation before adoption, and human approval.",
        "An AI system that fails closed and asks before it acts.",
        [("Cypher", "/work/cypher/"), ("The Model foundry", "/engineering/#foundry")])
  + sec("client-h", "Client work, described without names", "Shown here with details withheld until each client agrees to more.",
    steps([("A security company", "An operations platform: rostering, an occurrence book whose entries can be corrected but not overwritten, an incident workflow, and a client portal that shows only the reports the company has released."),
           ("An optician", "A retail and workshop platform: prescription-to-collection workflow, mobile-money reconciliation and a tamper-evident audit trail."),
           ("A non-profit", "A records and fundraising platform: role-restricted records, consent, and traceable donations and receipts.")]))
  + nxt("Bring us the problem, not the specification.", "Start a project"))

# ── ENGINEERING ──────────────────────────────────────────────────────────────
PAGES["/engineering/"] = ("Engineering",
  "How LESNAR AI builds: evidence before claims, failures found in the data, models measured before they are trusted, and release gates that widen.",
  "sentinel", "/engineering/",
  '<div class="w case-open"><h1 class="statement" style="margin-top:40px">How we<br><em>build</em></h1>'
  '<p class="lede">Methods, not certificates. Each one below is something we actually do, shown on the work it came from.</p></div>'
  + sec("ev-h", "Evidence before claims", "A sealed simulation run carries a manifest with a SHA-256 for every file: the mission, the log, the telemetry and the world it flew in.",
    '<div class="channels"><div class="channel" style="--c:var(--signal)"><div class="channel__tag"><b>Sealed run</b><span class="data"><i></i>ground speed, runs 2 and 3<br>read from sealed telemetry</span></div>'
    '<div class="channel__trace"><a href="/work/sentinel/" aria-label="Operation Sentinel case">\n<!-- gen:sentinel-speed -->\n<!-- /gen:sentinel-speed -->\n</a></div></div></div>')
  + sec("fail-h", "Failures are found in the data", "",
    '<p class="body">A simulated drone stood still for 8.8 minutes in front of a wall that was not there. The telemetry showed why: '
    'the lidar model turned a 1 m × 38 m wall into a 19 m disc. The fix was checked against brute-force ray marching on 3,000 random shapes '
    'before it flew again. <a href="/work/sentinel/">The full case</a>.</p>')
  + '<section class="w sec" id="foundry" aria-labelledby="fd-h"><div class="sec-head"><h2 class="h2" id="fd-h">A model is measured<br>before it is trusted</h2>'
    '<p class="lede">The Model foundry: two runtimes, the same SHA-256-pinned Qwen2.5-Coder-7B-Instruct Q4_K_M weights, the same tasks.</p></div>'
  + readings([("80%", "", "tasks passed; the same answer exactly 8 of 10 times", "llama.cpp", stage("internal", "Baseline")),
              ("60%", "", "tasks passed; the same answer 6 of 10 times", "Ollama", stage("internal", "Baseline")),
              ("2/2", "", "times Ollama obeyed an instruction hidden in the work; llama.cpp ignored it", "Injection", stage("research", "Failure"))])
  + '<p class="body" style="margin-top:18px">On that evidence the baseline qualifies for local coding with a person reading the output, and not for autonomous code acceptance, security-sensitive decisions or instruction-boundary enforcement.</p></section>'
  + sec("mo-h", "Motion that is frame-exact", "The LESNAR Motion Pipeline, used for every moving image on this site.",
    steps([("Deterministic frames", "Rendered or captured frame by frame, never screen-recorded in real time."), ("One audio master", "Sound is designed once and shared by every encode."),
           ("Two encodes", "WebM and MP4 from the same frames."), ("Decode check", "Every encode is decoded in Chromium and Firefox and checked frame by frame.")]))
  + sec("gate-h", "Gates that widen", "A passing gate is evidence about the gate, not the page. Every real defect we found came from widening what was measured.",
    steps([("Static", "Structure, links, metadata and the content-security policy, without a browser."), ("Runtime", "Every page in Chromium, Firefox and WebKit, at phone and desktop widths, with accessibility checks."),
           ("Behaviour", "No JavaScript, reduced motion and keyboard only; proven by failing on deliberately broken pages first."), ("Transfer and performance", "What each page actually downloads, and how fast it paints.")]))
  + sec("sec-h", "Security, authorised", "Assessment runs only against assets we are authorised to test, under a recorded scope with a stop-work control. SentinelCore and Sentinel Assurance qualify our own tooling.",
    '<div class="acts"><a class="act act--quiet" href="/work/sentinelcore/">SentinelCore</a></div>')
  + nxt("Want this discipline on your system?"))

# ── COMPANY ──────────────────────────────────────────────────────────────────
PAGES["/company/"] = ("Company",
  "LESNAR AI LTD is an engineering company in Nairobi, Kenya, building software, AI and autonomous systems, and showing each at its real stage.",
  "sentinel", "/company/",
  '<div class="w case-open"><h1 class="statement" style="margin-top:40px">LESNAR AI</h1>'
  '<p class="lede">LESNAR AI LTD is an engineering company in Nairobi, Kenya. We make ambitious ideas real: we build software, AI and autonomous systems, and where a system is meant to run, we run it rather than hand over a repository.</p></div>'
  + f"""<section class="w sec" aria-labelledby="where-h"><div class="two">
  <div><h2 class="h2" id="where-h">Where we<br><em>work</em></h2><p class="body">The places our systems run, are being prepared, or are modelled. Simulation work has no place on a map.</p></div>
  <div class="map sheet" style="padding:10px">
<!-- gen:kenya-map -->
<!-- /gen:kenya-map -->
  </div></div></section>"""
  + sec("st-h", "How we describe our work", "Stage is how far a system has got, not how good it is. Every page on this site uses the same six.",
    '<div class="gaz">' + "".join(f'<div class="gaz__row"><span class="place">{p}</span><span class="data">{d}</span><span class="gaz__sys">{s}</span>{stage(k, p)}</div>' for p, d, s, k in [
      ("Live", "in use", "People use it now.", "live"), ("Pilot", "in trial", "Running with real users under agreed limits.", "pilot"),
      ("Prototype", "it works", "It runs; nobody depends on it yet.", "prototype"), ("Internal", "our own", "We run it on ourselves.", "internal"),
      ("Research", "nothing operated", "Investigation and evaluation only.", "research"), ("Simulation", "not the field", "Proven in a simulated world.", "sim")]) + "</div>")
  + sec("who-h", "Who you work with", "",
    steps([("Lesnar Gitonga", "Founder and engineer. You work with the engineer who builds the system; there is no account layer between the problem and the person solving it."),
           ("Nairobi, Kenya", "Software, AI, security and connected systems."),
           ("Direct", "hello@lesnarai.co.ke · WhatsApp +254 715 540 653")]))
  + nxt("Bring us the problem.", "Start a project"))

# ── START ────────────────────────────────────────────────────────────────────
START_FORM = (SITE / "start/index.html").read_text()
form = re.search(r'<form class="form" novalidate>.*?</form>', START_FORM, re.S).group(0)
PAGES["/start/"] = ("Start",
  "Start a project with LESNAR AI: what to bring, what makes a first message useful, what changes the price, and what happens after you send it.",
  "sentinel", "/start/",
  '<div class="w case-open"><h1 class="statement" style="margin-top:40px">Bring us<br>the <em>problem</em></h1>'
  '<p class="lede">Before anything else, whether we are the right people.</p></div>'
  + '<section class="w" aria-labelledby="fit-h"><h2 class="sr" id="fit-h">Fit</h2><div class="two">'
  + '<div><h3 class="h3">Bring us this</h3>' + steps([("Products people buy from", "Marketplaces, storefronts, ordering, payments."), ("Software that runs an organisation", "Members, approvals, records, scheduling."),
        ("AI you can inspect", "Held as structure rather than instructions in a prompt."), ("Infrastructure", "Hardening and reliability work on Linux servers."),
        ("Machines and devices", "Autonomy, simulation and device software, proven before it is trusted.")]) + "</div>"
  + '<div><h3 class="h3">Not this</h3>' + steps([("A rate card before a scope", "We price after we understand the work."), ("A specification to implement blind", "We discuss what it must never get wrong first."),
        ("A team of ten next week", "We are not a staffing agency."), ("Flattering evidence", "Our evidence says what is true.")]) + "</div></div></section>"
  + '<section class="w sec" aria-labelledby="msg-h"><div class="two"><div><h2 class="h2" id="msg-h">A useful first message</h2>'
    '<p class="body">Answer what you can. Only a way to reply is required. The button opens your own email app with the message composed; nothing is stored here.</p></div>'
    f'<div>{form}<div class="form__alt" id="write-directly"><p>Writing directly is equally valid, and often faster: '
    '<a href="mailto:hello@lesnarai.co.ke">hello@lesnarai.co.ke</a> · WhatsApp +254 715 540 653.</p></div></div></div></section>'
  + '<section class="w sec" id="cost" aria-labelledby="cost-h"><div class="sec-head"><h2 class="h2" id="cost-h">What changes the price</h2>'
    '<p class="lede">Priced per project, after scope. There is no rate card.</p></div>'
  + steps([("How many kinds of user", "A customer, a merchant and an administrator are three experiences sharing a database."), ("Whether money moves", "Payments and refunds change the architecture more than any feature list."),
           ("What it has to talk to", "Existing systems, provider APIs, WhatsApp, hardware. Each integration is real work."), ("Offline and mobile", "Working without a connection is a different system.")]) + "</section>"
  + '<section class="w sec" id="engagements" aria-labelledby="after-h"><div class="sec-head"><h2 class="h2" id="after-h">After you send</h2><span></span></div>'
  + steps([("You send it", "A paragraph about the problem is enough."), ("We reply", "Within two working days, usually with a question or two first."),
           ("We agree a time", "Nothing is booked until a person has agreed it with you."), ("A written scope", "What has to exist and what it must never get wrong, then a price.")]) + "</section>",
  )

# ── 404 ──────────────────────────────────────────────────────────────────────
NOT_FOUND = ("Page not found", "This page is not on the LESNAR AI record. See the work, or start a project with an engineering company in Nairobi.", "sentinel", "/404.html",
  '<div class="w case-open"><h1 class="statement" style="margin-top:40px">Not<br>on the <em>record</em></h1>'
  '<p class="lede">That page does not exist, or it has moved.</p><div class="acts"><a class="act" href="/work/">See the work</a><a class="act act--quiet" href="/start/">Start a project</a></div></div>')


def write():
    for path, spec in PAGES.items():
        title, desc, image, current, body = spec[:5]
        extra = '\n<script src="/motion.js" defer></script>' if path == "/start/" else ""
        if (SITE / path.strip("/") / "page.css").exists():
            extra += f'\n<link rel="stylesheet" href="{path}page.css">'
        out = SITE / path.strip("/") / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(shell(path, title, desc, current, body, image if image in MAN else "sentinel", extra))
        print("wrote", out.relative_to(SITE))
    title, desc, image, path, body = NOT_FOUND
    (SITE / "404.html").write_text(shell(path, title, desc, None, body, image))
    print("wrote 404.html")


if __name__ == "__main__":
    write()
