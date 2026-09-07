/* SAME-ORIGIN REACHABILITY ────────────────────────────────────────────────
   The homepage used to make one opaque no-cors request per system straight
   from the visitor's browser: eight external requests to five third-party
   origins per visit, each carrying the visitor's IP, User-Agent, Referer and
   sec-ch-ua headers to hosts that have no business receiving them. It also
   produced false negatives - with tracking protection on, every system read
   "no answer" while all five were up, and the page displayed that as fact.

   This checks downstream once per server, from the server, and caches. The
   browser makes one same-origin request instead of eight cross-origin ones.

   It still reports reachability at a moment, never uptime. The response
   carries the moment it was checked so the page can say so honestly. */

const SYSTEMS = [
  { id: "bizmtaani", label: "BizMtaani",          host: "bizmtaani.com" },
  { id: "hazina",    label: "Hazina",             host: "hazina.lesnarai.co.ke" },
  { id: "carepro",   label: "CarePro",            host: "carepro.co.ke" },
  { id: "geneat",    label: "Gen-Eat",            host: "geneat.lesnarai.co.ke" },
  { id: "jamii",     label: "Jamii",              host: "jamii.lesnarai.co.ke" }
];

const TIMEOUT_MS = 4000;

async function reach(sys) {
  const started = Date.now();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    /* HEAD is enough to know something answered, and costs the downstream
       product almost nothing. A redirect still counts as an answer. */
    const r = await fetch("https://" + sys.host + "/", {
      method: "HEAD", redirect: "follow", signal: ctl.signal,
      headers: { "user-agent": "lesnarai-status/1.0 (+https://www.lesnarai.co.ke)" }
    });
    clearTimeout(t);
    return { id: sys.id, label: sys.label, host: sys.host,
             answered: true, ms: Date.now() - started, status: r.status };
  } catch (e) {
    clearTimeout(t);
    return { id: sys.id, label: sys.label, host: sys.host,
             answered: false, ms: Date.now() - started,
             reason: e && e.name === "AbortError" ? "timeout" : "unreachable" };
  }
}

export default async function handler(req, res) {
  const systems = await Promise.all(SYSTEMS.map(reach));
  /* One origin check serves every visitor for the TTL. 60s is fresh enough to
     mean something and light enough that five products are not polled per
     pageview. stale-while-revalidate keeps the page instant while it renews. */
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    checked: new Date().toISOString(),
    ttl: 60,
    note: "Reachability at the moment shown. Not an uptime record.",
    systems
  });
}
