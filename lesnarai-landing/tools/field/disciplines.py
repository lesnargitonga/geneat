"""The engineering disciplines of LESNAR AI: one source for Home's stack and the Capabilities page.

Every discipline has a full name (Capabilities) and a short one (Home's stack). Each carries a maturity mark that
says how far our own work in it has gone:
  use     In use        running with real people (live or pilot)
  demo    Demonstrated  built and working; nobody depends on it yet (prototype or internal)
  exp     Experimental  research or simulation only
Each layer may name what it would take partners or resources to go further.

Proof lines either link a project page (name, href, stage) or describe client work without the
client's name: no client has given showcase consent (CONTENT_INVENTORY, D-16). Elixirs is
"capability evidence only" by ruling, so it appears here unnamed.
"""

MARKS = {
    "use": ("In use", "running with real people, live or in pilot"),
    "demo": ("Demonstrated", "built and working; nobody depends on it yet"),
    "exp": ("Experimental", "research or simulation only"),
}

def P(name, href, stage):           # a proof with its own page
    return {"name": name, "href": href, "stage": stage}

def C(text, stage, avail=None):     # client work, described without the client's name
    return {"name": text, "href": None, "stage": stage, "avail": avail}

LAYERS = [
  {"id": "organisations", "name": "Organisations", "line": "Enterprise systems, ERP and the platforms an institution runs on.",
   "partners": None,
   "disciplines": [
     {"id": "erp", "short": "Enterprise systems and ERP", "name": "Enterprise systems and custom ERP", "mark": "use",
      "what": "Operations software shaped around how an organisation actually works: stock and procurement, point of sale, "
              "day books and reconciliation, staff roles, approvals and an append-only audit trail, instead of an "
              "off-the-shelf package bent out of shape.",
      "proof": [C("A security company's operations platform: rostering, an occurrence book whose entries can be corrected "
                  "but not overwritten, an incident workflow and a client portal", "Pilot"),
                C("A hospitality operations platform, in pilot with real orders and mobile-money payments", "Pilot", "hospitality"),
                C("An optician's retail and workshop platform: prescription to collection, mobile-money reconciliation "
                  "and a tamper-evident audit trail", "Demonstrated")],
      "limit": "Statutory integrations such as KRA eTIMS are scoped per engagement; we have not shipped one yet."},
     {"id": "platforms", "short": "Organisational platforms", "name": "Organisational and community platforms", "mark": "use",
      "what": "Members, bookings, vetting, votes and records, with every decision leaving a trail that survives "
              "later scrutiny, and room for people without a smartphone.",
      "proof": [P("CarePro", "/work/carepro/", "Controlled beta"), P("Jamii Projects Hub", "/work/jamii-projects-hub/", "Pilot in preparation"),
                C("A non-profit's records and fundraising platform: role-restricted records, consent, traceable "
                  "donations and receipts", "Prototype")],
      "limit": None},
     {"id": "automation", "short": "Process automation", "name": "Business process automation", "mark": "use",
      "what": "Paper books, WhatsApp threads and spreadsheets turned into flows that record themselves: a stock "
              "delivery that posts its own expense, an order that reaches the day book, a request that routes "
              "to the person who can approve it.",
      "proof": [C("The hospitality platform's day book, which replaced two paper books", "Pilot"),
                P("Gen-Eat", "/work/gen-eat/", "Demonstration")],
      "limit": None},
   ]},
  {"id": "products", "name": "Products", "line": "Full-stack software, commerce and the integrations between systems.",
   "partners": None,
   "disciplines": [
     {"id": "fullstack", "short": "Full-stack software", "name": "Full-stack software engineering", "mark": "use",
      "what": "Web, mobile and API products end to end: interface, data model, authentication, payments, "
              "deployment and the tests that hold them together. TypeScript, React and Next.js; Node and Python "
              "(FastAPI) services; Kotlin; PostgreSQL.",
      "proof": [P("BizMtaani", "/work/bizmtaani/", "Live"), P("Zygos", "/work/zygos/", "Pre-production")],
      "limit": None},
     {"id": "commerce", "short": "Commerce and payments", "name": "Commerce and payments", "mark": "use",
      "what": "Storefronts, ordering and payment flows on the instruments people in Kenya use (M-Pesa, WhatsApp, "
              "cards), with reconciliation at the end of the day.",
      "proof": [P("BizMtaani", "/work/bizmtaani/", "Live"), P("Hazina Nomads", "/work/hazina-nomads/", "Storefront, paused"),
                C("Live mobile-money payments in the hospitality pilot", "Pilot")],
      "limit": None},
     {"id": "health", "short": "Health technology", "name": "Health technology", "mark": "use",
      "what": "Supply visibility, care coordination and verification for health services, built on synthetic or "
              "consented data, with a person verifying every consequential step.",
      "proof": [P("CarePro", "/work/carepro/", "Controlled beta"), P("MediMatch", "/work/medimatch/", "Prototype")],
      "limit": "Deployment inside a public health system needs clinical partners and regulatory work; none has happened."},
     {"id": "integrations", "short": "Integrations and APIs", "name": "Integrations and APIs", "mark": "use",
      "what": "Connecting systems that were never designed to talk: mobile money, messaging, routing engines, "
              "flight controllers and televisions.",
      "proof": [P("MediMatch, on a self-hosted OSRM", "/work/medimatch/", "Prototype"),
                P("Operation Sentinel, PX4 through MAVSDK", "/work/sentinel/", "Simulation"),
                P("LESNAR TV, with a phone companion", "/work/lesnar-tv/", "Internal")],
      "limit": None},
   ]},
  {"id": "intelligence", "name": "Intelligence", "line": "AI systems, agents and the evaluation that decides whether to trust them.",
   "partners": None,
   "disciplines": [
     {"id": "agents", "short": "AI and agents", "name": "AI systems and intelligent agents", "mark": "demo",
      "what": "Agents that retrieve, reason and propose inside hard boundaries: tenant isolation that fails "
              "closed, prompt-injection tests, policy checks, and a person approving anything that leaves.",
      "proof": [P("Cypher", "/work/cypher/", "Prototype")],
      "limit": "No agent of ours acts unsupervised in production."},
     {"id": "models", "short": "Model evaluation", "name": "Model evaluation and local AI", "mark": "demo",
      "what": "Choosing and qualifying models on hardware you control, with pinned weights and measured pass "
              "rates, and keeping consequential decisions deterministic and auditable.",
      "proof": [P("The Model foundry", "/engineering/", "Internal")],
      "limit": None},
   ]},
  {"id": "security", "name": "Security", "line": "Cybersecurity, assurance and systems that decide whom to trust.",
   "partners": "Round-the-clock monitoring as a managed service would need partners.",
   "disciplines": [
     {"id": "cyber", "short": "Cybersecurity", "name": "Cybersecurity and assurance", "mark": "demo",
      "what": "Authorised assessment, findings fingerprinted and retested before they close, governed and "
              "reversible containment, and decision engines qualified blind before they are trusted. "
              "Offensive testing only against owned, authorised targets.",
      "proof": [P("SentinelCore and Sentinel Assurance", "/work/sentinelcore/", "Internal")],
      "limit": None},
     {"id": "trust", "short": "Verification and trust", "name": "Verification and trust systems", "mark": "demo",
      "what": "Systems that decide whether to trust a seller, a document or a claim, and show the evidence "
              "and where it came from instead of a verdict.",
      "proof": [P("Zygos", "/work/zygos/", "Pre-production")],
      "limit": None},
   ]},
  {"id": "infrastructure", "name": "Infrastructure", "line": "Databases, servers, geospatial data and the reliability under all of it.",
   "partners": None,
   "disciplines": [
     {"id": "infra", "short": "Infrastructure and databases", "name": "Infrastructure, databases and reliability", "mark": "use",
      "what": "PostgreSQL and PostGIS data models, migrations that check themselves, Linux server hardening, "
              "cloud and VPS deployment, CI and the release gates that keep running systems up.",
      "proof": [C("The live and pilot systems on this page run on infrastructure we deploy and operate", "Live"),
                P("Checksum-guarded migrations in SentinelCore", "/work/sentinelcore/", "Internal")],
      "limit": None},
     {"id": "geo", "short": "Geospatial and logistics", "name": "Geospatial and logistics", "mark": "demo",
      "what": "Maps, routing and allocation on real road networks: who has what, who needs it, and the road "
              "between them.",
      "proof": [P("MediMatch: 55 transfers on 54 stored road routes", "/work/medimatch/", "Prototype")],
      "limit": None},
   ]},
  {"id": "machines", "name": "Machines and research", "line": "Embedded software, robotics, autonomy and experimental engineering.",
   "partners": "Physical airframes, field testing and certification need partners and resources we would bring in.",
   "disciplines": [
     {"id": "embedded", "short": "Embedded and devices", "name": "Embedded and device software", "mark": "demo",
      "what": "Software for constrained hardware: an operating layer for a television with 2 GB of RAM, phone "
              "companions, and devices that work on a local network without the cloud.",
      "proof": [P("LESNAR TV", "/work/lesnar-tv/", "Internal alpha"), P("LESNAR PLAY", "/work/lesnar-play/", "Prototype")],
      "limit": None},
     {"id": "autonomy", "short": "Robotics and autonomy", "name": "Robotics and autonomous systems", "mark": "exp",
      "what": "Autonomy stacks, mission logic, perception and operator consoles, proven in simulation with "
              "sealed, reproducible runs before anything flies.",
      "proof": [P("Operation Sentinel", "/work/sentinel/", "Simulation")],
      "limit": "No physical airframe has been flown."},
     {"id": "research", "short": "Research", "name": "Research and experimental engineering", "mark": "exp",
      "what": "Investigations where the honest answer may be no: quantitative trading research, perception "
              "diagnostics and model qualification.",
      "proof": [P("Gold Trader", "/work/gold-trader/", "Research")],
      "limit": None},
   ]},
]

INDUSTRIES = ["Health", "Commerce and hospitality", "Community and non-profit", "Security",
              "Media and entertainment", "Finance research"]
