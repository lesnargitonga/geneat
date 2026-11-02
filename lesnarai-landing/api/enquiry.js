/* Project enquiries from /start/.
 *
 * POST /api/enquiry with JSON (script) or a urlencoded form (no script).
 * Delivers one email through Resend to ENQUIRY_TO. Nothing is stored here: the email is the record,
 * and logs carry status codes only, never the message or the sender.
 *
 * Environment (set in the Vercel project, never in the repository):
 *   RESEND_API_KEY  Resend API key, restricted to sending
 *   ENQUIRY_FROM    verified sender, e.g. "LESNAR AI <enquiries@lesnarai.co.ke>"
 *   ENQUIRY_TO      where enquiries go, e.g. hello@lesnarai.co.ke
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL / KV_REST_API_TOKEN)
 *                   shared rate limiter. It is required: without it nothing is sent (fail closed).
 *
 * Responses (JSON): 200 {ok:true} only after the provider accepted the email; 400 invalid input;
 * 405 wrong method; 413 too large; 403 foreign origin; 429 too many; 503 delivery not configured or
 * the provider refused. The page treats anything but 200 as "not delivered" and offers email and
 * WhatsApp with the message preserved. A form post without script gets an HTML page; on any failure
 * that page gives the visitor's own words back, in a prefilled form and in email and WhatsApp links.
 */
"use strict";

const crypto = require("crypto");

const FIELDS = {
  reply: { label: "Reach me at", max: 200, required: true },
  wrong: { label: "What is going wrong now, and for whom", max: 2000 },
  fail: { label: "The one failure that would matter most", max: 2000 },
  exists: { label: "What already exists", max: 2000 },
  known: { label: "How I would know it had worked", max: 2000 },
};
const MAX_BODY = 12 * 1024;
const MIN_FILL_MS = 2500;            // faster than a person can fill the form
const WINDOW_S = 60 * 60;            // shared throttle window
const PER_ADDRESS = 5;               // enquiries per address per window
const PER_SITE = 60;                 // enquiries per window across the whole site, a cost and abuse ceiling
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

function client(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || "unknown";
}

/* Shared fixed-window counters in Redis (Upstash REST), so every serverless instance sees the same
   counts. Addresses are stored only as a hash, and keys expire with the window. */
function limiterConfig(env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function throttled(ip, env, fetchImpl, nowMs) {
  const cfg = limiterConfig(env);
  if (!cfg) return { error: "limiter_not_configured" };
  const window = Math.floor(nowMs / 1000 / WINDOW_S);
  const addr = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const kAddr = `lesnarai:enquiry:${window}:${addr}`;
  const kSite = `lesnarai:enquiry:${window}:all`;
  const r = await fetchImpl(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", kAddr], ["EXPIRE", kAddr, String(WINDOW_S)], ["INCR", kSite], ["EXPIRE", kSite, String(WINDOW_S)]]),
  });
  if (!r.ok) return { error: `limiter_${r.status}` };
  const out = await r.json();
  const nAddr = Number(out && out[0] && out[0].result);
  const nSite = Number(out && out[2] && out[2].result);
  if (!Number.isFinite(nAddr) || !Number.isFinite(nSite)) return { error: "limiter_bad_reply" };
  return { limited: nAddr > PER_ADDRESS || nSite > PER_SITE };
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

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function page(res, status, title, inner) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${esc(title)} · LESNAR AI</title></head>` +
    `<body style="font:17px/1.55 system-ui,sans-serif;max-width:40rem;margin:8vh auto;padding:0 20px">` +
    `<h1 style="font-size:28px">${esc(title)}</h1>${inner}<p><a href="/start/">Back to Start</a></p></body></html>`);
}

/* Without script, a failed post must not lose what the visitor wrote: give it back as a form to send
   again, and as email and WhatsApp links that carry it. Every value is escaped. */
function recovery(fields, why) {
  const body = compose(fields);
  const mail = "mailto:hello@lesnarai.co.ke?subject=" + encodeURIComponent("Project enquiry") + "&body=" + encodeURIComponent(body);
  const wa = "https://wa.me/254715540653?text=" + encodeURIComponent(body);
  const inputs = Object.entries(FIELDS).map(([key, spec]) => key === "reply"
    ? `<p><label for="r-${key}"><b>${esc(spec.label)}</b></label><br><input id="r-${key}" name="${key}" value="${esc(fields[key])}" required style="width:100%;font:inherit;padding:8px"></p>`
    : `<p><label for="r-${key}">${esc(spec.label)}</label><br><textarea id="r-${key}" name="${key}" rows="3" style="width:100%;font:inherit;padding:8px">${esc(fields[key])}</textarea></p>`).join("");
  return `<p>${why} Your message is below, unchanged.</p>` +
    `<form method="post" action="/api/enquiry">${inputs}<p><button type="submit" style="font:inherit;font-weight:700;padding:10px 18px">Send again</button></p></form>` +
    `<p>Or send it another way: <a href="${esc(mail)}">by email</a> or <a href="${esc(wa)}">on WhatsApp</a>.</p>`;
}

function reply(req, res, status, payload, fields) {
  const wantsHtml = String(req.headers["content-type"] || "").includes("application/x-www-form-urlencoded");
  if (wantsHtml) {
    if (payload.ok) return page(res, 200, "Message sent", "<p>Thank you. Your message reached LESNAR AI, and we will reply to the address you gave.</p>");
    const why = payload.error === "invalid" ? "Please give an email address or a phone number we can reply to."
      : payload.error === "too_many" ? "Too many messages have been sent from here in the last hour. Please try again later."
      : "Your message could not be sent from this page just now.";
    return page(res, status, "Not sent", recovery(fields || {}, why));
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
  const raw = Object.fromEntries(Object.entries(FIELDS).map(([k, spec]) => [k, clean(body[k], spec.max)]));
  if (clean(body.website, 200)) return reply(req, res, 200, { ok: true });          // honeypot: look delivered, send nothing
  const started = Number(body.t || 0);
  if (started && now - started < MIN_FILL_MS) return reply(req, res, 400, { ok: false, error: "too_fast" }, raw);

  const checked = validate(body);
  if (checked.error) return reply(req, res, 400, { ok: false, error: "invalid", detail: checked.error }, raw);

  try {
    const limit = await throttled(client(req), env, fetchImpl, now);
    if (limit.error) {
      console.error("enquiry not sent:", limit.error);
      return reply(req, res, 503, { ok: false, error: "delivery_unavailable" }, raw);
    }
    if (limit.limited) return reply(req, res, 429, { ok: false, error: "too_many" }, raw);
    const sent = await deliver(checked.value, env, fetchImpl);
    if (sent.ok) {
      console.log("enquiry accepted by provider");
      return reply(req, res, 200, { ok: true });
    }
    console.error("enquiry not delivered:", sent.reason);
    return reply(req, res, 503, { ok: false, error: "delivery_unavailable" }, raw);
  } catch (e) {
    console.error("enquiry delivery error:", e && e.name);
    return reply(req, res, 503, { ok: false, error: "delivery_unavailable" }, raw);
  }
}

module.exports = handler;
module.exports.handler = handler;
module.exports._test = { validate, compose, esc, PER_ADDRESS, PER_SITE };
