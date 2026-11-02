/* Project enquiries from /start/.
 *
 * POST /api/enquiry with JSON (script) or a urlencoded form (no script).
 * Delivers one email through Resend to ENQUIRY_TO. Nothing is stored here: the email is the record,
 * and logs carry status codes only, never the message or the sender.
 *
 * Environment (set in the Vercel project, never in the repository):
 *   RESEND_API_KEY  Resend API key
 *   ENQUIRY_FROM    verified sender, e.g. "LESNAR AI <enquiries@lesnarai.co.ke>"
 *   ENQUIRY_TO      where enquiries go, e.g. hello@lesnarai.co.ke
 *
 * Responses (JSON): 200 {ok:true} only after the provider accepted the email; 400 invalid input;
 * 405 wrong method; 413 too large; 403 foreign origin; 429 too many; 503 delivery not configured or
 * the provider refused. The page treats anything but 200 as "not delivered" and offers email and
 * WhatsApp with the message preserved. A form post without script gets a small HTML page instead.
 */
"use strict";

const FIELDS = {
  reply: { label: "Reach me at", max: 200, required: true },
  wrong: { label: "What is going wrong now, and for whom", max: 2000 },
  fail: { label: "The one failure that would matter most", max: 2000 },
  exists: { label: "What already exists", max: 2000 },
  known: { label: "How I would know it had worked", max: 2000 },
};
const MAX_BODY = 12 * 1024;
const MIN_FILL_MS = 2500;            // faster than a person can fill the form
const WINDOW_MS = 60 * 60 * 1000;    // per-instance throttle window
const PER_WINDOW = 5;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const hits = new Map();              // best effort: serverless instances do not share memory

function client(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || "unknown";
}

function throttled(ip, now) {
  const seen = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);
  return seen.length > PER_WINDOW;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;          // a plain form post may omit Origin; the honeypot still applies
  try {
    return new URL(origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

function clean(value, max) {
  return String(value == null ? "" : value).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max + 1);
}

function validate(body) {
  const out = {};
  for (const [key, spec] of Object.entries(FIELDS)) {
    const v = clean(body[key], spec.max);
    if (v.length > spec.max) return { error: `${key} is too long` };
    out[key] = v;
  }
  if (!out.reply) return { error: "reply is required" };
  if (!EMAIL.test(out.reply) && !PHONE.test(out.reply)) return { error: "reply must be an email address or a phone number" };
  return { value: out };
}

function compose(v) {
  return Object.entries(FIELDS)
    .filter(([key]) => v[key])
    .map(([key, spec]) => `${spec.label}:\n${v[key]}`)
    .join("\n\n");
}

async function deliver(v, env, fetchImpl) {
  if (!env.RESEND_API_KEY || !env.ENQUIRY_FROM || !env.ENQUIRY_TO) return { ok: false, reason: "not_configured" };
  const message = {
    from: env.ENQUIRY_FROM,
    to: [env.ENQUIRY_TO],
    subject: "Project enquiry from lesnarai.com",
    text: compose(v) + "\n\n—\nSent from the Start page. Reply to the address above.",
  };
  if (EMAIL.test(v.reply)) message.reply_to = v.reply;
  const r = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  return r.ok ? { ok: true } : { ok: false, reason: `provider_${r.status}` };
}

function page(res, status, title, text) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${title} · LESNAR AI</title></head>` +
    `<body style="font:17px/1.55 system-ui,sans-serif;max-width:40rem;margin:12vh auto;padding:0 20px">` +
    `<h1 style="font-size:28px">${title}</h1><p>${text}</p><p><a href="/start/">Back to Start</a></p></body></html>`);
}

function reply(req, res, status, payload) {
  const wantsHtml = String(req.headers["content-type"] || "").includes("application/x-www-form-urlencoded");
  if (wantsHtml) {
    if (payload.ok) return page(res, 200, "Message sent", "Thank you. Your message reached LESNAR AI, and we will reply to the address you gave.");
    return page(res, status, "Not sent", "Your message could not be delivered from this page. Please write to " +
      '<a href="mailto:hello@lesnarai.co.ke">hello@lesnarai.co.ke</a> or WhatsApp +254 715 540 653.');
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handler(req, res, deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetch || globalThis.fetch;
  const now = deps.now ? deps.now() : Date.now();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(req, res, 405, { ok: false, error: "method_not_allowed" });
  }
  if (Number(req.headers["content-length"] || 0) > MAX_BODY) return reply(req, res, 413, { ok: false, error: "too_large" });
  if (!sameOrigin(req)) return reply(req, res, 403, { ok: false, error: "foreign_origin" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (clean(body.website, 200)) return reply(req, res, 200, { ok: true });          // honeypot: look delivered, send nothing
  const started = Number(body.t || 0);
  if (started && now - started < MIN_FILL_MS) return reply(req, res, 400, { ok: false, error: "too_fast" });
  if (throttled(client(req), now)) return reply(req, res, 429, { ok: false, error: "too_many" });

  const checked = validate(body);
  if (checked.error) return reply(req, res, 400, { ok: false, error: "invalid", detail: checked.error });

  try {
    const sent = await deliver(checked.value, env, fetchImpl);
    if (sent.ok) {
      console.log("enquiry delivered");
      return reply(req, res, 200, { ok: true });
    }
    console.error("enquiry not delivered:", sent.reason);
    return reply(req, res, 503, { ok: false, error: "delivery_unavailable" });
  } catch (e) {
    console.error("enquiry delivery error:", e && e.name);
    return reply(req, res, 503, { ok: false, error: "delivery_unavailable" });
  }
}

module.exports = handler;
module.exports.handler = handler;
module.exports._test = { validate, compose, hits };
