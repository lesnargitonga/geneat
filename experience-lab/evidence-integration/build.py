# -*- coding: utf-8 -*-
"""Phase 6 static architecture generator. Deliberately simple: one shell, nine
   surfaces, all content projected from the locked canonical objects."""
import io, os

R_WORK, R_CAPS, R_ENG, R_CO, R_START = "/work/", "/capabilities/", "/engineering/", "/company/", "/start/"
NAV = [(R_WORK,"Work"),(R_CAPS,"Capabilities"),(R_ENG,"Engineering"),(R_CO,"Company")]
ASSET = "/"   # stylesheets and scripts are served from the site root

DESC = {
 "/": "LESNAR AI is a Nairobi technology company building operational systems for environments where money, connectivity, institutions, people and physical work do not behave like clean software assumptions.",
 "/work/": "Eleven systems, each shown at its real maturity: five with a public surface, one pilot, one internal tool, three research systems and one stated direction.",
 "/capabilities/": "Six operational responsibilities LESNAR AI takes on, each naming the systems that evidence it and the limit of that evidence.",
 "/engineering/": "How the work is built and how far it is proven. Four principles, each with one demonstration and one limit.",
 "/company/": "LESNAR AI builds and operates production systems from Nairobi. Software, infrastructure, security and connected systems.",
 "/start/": "Bring us the problem, not the specification. What makes a first message useful, what changes the price, and what happens after you send it.",
 "/404": "That page does not exist.",
}
def desc(route, title):
    if route in DESC: return DESC[route]
    return f"{title}: a LESNAR AI system record, showing what the product publishes, what we interpret, its maturity and the limits of the evidence."

def shell(current, title, body, route, menu=False):
    nav = "".join(
        f'<a href="{h}"{" aria-current=\"page\"" if h==current else ""}>{t}</a>'
        for h,t in NAV)
    start = f'<a class="nav-start" href="/start/"{" aria-current=\"page\"" if current=="start.html" else ""}>Start</a>'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · LESNAR AI</title>
<meta name="description" content="{desc(route, title)}">
<link rel="canonical" href="https://lesnarai.co.ke{route if route != '/404' else '/'}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="LESNAR AI">
<meta property="og:title" content="{title} · LESNAR AI">
<meta property="og:description" content="{desc(route, title)}">
<meta property="og:url" content="https://lesnarai.co.ke{route if route != '/404' else '/'}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script>document.documentElement.dataset.js="on";try{{var t=localStorage.getItem("lesnarai-theme");if(t)document.documentElement.setAttribute("data-theme",t)}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/system.css">
<link rel="stylesheet" href="/motion.css">
<script src="/motion.js" defer></script>
<script src="/theme.js" defer></script>
</head>
<body{' data-menu="open"' if menu else ''}>
<header class="site-head"><div class="w">
  <a class="mark" href="/">LESNAR<i>AI</i></a>
  <nav class="site-nav" aria-label="Primary">{nav}{start}</nav>
  <div class="head-r">
    <a class="start" href="/start/">Start</a>
    <a class="menu" href="{'/' if menu else '/menu/'}" aria-expanded="{'true' if menu else 'false'}">Menu</a>
  </div>
</div>
<div class="panel" id="menu-panel"><div class="w">
  <ul>
    <li><a href="/work/">Work</a></li>
    <li><a href="/capabilities/">Capabilities</a></li>
    <li><a href="/engineering/">Engineering</a></li>
    <li><a href="/company/">Company</a></li>
  </ul>
  <a class="close" href="/">Close &times;</a>
</div></div></header>
<main class="w">
{body}
</main>
<footer class="site-foot"><div class="w">
  <div><h4>LESNAR AI</h4><p>Nairobi, Kenya.</p>
    <p>Software, AI, security and connected systems.</p></div>
  <div><h4>Go</h4><ul>
    <li><a href="/work/">Work</a></li><li><a href="/capabilities/">Capabilities</a></li>
    <li><a href="/engineering/">Engineering</a></li><li><a href="/company/">Company</a></li>
    <li><a href="/start/">Start</a></li></ul></div>
  <div><h4>Direct</h4>
    <p>hello@lesnarai.co.ke</p><p>WhatsApp +254 715 540 653</p></div>
</div>
<div class="w"><p class="studynote">Phase 9A integrated evidence study · route in production: <b>{route}</b><br>
  Not the site. Every claim here is registered in evidence/claims.json, and every evidence object in
  evidence/registry.json. Every control is created by script. With scripting off, none of them
  exist and every fact is still stated.</p></div>
</footer>
</body>
</html>
"""

# ── canonical system inventory ───────────────────────────────────────────────
SYS = [
 ("CarePro","/work/carepro/","live","Live",
  "Book a vetted nurse to care for someone at home, with payment arranged through the platform."),
 ("BizMtaani","/work/bizmtaani/","live","Live",
  "A neighbourhood marketplace: local shops list what they sell, customers order and pay from a phone, and riders carry the order."),
 ("Jamii Projects Hub","/work/jamii-projects-hub/","live","Live",
  "See what projects your community is planning, vote on what matters, and keep clear records for a family, chama or welfare group."),
 ("Gen-Eat","/work/gen-eat/","live","Live",
  "Order from your campus cafe over WhatsApp and collect it when it is ready, instead of queueing between lectures."),
 ("Hazina Nomads","/work/hazina-nomads/","live","Live",
  "Kenyan gifts and heritage pieces, sourced privately for travellers, diaspora families and corporate clients."),
 ("Greenhouse controller","/work/greenhouse-controller/","pilot","Pilot",
  "Owner-reported embedded control for a greenhouse: temperature, moisture and watering, unattended."),
 ("SentinelCore","/work/sentinelcore/","internal","Internal",
  "The studio's own tool for checking a Linux server is safe: it scans for open doors, watches the logs for trouble and tightens the settings that matter."),
 ("Cypher","/work/cypher/","research","Research",
  "Rules about what an AI system is allowed to do, and a person who has to approve it before anything happens."),
 ("Gold Trader","/work/gold-trader/","research","Research",
  "Research into automated gold trading, tested only on paper. It places no real orders with anyone's money."),
 ("Aerial systems","/work/aerial-systems/","research","Research",
  "Research into drone state and mission simulation, modelled in software rather than flown in the air."),
 ("Sensing and radar","/work/sensing-and-radar/","direction","Direction",
  "Sensing and radar: a stated direction we intend to work in. Nothing is built yet."),
]
GROUPS = [("live","Live","five systems with a public surface"),
          ("pilot","Pilot","one, owner-reported"),
          ("internal","Internal","one, run by the company on itself"),
          ("research","Research","three, nothing operated"),
          ("direction","Direction","one, nothing built")]

def mat(cls,label): return f'<span class="mat mat--{cls}"><i></i>{label}</span>'

def reg_rows(items):
    return "".join(
      f'<a class="reg__row" href="{h}"><span class="reg__n">{n}</span>'
      f'<span class="reg__p">{p}</span>{mat(c,l)}</a>'
      for n,h,c,l,p in items)

# ═══ 1 · HOME ════════════════════════════════════════════════════════════════
home = f"""
<div class="open">
  <p class="open__k">Nairobi</p>
  <h1>A technology company building operational systems.</h1>
  <p class="open__l">For environments where money, connectivity, institutions, people and
     physical work do not behave like clean software assumptions.</p>
</div>

<section data-density="dense">
  <span class="k">one operation</span>
  <h2>How one order moves</h2>
  <p class="lede">BizMtaani, as the marketplace publishes it. Responsibility passes twice.</p>
  <div class="op" data-state="0" data-map='[{{"hold":0,"rel":null,"b":null,"watch":null,"t":"Our reading: the customer holds it, across both of their published steps."}},{{"hold":null,"rel":0,"b":0,"watch":null,"t":"Transfer state. We show the customer as released and the shop as not yet holding. Neither is marked as the holder here."}},{{"hold":1,"rel":null,"b":null,"watch":null,"t":"Our reading: the shop holds it. The published step is \u201chears about it at the counter\u201d."}},{{"hold":null,"rel":1,"b":1,"watch":null,"t":"Transfer state again. We show the shop as released and the rider as not yet holding."}},{{"hold":2,"rel":null,"b":null,"watch":3,"t":"Our reading: a rider holds it. The customer\u2019s published step here is \u201cwatches it arrive\u201d, which we mark as observing rather than holding."}}]'>
    <p class="cond"><b>Operating condition</b><span>Search runs on business name and town, so
      the first thing a customer does is narrow to what is physically near them.</span></p>
    <ol class="steps">
      <li class="step" data-actor="customer" data-region="0" data-si="0"><b>Customer</b><span>Finds a shop in their town</span></li>
      <li class="step" data-actor="customer" data-region="0" data-si="1"><b>Customer</b><span>Adds what they want</span></li>
      <li><p class="bound" data-bound="0"><b>Responsibility passes</b><span>Customer &rarr; the shop</span></p></li>
      <li class="step" data-actor="shop" data-region="1" data-si="2"><b>The shop</b><span>Hears about it at the counter</span></li>
      <li><p class="bound" data-bound="1"><b>Responsibility passes</b><span>The shop &rarr; a rider</span></p></li>
      <li class="step" data-actor="rider" data-region="2" data-si="3"><b>A rider</b><span>Carries it</span></li>
      <li class="step" data-actor="customer" data-region="3" data-si="4"><b>Customer</b><span>Watches it arrive</span></li>
    </ol>
    <div class="ctl"></div>
    <p class="ctl__say">Five stages and two crossings, as the marketplace publishes them.</p>
    <div class="resp"><dl>
      <dt>Source fact</dt><dd>BizMtaani publishes these actions in its own words:
        &ldquo;Find a local business, order and pay from your phone &hellip; and riders carry
        it&rdquo;, and for merchants &ldquo;Orders arrive on a screen built for a counter&rdquo;.
        It addresses three parties through its own navigation: buying, selling and riding.
        Captured 16 Sep 2026.</dd>
      <dt>Interpretation</dt><dd>Responsibility is <b>inferred from that published actor and
        action sequence</b>. It is our reading of who owes the next action.</dd>
      <dt>Limit</dt><dd>The product publishes no state name and no ordering guarantee. Nothing
        here says a step cannot proceed before another.</dd>
    </dl></div>
  </div>
</section>

<section data-density="normal">
  <span class="k">work exists</span>
  <h2>Eleven systems in the register</h2>
  <p class="lede">Five have a public surface. The rest are a pilot, an internal tool, research
     and a stated direction, each shown as what it is.</p>
  <div class="reg" style="margin-top:18px">{reg_rows(SYS[:3])}</div>
  <p class="limit" style="margin-top:16px"><b>One visible qualification</b><span>CarePro
    publishes 20 nurses joined and 0 approved for assignments, alongside a four-stage verification
    process ending in clinical sign-off by a registered nurse. Captured 16 Sep 2026. That is not
    evidence of traffic, revenue, uptime or scale.</span></p>
  <a class="act" href="/work/">Open the register &rarr;</a>
</section>

<section data-density="normal">
  <span class="k">relevance</span>
  <h2>What we can take on with you</h2>
  <p class="lede">Chosen editorially from the capabilities with credible current evidence, not
     ranked by system count.</p>
  <div class="rows" style="margin-top:16px">
    <div><b>Payments and reconciliation</b><span>Taking payment the way people actually pay, and
      keeping the internal record in agreement with the provider&rsquo;s. Evidenced by
      BizMtaani, Gen-Eat and CarePro.</span></div>
    <div><b>Coordination and fulfilment</b><span>Orders, matching, dispatch and handoffs between
      people and organisations that do not share one system. Evidenced by BizMtaani, Gen-Eat and
      Hazina Nomads.</span></div>
    <div><b>Identity, authority and approval</b><span>Establishing who someone is, what they may
      do, and who approved a consequential action. Evidenced by CarePro.</span></div>
  </div>
  <a class="act" href="/capabilities/">All six capabilities &rarr;</a>
</section>

<section data-density="quiet">
  <span class="k">engineering</span>
  <h2>Measure instead of assert</h2>
  <p class="lede">What the company measures, it measures by a stated method on a stated day, and
     publishes with what the result does not prove. Most of what it holds is published or
     structural, and it says so.</p>
  <a class="act" href="/engineering/">How the work is built &rarr;</a>
</section>

<section data-density="quiet">
  <span class="k">start</span>
  <h2>Bring us the problem, not the specification.</h2>
  <p class="lede">A paragraph about the problem is enough. We reply within two working days,
     usually with a question or two first. The first conversation is free and carries no
     commitment.</p>
  <a class="act" href="/start/">Start a project &rarr;</a>
</section>
"""

# ═══ 2 · WORK REGISTER ═══════════════════════════════════════════════════════
grouped = ""
for cls,label,note in GROUPS:
    rows = [s for s in SYS if s[2]==cls]
    grouped += f'<p class="reg__grp">{label}<em>{note}</em></p>{reg_rows(rows)}'

work = f"""
<div class="open">
  <p class="open__k">The register</p>
  <h1>Eleven systems, each shown as what it is.</h1>
  <p class="open__l">Ordered by maturity. Maturity is not quality and not importance:
     it is how far a system has actually got.</p>
</div>
<section data-density="dense">
  <div class="reg">{grouped}</div>
</section>
<section data-density="quiet">
  <p class="lede">Depth differs too. A record is <b>Full</b> or <b>Compact</b> depending on how
     much honest information exists, never on how important the system is. A Compact record can
     become Full without changing its address.</p>
</section>
"""

# ═══ 3 · CAPABILITIES ════════════════════════════════════════════════════════
CAPS = [
 ("Payments and reconciliation",
  "Taking payment through the instruments people actually use, and keeping the internal record in agreement with the provider's.",
  "M-Pesa STK push initiated from a chat message · card payment alongside M-Pesa · reconciling a provider event against the internal record.",
  "BizMtaani, Gen-Eat, CarePro", "Live", None),
 ("Identity, authority and approval",
  "Establishing who someone is, what they are allowed to do, and who approved a consequential action.",
  "Licence and registry checks, scored interviews, and a named human sign-off that can refuse.",
  "CarePro (Live), Cypher (Research)", "Live",
  "Scoped to approval of consequential actions. This is not identity infrastructure, and CarePro's steps are described by the product, not measured by us."),
 ("Coordination and fulfilment",
  "Moving work across customers, operators and organisations that do not share one clean system.",
  "Catalogue, inventory and order flow · rider and pickup logistics · ordering over WhatsApp with no app to install.",
  "BizMtaani, Gen-Eat, Hazina Nomads", "Live", None),
 ("Records and accountability",
  "Maintaining records, decisions, receipts, votes and approvals that have to survive later scrutiny.",
  "Group records for families, chamas and welfare groups, with votes and clear balances.",
  "Jamii Projects Hub", "Live",
  "One live system, running as a pilot in Mbeere North. Not yet an institutional deployment."),
 ("Infrastructure, reliability and security",
  "Deployment, isolation, access boundaries, observability, hardening, failure behaviour and recovery.",
  "Port scanning, log watching and host hardening on Linux servers: an orchestrator and five modules, with 133 tests passing at a recorded commit.",
  "SentinelCore", "Internal",
  "Evidenced only by the tool the company runs on itself. No customer deployment of this capability is published."),
 ("Connected and embedded control",
  "Systems that sense, decide or act through physical equipment, including where the network is intermittent or absent.",
  "Temperature, moisture and watering held without a person or a network.",
  "Greenhouse controller", "Pilot",
  "A single owner-reported pilot. No second deployment and no published performance figure."),
]
capblocks = ""
capidx = ""
for name,resp,what,ev,matl,lim in CAPS:
    cls = {"Live":"live","Internal":"internal","Pilot":"pilot"}[matl]
    anchor = name.split()[0].lower().strip(",")
    capidx += (f'<a href="#{anchor}"><b>{name}</b>'
               f'<span>{resp.split(".")[0]}.</span>'
               f'<em>Evidence example &middot; {ev.split(",")[0].split(" (")[0]} &middot; {matl}</em></a>')
    limhtml = (f'<p class="limit"><b>Evidence limit</b><span>{lim}</span></p>' if lim else "")
    capblocks += f"""
    <article class="cap" id="{anchor}">
      <div class="cap__h"><h2>{name}</h2>{mat(cls,"Evidence base &middot; "+matl+" system")}</div>
      <p class="cap__r">{resp}</p>
      <p class="cap__r" style="margin-top:8px">{what}</p>
      <p class="cap__e">Evidenced by <b>{ev}</b></p>
      {limhtml}
    </article>"""

capabilities = f"""
<div class="open">
  <p class="open__k">Capabilities</p>
  <h1>Six operational responsibilities we take on.</h1>
  <p class="open__l">Not services. Each is a responsibility inside someone&rsquo;s operation,
     and each names the systems that evidence it, including where that evidence is only
     internal or a single pilot.</p>
</div>
<section data-density="dense">
  <span class="k">The map</span>
  <div class="capidx">{capidx}</div>
  {capblocks}
</section>
<section data-density="quiet">
  <h2>Where AI appears</h2>
  <p class="lede">AI is not one of these six. It appears as a technique inside real work:
     in Cypher, as rules about what an AI system is allowed to do and a person who has to
     approve it before anything happens. Where it is not demonstrated, it is not claimed.</p>
  <a class="act" href="/work/">See the systems &rarr;</a>
</section>
"""

# ═══ 4 · ENGINEERING ═════════════════════════════════════════════════════════
PRIN = [
 ("Build it, then run it",
  "Live systems are deployed and operated as distinct product surfaces rather than handed over as a repository.",
  "Five live systems publish on distinct product domains. Gen-Eat and Hazina additionally have documented dedicated service and data-store separation.",
  "The same service and database separation has not been independently documented for every live system. Continued operation is a separate engagement, not a promise the company makes by default."),
 ("Measure instead of assert",
  "What the company measures, it measures by a stated method, on a stated day, and publishes with what the result does not prove.",
  "SentinelCore's test suite, run on 16 Sep 2026 at a recorded commit: <b>133 tests passed in 21.87s across 21 files</b>.",
  "A passing suite proves the implementation behaves as its own tests specify. It is not evidence of deployment, operational use, or uptime."),
 ("Say what is not claimed",
  "Every record states its evidence strength: measured by us, published by the product, or structural in the product's own surface. The limit sits beside the claim it limits.",
  "CarePro's verification panel, captured and captioned with what it does not show.",
  "Most evidence the company holds is Published or Structural. Measured is rare: reachability, and one test run."),
 ("Direct, not layered",
  "You work with the engineer who builds the system. There is no account layer between the problem and the person solving it.",
  "One engineer, named, on the Company page.",
  "This is a description of how the company works today, not a statement about capacity."),
]
prinblocks = ""
for t,d,x,l in PRIN:
    prinblocks += f"""
    <article class="prin"><div class="pair">
      <div><h2>{t}</h2><p class="prin__d">{d}</p></div>
      <div class="pair__b">
        <div class="prin__x"><b>Demonstrated by</b><span>{x}</span></div>
        <div class="prin__x prin__x--lim"><b>Limit</b><span>{l}</span></div>
      </div>
    </div></article>"""

engineering = f"""
<div class="open">
  <p class="open__k">Engineering</p>
  <h1>How the work is built, and how far it is proven.</h1>
  <p class="open__l">Four principles, each with one demonstration and one limit. Read the
     principle alone for the argument; read the demonstration and limit for the evidence.</p>
</div>
<section data-density="dense">{prinblocks}</section>
<section data-density="normal">
  <span class="k">Worked example</span>
  <h2>SentinelCore</h2>
  <p class="lede">The company's own tooling has no public surface, so what is published is its
     committed structure: five modules and one orchestrator, named as the repository names them
     , and the two stages that are wired in but not yet built.</p>
  <a class="act" href="record-sentinelcore.html">Open the record &rarr;</a>
</section>
"""

# ═══ 5 · COMPANY ═════════════════════════════════════════════════════════════
company = f"""
<div class="open">
  <p class="open__k">Company</p>
  <h1>LESNAR AI builds and operates production systems from Nairobi.</h1>
  <p class="open__l">Software, infrastructure, security and connected systems. Where a system
     is meant to run, it is deployed and operated rather than handed over as a repository.</p>
</div>

<section data-density="quiet">
  <span class="k">Worldview</span>
  <p class="stmt">Software that ignores the conditions is not finished. The hard part was never
     the model. It is the money, the network, the institution and the person at the
     counter.</p>
</section>

<section data-density="normal">
  <span class="k">What exists now</span>
  <h2>Eleven systems, five with a public surface</h2>
  <p class="lede">Marketplaces, home healthcare, community records, campus ordering and private
     sourcing are live. One embedded pilot, one internal tool, three research systems and one
     stated direction complete the register.</p>
  <a class="act" href="/work/">The register &rarr;</a>
</section>

<section data-density="normal">
  <span class="k">Where it is going</span>
  <h2>Direction, stated as direction</h2>
  <p class="lede">Sensing and radar is a direction the company intends to work in. Nothing is
     built. Aerial work exists in simulation and nowhere else. These are listed in the
     register at their real maturity and are not presented as operating scale.</p>
</section>

<section data-density="quiet">
  <span class="k">Responsibility</span>
  <h2>Lesnar Gitonga</h2>
  <p class="lede">Founder and engineer. You work with the engineer who builds the system; there
     is no account layer between the problem and the person solving it.</p>
  <div class="slot" style="margin-top:18px">
    <b>Documentary photography required, not yet commissioned</b>
    <span>Founder at the workstation. Profile or three-quarter from behind the shoulder, never
      to the lens. Hands on the work, at least one screen carrying real work. Available light,
      corrected white balance. No stock, no staged team, no borrowed hardware.</span>
  </div>
</section>

<section data-density="quiet">
  <span class="k">Company facts</span>
  <div class="rows">
    <div><b>Location</b><span>Nairobi, Kenya</span></div>
    <div><b>Practice</b><span>Software, AI, security and connected systems</span></div>
    <div><b>Direct</b><span>hello@lesnarai.co.ke &middot; WhatsApp +254 715 540 653</span></div>
  </div>
  <a class="act" href="/start/">Start a project &rarr;</a>
</section>
"""

# ═══ 6 · START ═══════════════════════════════════════════════════════════════
start = f"""
<div class="open">
  <p class="open__k">Start &middot; is this for you?</p>
  <h1>Before anything else, whether we are the right people.</h1>
</div>

<section data-density="normal" style="padding-top:20px">
  <div class="gate">
    <div><h2>Bring us this</h2><ul>
      <li>Products people buy from: marketplaces, storefronts, ordering, payments.</li>
      <li>Software that runs an organisation: members, approvals, records, scheduling.</li>
      <li>AI held as inspectable structure rather than instructions in a prompt.</li>
      <li>Infrastructure, hardening and reliability work on Linux servers.</li>
      <li>Embedded control for equipment that has to keep running without a network.</li>
    </ul></div>
    <div class="gate--no"><h2>Not this</h2><ul>
      <li>Work that needs a rate card before a scope.</li>
      <li>A specification to implement without discussing what it must never get wrong.</li>
      <li>Anything that needs a team of ten starting next week.</li>
      <li>Work where the evidence has to be more flattering than the truth.</li>
    </ul></div>
  </div>
  <p class="lede" style="margin-top:18px">If the left column is your problem, the rest of this
     page is what we need from you and what happens next.</p>
</section>

<section data-density="normal">
  <span class="k">First message</span>
  <h2>What makes a first message useful</h2>
  <ul class="plain">
    <li>What is going wrong now, and for whom.</li>
    <li>The one failure that would matter most.</li>
    <li>What already exists: a system, a spreadsheet, a WhatsApp group, or a person doing it by hand.</li>
    <li>How you would know it had worked, in terms you could check yourself.</li>
  </ul>
  <form class="form" novalidate>
    <div class="fld">
      <label for="f-reply">How we reply to you<span class="opt">required</span></label>
      <p class="help">An email address or a phone number. Nothing else is required.</p>
      <input id="f-reply" name="reply" type="text" autocomplete="email"
             required placeholder="name@company.co.ke">
      <p class="err" id="f-reply-err">We need one way to reach you.</p>
    </div>
    <div class="fld">
      <label for="f-wrong">What is going wrong now, and for whom<span class="opt">optional</span></label>
      <textarea id="f-wrong" name="wrong" rows="3"></textarea>
    </div>
    <div class="fld">
      <label for="f-fail">The one failure that would matter most<span class="opt">optional</span></label>
      <textarea id="f-fail" name="fail" rows="2"></textarea>
    </div>
    <div class="fld">
      <label for="f-exists">What already exists<span class="opt">optional</span></label>
      <p class="help">A system, a spreadsheet, a WhatsApp group, a person doing it by hand.</p>
      <textarea id="f-exists" name="exists" rows="2"></textarea>
    </div>
    <div class="fld">
      <label for="f-known">How you would know it had worked<span class="opt">optional</span></label>
      <p class="help">In terms you could check yourself.</p>
      <textarea id="f-known" name="known" rows="2"></textarea>
    </div>
    <div class="form__act">
      <button type="button" disabled aria-disabled="true">Open email (needs scripting)</button>
      <span class="form__note">This opens your own email app with the message composed. Nothing is
        stored here and there is no tracking. If you would rather write directly, the address is
        below and it reaches the same place.</span>
    </div>
    <p class="form__state"></p>
  </form>
  <div class="form__alt" id="write-directly">
    <p>Writing directly is equally valid, and often faster:
      <a href="mailto:hello@lesnarai.co.ke">hello@lesnarai.co.ke</a> &middot;
      WhatsApp +254 715 540 653.</p>
  </div>
</section>

<section data-density="normal" id="cost">
  <span class="k">Cost</span>
  <h2>What changes the price</h2>
  <p class="lede">Priced per project, after scope. There is no rate card, because a marketplace
     with payments and a merchant back office is not the same job as an embedded controller.</p>
  <div class="rows" style="margin-top:14px">
    <div><b>How many kinds of user</b><span>A customer, a merchant and an administrator are three
      experiences sharing a database, each with its own rules and permissions.</span></div>
    <div><b>Whether money moves</b><span>Payments and refunds change the architecture more than
      any feature list does.</span></div>
    <div><b>What it has to talk to</b><span>Existing systems, provider APIs, WhatsApp, hardware
      . Each integration is real work.</span></div>
    <div><b>Offline and mobile</b><span>Working without a connection is a different system to
      working with one.</span></div>
  </div>
</section>

<section data-density="quiet" id="engagements">
  <span class="k">After you send</span>
  <div class="rows">
    <div><b>You send it</b><span>A paragraph about the problem is enough.</span></div>
    <div><b>We reply</b><span>Within two working days, usually with a question or two first.</span></div>
    <div><b>We agree a time</b><span>Nothing is booked until a person has agreed it with you.</span></div>
    <div><b>Then a written scope</b><span>What has to exist and what it must never get wrong is
      agreed first. That stage produces a written scope and a price.</span></div>
  </div>
  <p class="lede" style="margin-top:16px">Or write directly: hello@lesnarai.co.ke &middot;
     WhatsApp +254 715 540 653.</p>
</section>
"""

# ═══ 7 · FULL LIVE RECORD · CarePro ══════════════════════════════════════════
carepro = f"""
<p class="parent"><a href="/work/">&larr; Register</a> <b>LESNAR AI</b> &middot; system record
  &middot; Nairobi</p>
<div class="open">
  <p class="open__k">Live product &middot; carepro.co.ke</p>
  <h1>CarePro</h1>
  <p class="open__l">Home nursing for families in Nairobi. A family is matched to a nurse, and
     payment is arranged through the platform.</p>
</div>

<section data-density="dense">
  <span class="k">Who acts, and what happens</span>
  <h2>How a nurse reaches a family</h2>
  <div class="op">
    <ol class="steps">
      <li class="step"><b>A nurse</b><span>Submits National ID and nursing licence</span></li>
      <li class="step"><b>Operations</b><span>Checks the licence against the Nursing Council register</span></li>
      <li class="step"><b>Operations</b><span>Scores a structured interview against a clinical rubric</span></li>
      <li><p class="bound"><b>Responsibility passes</b><span>Operations &rarr; a registered nurse</span></p></li>
      <li class="step"><b>A registered nurse</b><span>Reviews the whole file and approves, or does not</span></li>
      <li class="step"><b>A family</b><span>Is matched to an approved nurse</span></li>
    </ol>
    <div class="resp"><dl>
      <dt>Source fact</dt><dd>CarePro publishes these four verification steps on its own
        surface, in this order, as named steps.</dd>
      <dt>Interpretation</dt><dd>The actors and the point where responsibility passes to a
        registered nurse are <b>our reading of the published sequence</b>.</dd>
      <dt>Limit</dt><dd>No blocking rule is published. Nothing states that a match cannot occur
        before sign-off; the record does not claim one.</dd>
    </dl></div>
    <p class="limit"><b>Why this one does not step</b><span>The sequence on the home page can be
      stepped through because both of its crossings are drawn. This one claims a single transfer
      and leaves its other actor changes unmarked, because the source does not support marking
      them. Stepping it would invent handoffs this record declines to claim.</span></p>
  </div>
</section>

<section data-density="normal">
  <span class="k">Evidence</span>
  <h2>What &ldquo;verified&rdquo; actually means</h2>
  <div class="ev pair">
    <span class="ev__fig"><img src="/carepro-verification-2026-09-16.png" alt="CarePro's published verification panel: four numbered stages (credentials, registry check against the Nursing Council of Kenya, scored interview, and clinical sign-off by a registered nurse) above the product's own counters reading 20 nurses joined and 0 approved for assignments." width="958" height="1086" loading="lazy" decoding="async"></span>
    <dl class="ev__cap pair__b">
      <dt>Source</dt><dd>carepro.co.ke &middot; captured 2026-09-16 &middot; EV-CAREPRO-VERIFY-01</dd>
      <dt>Shows</dt><dd>The four verification stages the product names, and its own counters:
        <b>20 nurses joined, 0 approved for assignments.</b> The published values on the
        day of capture.</dd>
      <dt>Strength</dt><dd><b>Published.</b> Described by the product, not measured by us.</dd>
      <dt>Limit</dt><dd>Zero approved means no nurse had been approved at capture. Nothing here is
        traffic, revenue, uptime or scale, and no assignment is evidenced.</dd>
    </dl>
  </div>
  <p class="limit"><b>Not claimed</b><span>Traffic, revenue, uptime or scale. No regulatory
    approval, and no certification of the platform. The role and state-machine model are
    described, not measured.</span></p>
</section>

<section data-density="quiet">
  <span class="k">Reachability</span>
  <p class="lede">The public surface is checked from our server, not from your browser, and
     cached for a few minutes. Reachability tells you a host answered. It is not uptime,
     health, or evidence that the product works.</p>
</section>

<section data-density="quiet">
  <span class="k">Related work</span>
  <p class="lede">Cypher: rules about what a system is allowed to do, and a person who has
     to approve it before anything happens. Both gate a consequential action behind a named
     human approval.</p>
  <a class="act" href="/start/">Work like this &rarr;</a>
</section>
"""

# ═══ 8 · FULL INTERNAL RECORD · SentinelCore ═════════════════════════════════
sentinel = f"""
<p class="parent"><a href="/work/">&larr; Register</a> <b>LESNAR AI</b> &middot; system record
  &middot; Nairobi</p>
<div class="open">
  <p class="open__k">Internal &middot; no public surface</p>
  <h1>SentinelCore</h1>
  <p class="open__l">The company's own tool for checking a Linux server is safe: it scans for
     open doors, watches the logs for trouble, and tightens the settings that matter.</p>
</div>

<section data-density="normal">
  <span class="k">What this record is</span>
  <p class="lede">SentinelCore is run by LESNAR AI on its own infrastructure. It is not sold,
     not hosted for anyone, and has no customer deployment. It appears in the register because
     it exists and is used, not because it is a product.</p>
</section>

<section data-density="dense">
  <span class="k">What the command actually does</span>
  <h2>Five modules and one orchestrator</h2>
  <p class="lede">Read from the source, not from a running system. This is the committed
     structure, named as the repository names it, with each component&rsquo;s implementation
     state beside it.</p>
  <div class="struct">
    <div class="struct__r" data-impl="yes"><span class="struct__k">Orchestrator</span>
      <span class="struct__w">Runs the stages in order</span><span class="struct__s">Implemented</span></div>
    <div class="struct__r" data-impl="yes"><span class="struct__k">Module</span>
      <span class="struct__w">Async port scanning</span><span class="struct__s">Implemented</span></div>
    <div class="struct__r" data-impl="yes"><span class="struct__k">Module</span>
      <span class="struct__w">An inotify log watcher</span><span class="struct__s">Implemented</span></div>
    <div class="struct__r" data-impl="yes"><span class="struct__k">Module</span>
      <span class="struct__w">Settings hardening</span><span class="struct__s">Implemented</span></div>
    <div class="struct__r" data-impl="no"><span class="struct__k">Stage</span>
      <span class="struct__w">Present in the control flow, with no implementation behind it</span>
      <span class="struct__s">Wired &middot; not built</span></div>
    <div class="struct__r" data-impl="no"><span class="struct__k">Stage</span>
      <span class="struct__w">Present in the control flow, with no implementation behind it</span>
      <span class="struct__s">Wired &middot; not built</span></div>
  </div>
  <div class="resp" style="margin-top:14px"><dl>
    <dt>Source fact</dt><dd>The repository contains five modules and one orchestrator, and two
      stages wired into the control flow but not implemented.</dd>
    <dt>Interpretation</dt><dd>The order is <b>read from the source</b>, not observed on a
      running system. <b>No operational handoff is claimed.</b> These are components, not
      actors passing responsibility to one another.</dd>
    <dt>Limit</dt><dd>Nothing here is operated, so nothing operated is shown. This evidences
      that the code is organised this way, and nothing more.</dd>
  </dl></div>
</section>

<section data-density="normal">
  <span class="k">Evidence</span>
  <h2>What is committed</h2>
  <p class="lede">With no public surface there is no capture to show. What the register
     publishes instead is the set of commitments the system is built to hold, listed exactly as
     stated in the source.</p>
  <ul class="plain" style="margin-top:12px">
    <li>Async port scanning.</li>
    <li>An inotify log watcher.</li>
    <li>Settings hardening on the checks that matter.</li>
    <li>Two further stages wired in and not yet built.</li>
  </ul>
  <p class="limit"><b>Not claimed</b><span>A commitment is not a measurement. No detection rate,
    no coverage figure, no benchmark and no security assurance is published, and none should be
    inferred from the fact that the code exists.</span></p>
</section>

<section data-density="normal">
  <span class="k">Evidence &middot; measured</span>
  <h2>The suite, run and recorded</h2>
  <p class="lede">The one thing that can honestly be measured about a system with no public
     surface is whether its own tests pass, by a method anyone can repeat.</p>
  <div class="rows" style="margin-top:16px">
    <div><b>Method</b><span><code>python3 -m pytest tests -q</code> on the SentinelCore repository
      at a recorded commit, on a local Linux workstation. No network target was scanned and no
      host was modified.</span></div>
    <div><b>Result</b><span><b>133 tests passed, 0 failed, in 21.87s</b> across 21 test files:
      detection, exposure graph, monitoring, evidence legal hold, offensive lifecycle and safety,
      and owned-source connectors.</span></div>
    <div><b>Captured</b><span>16 Sep 2026 &middot; EV-SENTINEL-TESTS-01</span></div>
    <div><b>Strength</b><span>Measured by us, by a stated method, on a stated day.</span></div>
  </div>
  <p class="limit"><b>What a passing suite does not prove</b><span>That SentinelCore is deployed,
    operated, or protecting any real server. It proves the implementation behaves as its own tests
    specify. Nothing about the world follows from that.</span></p>
</section>

<section data-density="quiet">
  <span class="k">Why it is here</span>
  <p class="lede">SentinelCore is the worked example behind one engineering principle: measure
     instead of assert. It is the company's deepest record and it belongs to nobody else.</p>
  <a class="act" href="/engineering/">Engineering principles &rarr;</a>
</section>
"""

bizmtaani = f"""
<p class="parent"><a href="/work/">&larr; Register</a> <b>LESNAR AI</b> &middot; system record
  &middot; Nairobi</p>
<div class="open">
  <p class="open__k">Live product &middot; bizmtaani.com</p>
  <h1>BizMtaani</h1>
  <p class="open__l">A neighbourhood marketplace: local shops list what they sell, customers order
     and pay from a phone, and riders carry the order.</p>
</div>

<section data-density="dense">
  <span class="k">What the product publishes</span>
  <h2>Three parties, in its own words</h2>
  <p class="lede">Everything in this section is quoted or read directly from the product&rsquo;s own
     public surface. Nothing is inferred here.</p>
  <div class="rows" style="margin-top:16px">
    <div><b>What it does</b><span>&ldquo;Find a local business, order and pay from your phone.
      Kiosks, supermarkets, farms, butcheries, electronics shops and kitchens sell here, and riders
      carry it.&rdquo;</span></div>
    <div><b>For the merchant</b><span>&ldquo;Orders arrive on a screen built for a counter, and the
      money goes straight to your own account.&rdquo;</span></div>
    <div><b>Three parties</b><span>Published through its own navigation as <b>buying</b>, <b>selling</b>
      and <b>riding</b>, not as three named roles.</span></div>
    <div><b>Operator</b><span>The product&rsquo;s own footer: &ldquo;&copy; 2026 BizMtaani, operated
      by LESNAR AI LTD.&rdquo;</span></div>
  </div>
  <p class="limit" style="margin-top:20px"><b>Evidence strength</b><span>Published. Described
    by the product on its own surface, not measured by us. Captured 16 Sep 2026 &middot;
    EV-BIZ-ROLES-01, EV-BIZ-FLOW-01.</span></p>
</section>

<section data-density="normal">
  <span class="k">What we interpret</span>
  <h2>Where responsibility passes</h2>
  <p class="lede">The home page steps through this operation. The actions above are published; the
     ordering below, and the two points where responsibility changes hands, are ours.</p>
  <div class="resp"><dl>
    <dt>Source fact</dt><dd>The five actions and the three parties are published by the product,
      in the wording quoted above.</dd>
    <dt>Interpretation</dt><dd>That responsibility passes <b>twice</b>, customer to shop and shop
      to rider, is <b>our reading</b> of the published actor and action sequence. It is not a
      product state.</dd>
    <dt>Limit</dt><dd>The product publishes no state name and no ordering guarantee. Nothing here
      says a step cannot proceed before another, and no handoff is a product-native concept.</dd>
  </dl></div>
  <a class="act" href="/">See the sequence on the home page &rarr;</a>
</section>

<section data-density="normal">
  <span class="k">Maturity</span>
  <div class="rows">
    <div><b>Public state</b><span>Live. Deployed, operating, and open to applications</span></div>
    <div><b>Evidence strength</b><span>Published, from the product&rsquo;s own surface</span></div>
    <div><b>At capture</b><span>One business was publicly listed, in one of seven trade categories;
      the other six showed &ldquo;open to apply&rdquo;. A listing count on one day
      &middot; EV-BIZ-INVENTORY-01.</span></div>
    <div><b>Record depth</b><span>Full. It carries the operation the home page demonstrates.</span></div>
    <div><b>Related work</b><span>Gen-Eat: ordering and pickup over a phone, on a campus
      rather than a neighbourhood. The same coordination responsibility, a different operation.</span></div>
  </div>
  <p class="limit" style="margin-top:20px"><b>Not claimed</b><span>No transaction, customer, order,
    delivery, revenue, merchant count or market coverage is evidenced. Live is how far the system has
    got, not how much it carries. A listing count on one day is not traction, and reachability is not
    uptime.</span></p>
</section>

<section data-density="quiet">
  <span class="k">Where this is used</span>
  <p class="lede">BizMtaani evidences two of the six capabilities: payments and reconciliation, and
     coordination and fulfilment. Each capability names its own evidence base and its own limit.</p>
  <a class="act" href="/capabilities/">The capabilities &rarr;</a>
</section>
"""

# ═══ 9 · COMPACT RECORD · Aerial systems ═════════════════════════════════════
aerial = f"""
<p class="parent"><a href="/work/">&larr; Register</a> <b>LESNAR AI</b> &middot; system record
  &middot; Nairobi</p>
<div class="open">
  <p class="open__k">Research &middot; no public surface</p>
  <h1>Aerial systems</h1>
  <p class="open__l">Drone state and mission simulation, modelled in software. Nothing has been
     flown, in the air or anywhere else.</p>
</div>

<section data-density="quiet">
  <span class="k">What exists</span>
  <ul class="plain">
    <li>One simulation module, written here, that models a drone&rsquo;s state (position,
      altitude, heading, speed, battery, armed state and flight mode) and the mission it
      is carrying out.</li>
  </ul>
</section>

<section data-density="quiet">
  <span class="k">The boundary of the work</span>
  <h2>Nothing has been flown.</h2>
  <p class="lede">The work is a software model only. There is no airframe, no field test and no
     public surface to reach.</p>
  <p class="limit"><b>Not claimed</b><span>No control laws and no flight-controller work. No
    software- or hardware-in-the-loop run, and no logged simulated flight. No flight, range,
    endurance or autonomy result, and no hardware of any kind. Nothing here is operated.</span></p>
</section>

<section data-density="quiet">
  <span class="k">Maturity</span>
  <div class="rows">
    <div><b>Public state</b><span>Research. Nothing operated, nothing published</span></div>
    <div><b>Evidence strength</b><span>Structural. The simulation source exists; nothing was
      measured.</span></div>
    <div><b>Record depth</b><span>Compact. It will become Full when there is more to say, at
      this same address.</span></div>
    <div><b>Related work</b><span>Sensing and radar, a stated direction that is also unbuilt.</span></div>
  </div>
</section>
"""


# ═══ 10 · THE REMAINING RECORDS ══════════════════════════════════════════════
# Built from the Phase 9 audit only. No system was re-researched, no screenshot
# was created, and no operating history was invented.

def full(name, kicker, lede, published, interp, maturity, notclaimed, related, evid):
    pub = "".join(f'<div><b>{k}</b><span>{v}</span></div>' for k, v in published)
    mat = "".join(f'<div><b>{k}</b><span>{v}</span></div>' for k, v in maturity)
    return f"""
<p class="parent"><a href="{R_WORK}">&larr; Register</a> <b>LESNAR AI</b> &middot; system record
  &middot; Nairobi</p>
<div class="open">
  <p class="open__k">{kicker}</p>
  <h1>{name}</h1>
  <p class="open__l">{lede}</p>
</div>

<section data-density="dense">
  <span class="k">What the product publishes</span>
  <h2>In its own words</h2>
  <p class="lede">Read directly from the product&rsquo;s own public surface on 16 Sep 2026.
     Nothing in this section is inferred.</p>
  <div class="rows" style="margin-top:16px">{pub}</div>
  <p class="limit" style="margin-top:20px"><b>Evidence strength</b><span>Published. Described by the
    product, not measured by us. {evid}</span></p>
</section>

<section data-density="normal">
  <span class="k">What we read into it</span>
  <div class="resp"><dl>
    <dt>Source fact</dt><dd>{interp[0]}</dd>
    <dt>Interpretation</dt><dd>{interp[1]}</dd>
    <dt>Limit</dt><dd>{interp[2]}</dd>
  </dl></div>
</section>

<section data-density="normal">
  <span class="k">Maturity</span>
  <div class="rows">{mat}</div>
  <p class="limit" style="margin-top:20px"><b>Not claimed</b><span>{notclaimed}</span></p>
</section>

<section data-density="quiet">
  <span class="k">Related work</span>
  <p class="lede">{related}</p>
  <a class="act" href="{R_CAPS}">The capabilities &rarr;</a>
</section>
"""

def compact(name, kicker, lede, exists, boundary_h2, boundary_p, notclaimed, maturity):
    ex = "".join(f'<li>{x}</li>' for x in exists)
    mat = "".join(f'<div><b>{k}</b><span>{v}</span></div>' for k, v in maturity)
    return f"""
<p class="parent"><a href="{R_WORK}">&larr; Register</a> <b>LESNAR AI</b> &middot; system record
  &middot; Nairobi</p>
<div class="open">
  <p class="open__k">{kicker}</p>
  <h1>{name}</h1>
  <p class="open__l">{lede}</p>
</div>

<section data-density="quiet">
  <span class="k">What exists</span>
  <ul class="plain">{ex}</ul>
</section>

<section data-density="quiet">
  <span class="k">The boundary of the work</span>
  <h2>{boundary_h2}</h2>
  <p class="lede">{boundary_p}</p>
  <p class="limit"><b>Not claimed</b><span>{notclaimed}</span></p>
</section>

<section data-density="quiet">
  <span class="k">Maturity</span>
  <div class="rows">{mat}</div>
</section>
"""

jamii = full("Jamii Projects Hub", "Live product &middot; jamii.lesnarai.co.ke",
  "See what projects your community is planning, vote on what matters, and keep clear records "
  "for a family, chama or welfare group.",
  [("What it is", "&ldquo;Community projects &amp; clear group records.&rdquo; The home page opens: "
    "&ldquo;See what your community is doing, and have your say.&rdquo;"),
   ("Published structure", "Projects &middot; Public projects &middot; Submit a project &middot; Forms "
    "&middot; Public forms &middot; Governance &middot; Request access."),
   ("Who it is for", "Communities, families, chamas and welfare groups keeping records that have to "
    "survive later scrutiny.")],
  ("The product publishes its project, voting, forms and governance structure on its own surface, "
   "and names Mbeere North in its own source.",
   "That this evidences the <b>records and accountability</b> capability is our reading of that "
   "published structure.",
   "No membership figure, no project count and no adoption measure is published. Running as a pilot "
   "is what the product states, not something we measured."),
  [("Public state", "Live. Deployed and reachable on its own domain."),
   ("Evidence strength", "Published, from the product&rsquo;s own surface."),
   ("Deployment", "One live system, running as a pilot in Mbeere North."),
   ("Record depth", "Full."),
   ("Related work", "CarePro, which also gates a consequential action behind a named human.")],
  "No membership numbers, no project counts, no funds handled, no institutional deployment and no "
  "adoption measure. A reachable surface is not usage.",
  "CarePro places a named human approval in front of a consequential action. Jamii does the same for "
  "group decisions, with votes and balances that have to hold up afterwards.",
  "EV-REACH-01 &middot; capture 16 Sep 2026.")

geneat = full("Gen-Eat", "Live product &middot; geneat.lesnarai.co.ke",
  "Order from your campus cafe over WhatsApp and collect it when it is ready, instead of queueing "
  "between lectures.",
  [("What it is", "&ldquo;USIU campus food, on tap.&rdquo; The home page opens: &ldquo;Eat between "
    "classes.&rdquo;"),
   ("Published structure", "Caf&eacute;s &middot; Campus map &middot; For owners &middot; About "
    "&middot; Order now."),
   ("How ordering runs", "Ordering happens over WhatsApp with no app to install, and payment runs on "
    "M-Pesa through the platform&rsquo;s own payment rail.")],
  ("The product publishes its caf&eacute;s, campus map, owner surface and ordering route.",
   "That this evidences <b>payments and reconciliation</b> and <b>coordination and fulfilment</b> is "
   "our reading of that published structure.",
   "No order volume, no caf&eacute; count and no revenue is published. The pilot is at one "
   "university."),
  [("Public state", "Live. Deployed and reachable on its own domain."),
   ("Evidence strength", "Published, from the product&rsquo;s own surface."),
   ("Deployment", "A pilot at USIU."),
   ("Record depth", "Full."),
   ("Related work", "BizMtaani, the same coordination responsibility on a neighbourhood instead of a campus.")],
  "No orders, no transactions, no revenue, no caf&eacute; count and no student numbers. Live is how "
  "far the system has got, not how much it carries.",
  "BizMtaani carries the same coordination and payment responsibility across a neighbourhood. Gen-Eat "
  "runs it inside one campus, where the walk between counter and lecture is the whole problem.",
  "EV-REACH-01 &middot; capture 16 Sep 2026.")

hazina = full("Hazina Nomads", "Live product &middot; hazina.lesnarai.co.ke",
  "Kenyan gifts and heritage pieces, sourced privately for travellers, diaspora families and "
  "corporate clients.",
  [("What it is", "&ldquo;Private Sourcing Concierge.&rdquo; The home page opens: &ldquo;Private "
    "Kenyan curation, delivered with discretion.&rdquo;"),
   ("Published structure", "Collections &middot; Build &middot; Curation &middot; About &middot; "
    "Continue on WhatsApp."),
   ("How buying runs", "A private sourcing brief rather than a checkout-first storefront, with the "
    "conversation continuing on WhatsApp.")],
  ("The product publishes its collections, its bespoke build route and its concierge contact path.",
   "That this evidences <b>coordination and fulfilment</b> is our reading of that published structure.",
   "No order volume, no client list and no revenue is published. The concierge line is a personal "
   "number, not an automated channel."),
  [("Public state", "Live. Deployed on its own domain, with its own service and data store."),
   ("Evidence strength", "Published, from the product&rsquo;s own surface."),
   ("Infrastructure", "Runs as a dedicated API service with its own database, separate from the "
    "shared platform. This is the one separation the audit could document directly."),
   ("Record depth", "Full."),
   ("Related work", "Gen-Eat, which shares the platform Hazina was separated from.")],
  "No orders, no clients, no revenue, no export volume and no partner network. Discretion is the "
  "product&rsquo;s stated posture, not a claim about scale.",
  "Gen-Eat runs on the shared platform. Hazina was given its own service and data store, which is "
  "the separation the engineering record points at.",
  "EV-REACH-01, EV-PLATFORM-SEPARATION-01 &middot; capture 16 Sep 2026.")

cypher = compact("Cypher", "Research &middot; no public surface",
  "Rules about what an AI system is allowed to do, and a person who has to approve it before "
  "anything happens.",
  ["A governance spine delivered as a sequence of sprint bundles, carried to sprint 024.",
   "Its own notes describe a sandbox channel contract with no live sending."],
  "Nothing operates.",
  "The work exists as delivered bundles rather than an operated repository, which is weaker than the "
  "structural evidence behind the other systems. Nothing has been run against a live channel.",
  "No deployment, no operator, no decision it has ever gated in production, and no performance or "
  "safety result. A governance model is not a governed system.",
  [("Public state", "Research. Nothing operated, nothing published."),
   ("Evidence strength", "Structural. The artifacts exist; nothing was measured."),
   ("Record depth", "Compact. It will become Full when there is more to say, at this same address."),
   ("Related work", "CarePro, where a named human approval already gates a consequential action in a live product.")])

gold = compact("Gold Trader", "Research &middot; no public surface",
  "Research into automated gold trading, tested only on paper. It places no real orders with "
  "anyone&rsquo;s money.",
  ["A research and execution agent for XAUUSD, with a paper broker and a live broker path.",
   "Its own status table gates execution: <b>paper yes, live no</b>, until twenty forward grade-A "
   "trades confirm an edge.",
   "Only grade A is live-eligible. Grade B is paper only. Grades C and D are blocked."],
  "Nothing has traded.",
  "No executed-trade records exist anywhere in the repository. The live path is implemented and "
  "gated off, which is a different thing from being absent.",
  "No performance figure, no return, no win rate, no drawdown and no backtest result is claimed. "
  "Nothing here has handled real money.",
  [("Public state", "Research. Nothing operated, nothing published."),
   ("Evidence strength", "Structural. The gating is in the project&rsquo;s own status table; nothing was measured."),
   ("Record depth", "Compact."),
   ("Related work", "Cypher, which is the same question asked of an AI system rather than a market.")])

greenhouse = compact("Greenhouse controller", "Pilot &middot; owner-reported",
  "Embedded control for a greenhouse: temperature, moisture and watering, held without a person and "
  "without a network.",
  ["An owner&rsquo;s report that the controller was built and is running."],
  "There is nothing here to inspect.",
  "This is the weakest record on the site and it is published at its real strength. No firmware, no "
  "source, no log, no photograph and no measurement was found. The only basis is the owner&rsquo;s "
  "report, and the site says so rather than dressing it up.",
  "No performance figure, no uptime, no yield result, no second deployment and no independent "
  "verification. An owner report is not a measurement, and it is not published as one.",
  [("Public state", "Pilot. Owner-reported."),
   ("Evidence strength", "None that is traceable. Owner report only."),
   ("What would change this", "One dated photograph and one temperature or watering log would move "
    "this to structural evidence."),
   ("Record depth", "Compact."),
   ("Related work", "Sensing and radar, the stated direction this pilot sits nearest to.")])

sensing = compact("Sensing and radar", "Direction &middot; nothing built",
  "A stated direction we intend to work in. Nothing is built yet.",
  ["A stated intention, and no implementation."],
  "Nothing exists.",
  "This record is here so the intention is visible at its real weight. It is not a prototype, not a "
  "research project and not a capability. It is a direction, listed as one.",
  "No design, no prototype, no simulation, no hardware and no timeline. Nothing is claimed because "
  "nothing has been built.",
  [("Public state", "Direction. Nothing built."),
   ("Evidence strength", "None. The absence of evidence is the claim."),
   ("Record depth", "Compact, and deliberately so."),
   ("Related work", "Aerial systems, which is the nearest thing that does exist, as a software model.")])


PAGES = [
 ("/",                              "Home",                home),
 (R_WORK,                           "Work register",       work),
 (R_CAPS,                             "Capabilities",        capabilities),
 (R_ENG,                              "Engineering",         engineering),
 (R_CO,                               "Company",             company),
 (R_START,                            "Start",               start),
 ("/work/carepro/",                 "CarePro",             carepro),
 ("/work/bizmtaani/",               "BizMtaani",           bizmtaani),
 ("/work/jamii-projects-hub/",      "Jamii Projects Hub",  jamii),
 ("/work/gen-eat/",                 "Gen-Eat",             geneat),
 ("/work/hazina-nomads/",           "Hazina Nomads",       hazina),
 ("/work/greenhouse-controller/",   "Greenhouse controller", greenhouse),
 ("/work/sentinelcore/",            "SentinelCore",        sentinel),
 ("/work/cypher/",                  "Cypher",              cypher),
 ("/work/gold-trader/",             "Gold Trader",         gold),
 ("/work/aerial-systems/",          "Aerial systems",      aerial),
 ("/work/sensing-and-radar/",       "Sensing and radar",   sensing),
]

OUT = "dist"
def write(route, html):
    p = OUT + ("/index.html" if route == "/" else route.rstrip("/") + "/index.html")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    io.open(p, "w", encoding="utf-8").write(html)
    return p

import shutil
if os.path.isdir(OUT): shutil.rmtree(OUT)
for route, title, body in PAGES:
    write(route, shell(route, title, body, route))

# the no-script menu surface
write("/menu/", shell(R_CAPS, "Menu", capabilities, R_CAPS, menu=True))

# 404
notfound = f"""
<div class="open">
  <p class="open__k">404</p>
  <h1>That page does not exist.</h1>
  <p class="open__l">The address may have changed, or it may never have existed. Everything the
     company publishes is reachable from the register or the navigation above.</p>
</div>
<section data-density="quiet">
  <div class="rows">
    <div><b>The work</b><span><a href="{R_WORK}">Eleven systems, each shown as what it is &rarr;</a></span></div>
    <div><b>What we take on</b><span><a href="{R_CAPS}">Six operational responsibilities &rarr;</a></span></div>
    <div><b>Start</b><span><a href="{R_START}">Bring us the problem, not the specification &rarr;</a></span></div>
  </div>
</section>
"""
io.open(OUT + "/404.html", "w", encoding="utf-8").write(shell("/404", "Page not found", notfound, "/404"))

# static assets served from the root
for f in ("system.css","motion.css","motion.js","theme.js","carepro-verification-2026-09-16.png"):
    if os.path.exists(f): shutil.copy(f, OUT + "/" + f)

print(f"built {len(PAGES)} routes + /menu/ + 404 into {OUT}/")
