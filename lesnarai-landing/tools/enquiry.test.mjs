// Tests for api/enquiry.js: node --test tools/enquiry.test.mjs
// The provider is mocked; no request leaves the machine.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../api/enquiry.js");
const ENV = { RESEND_API_KEY: "test-key", ENQUIRY_FROM: "LESNAR AI <enquiries@example.test>", ENQUIRY_TO: "hello@example.test" };
const T0 = 1_800_000_000_000;

function req({ method = "POST", body = {}, headers = {}, ip } = {}) {
  return { method, body, headers: { host: "lesnarai.com", "content-type": "application/json", "x-forwarded-for": ip || `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers } };
}
function res() {
  const r = { statusCode: 0, headers: {}, body: "" };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = (b) => { r.body = b; };
  r.json = () => JSON.parse(r.body);
  return r;
}
function provider(status = 200) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init: { ...init, body: JSON.parse(init.body) } }); return { ok: status < 300, status }; };
  return { fetch, calls };
}
const good = (extra = {}) => ({ reply: "client@example.org", wrong: "Stock counts drift every week.", t: T0 - 60_000, ...extra });

test("a valid enquiry is delivered once, with reply-to set", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good() }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 200); assert.deepEqual(r.json(), { ok: true });
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].url, "https://api.resend.com/emails");
  assert.equal(p.calls[0].init.body.reply_to, "client@example.org");
  assert.match(p.calls[0].init.body.text, /Stock counts drift every week\./);
  assert.equal(p.calls[0].init.headers.Authorization, "Bearer test-key");
});

test("a phone number is accepted and no reply-to is set", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good({ reply: "+254 700 000 000" }) }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 200); assert.equal(p.calls[0].init.body.reply_to, undefined);
});

test("missing or malformed reply is rejected without sending", async () => {
  for (const reply of ["", "not a contact", "a@b"]) {
    const p = provider(); const r = res();
    await handler(req({ body: good({ reply }) }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
    assert.equal(r.statusCode, 400, reply); assert.equal(p.calls.length, 0);
  }
});

test("over-long fields are rejected", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good({ wrong: "x".repeat(2001) }) }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 400); assert.equal(p.calls.length, 0);
});

test("the honeypot looks delivered but sends nothing", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good({ website: "http://spam.example" }) }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 200); assert.equal(p.calls.length, 0);
});

test("a form filled faster than a person can is rejected", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good({ t: T0 - 500 }) }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 400); assert.equal(p.calls.length, 0);
});

test("only POST is allowed", async () => {
  const r = res();
  await handler(req({ method: "GET" }), r, { env: ENV, fetch: provider().fetch, now: () => T0 });
  assert.equal(r.statusCode, 405); assert.equal(r.headers.allow, "POST");
});

test("a foreign origin is refused", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good(), headers: { origin: "https://evil.example" } }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 403); assert.equal(p.calls.length, 0);
});

test("an oversized body is refused before parsing", async () => {
  const r = res();
  await handler(req({ body: good(), headers: { "content-length": "999999" } }), r, { env: ENV, fetch: provider().fetch, now: () => T0 });
  assert.equal(r.statusCode, 413);
});

test("the sixth message in an hour from one address is throttled", async () => {
  const p = provider(); let last;
  for (let i = 0; i < 6; i++) { last = res(); await handler(req({ body: good(), ip: "203.0.113.9" }), last, { env: ENV, fetch: p.fetch, now: () => T0 + i }); }
  assert.equal(last.statusCode, 429); assert.equal(p.calls.length, 5);
});

test("without configuration nothing claims success", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good() }), r, { env: {}, fetch: p.fetch, now: () => T0 });
  assert.equal(r.statusCode, 503); assert.equal(p.calls.length, 0);
});

test("a provider refusal is reported as not delivered", async () => {
  const r = res();
  await handler(req({ body: good() }), r, { env: ENV, fetch: provider(422).fetch, now: () => T0 });
  assert.equal(r.statusCode, 503); assert.deepEqual(r.json(), { ok: false, error: "delivery_unavailable" });
});

test("a network failure is reported as not delivered", async () => {
  const r = res();
  await handler(req({ body: good() }), r, { env: ENV, fetch: async () => { throw new TypeError("network"); }, now: () => T0 });
  assert.equal(r.statusCode, 503);
});

test("a form post without script gets an HTML page either way", async () => {
  const ok = res();
  await handler(req({ body: { reply: "client@example.org" }, headers: { "content-type": "application/x-www-form-urlencoded" } }), ok, { env: ENV, fetch: provider().fetch, now: () => T0 });
  assert.equal(ok.statusCode, 200); assert.match(ok.headers["content-type"], /text\/html/); assert.match(ok.body, /Message sent/);
  const no = res();
  await handler(req({ body: { reply: "client@example.org" }, headers: { "content-type": "application/x-www-form-urlencoded" } }), no, { env: {}, fetch: provider().fetch, now: () => T0 });
  assert.equal(no.statusCode, 503); assert.match(no.body, /Not sent/);
});

test("control characters are stripped from the message", async () => {
  const p = provider(); const r = res();
  await handler(req({ body: good({ wrong: "line\u0007one\r\nline two" }) }), r, { env: ENV, fetch: p.fetch, now: () => T0 });
  assert.match(p.calls[0].init.body.text, /lineone\nline two/);
});
