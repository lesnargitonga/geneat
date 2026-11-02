// Tests for api/enquiry.js: node --test tools/enquiry.test.mjs
// Resend and the Upstash limiter are mocked; no request leaves the machine.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../api/enquiry.js");
const { PER_ADDRESS, PER_SITE } = handler._test;
const ENV = { RESEND_API_KEY: "test-key", ENQUIRY_FROM: "LESNAR AI <enquiries@example.test>", ENQUIRY_TO: "hello@example.test",
              UPSTASH_REDIS_REST_URL: "https://redis.example.test", UPSTASH_REDIS_REST_TOKEN: "redis-token" };
const T0 = 1_800_000_000_000;

function req({ method = "POST", body = {}, headers = {}, ip } = {}) {
  return { method, body, headers: { host: "lesnarai.com", "content-type": "application/json", "x-forwarded-for": ip || "198.51.100.7", ...headers } };
}
function res() {
  const r = { statusCode: 0, headers: {}, body: "" };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = (b) => { r.body = b; };
  r.json = () => JSON.parse(r.body);
  return r;
}
/* One fake Redis shared by every call, as Upstash is shared by every serverless instance. */
function world({ providerStatus = 200, limiterStatus = 200, redis = new Map() } = {}) {
  const sent = [], pipelines = [];
  const fetch = async (url, init) => {
    if (url.endsWith("/pipeline")) {
      pipelines.push(JSON.parse(init.body));
      if (limiterStatus !== 200) return { ok: false, status: limiterStatus, json: async () => ({}) };
      const out = JSON.parse(init.body).map(([cmd, key]) => {
        if (cmd === "INCR") { redis.set(key, (redis.get(key) || 0) + 1); return { result: redis.get(key) }; }
        return { result: 1 };
      });
      return { ok: true, status: 200, json: async () => out };
    }
    sent.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return { ok: providerStatus < 300, status: providerStatus };
  };
  return { fetch, sent, pipelines, redis };
}
const good = (extra = {}) => ({ reply: "client@example.org", wrong: "Stock counts drift every week.", t: T0 - 60_000, ...extra });
const run = async (r, w, env = ENV) => { const out = res(); await handler(r, out, { env, fetch: w.fetch, now: () => T0 }); return out; };

test("a valid enquiry passes the shared limiter and is handed to the provider once", async () => {
  const w = world(); const r = await run(req({ body: good() }), w);
  assert.equal(r.statusCode, 200); assert.deepEqual(r.json(), { ok: true });
  assert.equal(w.pipelines.length, 1); assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].url, "https://api.resend.com/emails");
  assert.equal(w.sent[0].body.reply_to, "client@example.org");
  assert.match(w.sent[0].body.text, /Stock counts drift every week\./);
});

test("the limiter stores a hash of the address, never the address", async () => {
  const w = world(); await run(req({ body: good(), ip: "203.0.113.44" }), w);
  const keys = w.pipelines[0].map((c) => c[1]).join(" ");
  assert.doesNotMatch(keys, /203\.0\.113\.44/); assert.match(keys, /lesnarai:enquiry:\d+:[0-9a-f]{32}/);
});

test("the limit holds across instances: the sixth message from one address in a window is refused", async () => {
  const redis = new Map(); let last; let sent = 0;
  for (let i = 0; i < PER_ADDRESS + 1; i++) {
    const w = world({ redis });                 // a fresh "instance" each time, one shared store
    last = await run(req({ body: good(), ip: "203.0.113.9" }), w); sent += w.sent.length;
  }
  assert.equal(last.statusCode, 429); assert.equal(sent, PER_ADDRESS);
});

test("the site-wide ceiling applies across addresses", async () => {
  const redis = new Map(); let last;
  for (let i = 0; i < PER_SITE + 1; i++) last = await run(req({ body: good(), ip: `10.1.${Math.floor(i / 250)}.${i % 250}` }), world({ redis }));
  assert.equal(last.statusCode, 429);
});

test("without a shared limiter nothing is sent (fail closed)", async () => {
  const w = world(); const env = { ...ENV }; delete env.UPSTASH_REDIS_REST_URL; delete env.UPSTASH_REDIS_REST_TOKEN;
  const r = await run(req({ body: good() }), w, env);
  assert.equal(r.statusCode, 503); assert.equal(w.sent.length, 0);
});

test("a limiter failure sends nothing", async () => {
  const w = world({ limiterStatus: 500 }); const r = await run(req({ body: good() }), w);
  assert.equal(r.statusCode, 503); assert.equal(w.sent.length, 0);
});

test("a phone number is accepted and no reply-to is set", async () => {
  const w = world(); const r = await run(req({ body: good({ reply: "+254 700 000 000" }) }), w);
  assert.equal(r.statusCode, 200); assert.equal(w.sent[0].body.reply_to, undefined);
});

test("missing or malformed reply is rejected before the limiter and without sending", async () => {
  for (const reply of ["", "not a contact", "a@b"]) {
    const w = world(); const r = await run(req({ body: good({ reply }) }), w);
    assert.equal(r.statusCode, 400, reply); assert.equal(w.sent.length, 0); assert.equal(w.pipelines.length, 0);
  }
});

test("over-long fields are rejected", async () => {
  const w = world(); const r = await run(req({ body: good({ wrong: "x".repeat(2001) }) }), w);
  assert.equal(r.statusCode, 400); assert.equal(w.sent.length, 0);
});

test("the honeypot looks delivered but sends nothing", async () => {
  const w = world(); const r = await run(req({ body: good({ website: "http://spam.example" }) }), w);
  assert.equal(r.statusCode, 200); assert.equal(w.sent.length, 0); assert.equal(w.pipelines.length, 0);
});

test("a form filled faster than a person can is rejected", async () => {
  const w = world(); const r = await run(req({ body: good({ t: T0 - 500 }) }), w);
  assert.equal(r.statusCode, 400); assert.equal(w.sent.length, 0);
});

test("only POST is allowed", async () => {
  const r = await run(req({ method: "GET" }), world());
  assert.equal(r.statusCode, 405); assert.equal(r.headers.allow, "POST");
});

test("a foreign origin is refused", async () => {
  const w = world(); const r = await run(req({ body: good(), headers: { origin: "https://evil.example" } }), w);
  assert.equal(r.statusCode, 403); assert.equal(w.sent.length, 0);
});

test("an oversized body is refused before parsing", async () => {
  const r = await run(req({ body: good(), headers: { "content-length": "999999" } }), world());
  assert.equal(r.statusCode, 413);
});

test("a provider refusal is reported as not delivered", async () => {
  const r = await run(req({ body: good() }), world({ providerStatus: 422 }));
  assert.equal(r.statusCode, 503); assert.deepEqual(r.json(), { ok: false, error: "delivery_unavailable" });
});

test("a network failure is reported as not delivered", async () => {
  const out = res();
  await handler(req({ body: good() }), out, { env: ENV, now: () => T0, fetch: async (u) => { if (u.endsWith("/pipeline")) return { ok: true, status: 200, json: async () => [{ result: 1 }, { result: 1 }, { result: 1 }, { result: 1 }] }; throw new TypeError("network"); } });
  assert.equal(out.statusCode, 503);
});

const FORM = { "content-type": "application/x-www-form-urlencoded" };

test("without script, success is a page that says sent", async () => {
  const r = await run(req({ body: { reply: "client@example.org" }, headers: FORM }), world());
  assert.equal(r.statusCode, 200); assert.match(r.headers["content-type"], /text\/html/); assert.match(r.body, /Message sent/);
});

test("without script, a failure gives the message back: a form to send again, and email and WhatsApp", async () => {
  const env = { ...ENV, RESEND_API_KEY: "" };
  const r = await run(req({ body: { reply: "client@example.org", wrong: "Stock counts drift every week." }, headers: FORM }), world(), env);
  assert.equal(r.statusCode, 503); assert.match(r.body, /Not sent/);
  assert.match(r.body, /<form method="post" action="\/api\/enquiry">/);
  assert.match(r.body, /value="client@example\.org"/);
  assert.match(r.body, />Stock counts drift every week\.<\/textarea>/);
  assert.match(r.body, /href="mailto:hello@lesnarai\.co\.ke\?subject=Project%20enquiry&amp;body=[^"]*Stock%20counts/);
  assert.match(r.body, /href="https:\/\/wa\.me\/254715540653\?text=[^"]*Stock%20counts/);
});

test("without script, an invalid reply is explained and the rest of the message kept", async () => {
  const r = await run(req({ body: { reply: "nope", wrong: "Keep this" }, headers: FORM }), world());
  assert.equal(r.statusCode, 400); assert.match(r.body, /email address or a phone number/); assert.match(r.body, />Keep this<\/textarea>/);
});

test("everything the visitor wrote is escaped in the recovery page", async () => {
  const env = { ...ENV, RESEND_API_KEY: "" };
  const r = await run(req({ body: { reply: "client@example.org", wrong: '<script>alert(1)</script>"><img src=x onerror=alert(2)>' }, headers: FORM }), world(), env);
  assert.doesNotMatch(r.body, /<script>alert/); assert.doesNotMatch(r.body, /<img src=x/);
  assert.match(r.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;&gt;&lt;img/);
});

test("control characters are stripped from the message", async () => {
  const w = world(); await run(req({ body: good({ wrong: "line\u0007one\r\nline two" }) }), w);
  assert.match(w.sent[0].body.text, /lineone\nline two/);
});
