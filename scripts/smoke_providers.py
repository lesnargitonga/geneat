"""Live smoke test for all external providers using current .env keys."""
import os, sys, json, asyncio, traceback
from dotenv import load_dotenv

load_dotenv()

results = {}

def ok(name, detail=""):
    results[name] = ("OK", detail)
    print(f"[OK]   {name}: {detail}")

def fail(name, err):
    results[name] = ("FAIL", str(err))
    print(f"[FAIL] {name}: {err}")


# 1) OpenAI ─ list models (cheap GET)
try:
    import httpx
    r = httpx.get(
        "https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        timeout=15,
    )
    if r.status_code == 200:
        n = len(r.json().get("data", []))
        ok("OpenAI", f"{n} models reachable")
    else:
        fail("OpenAI", f"HTTP {r.status_code} {r.text[:120]}")
except Exception as e:
    fail("OpenAI", e)

# 2) ElevenLabs ─ list voices
try:
    r = httpx.get(
        "https://api.elevenlabs.io/v1/voices",
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
        timeout=15,
    )
    if r.status_code == 200:
        n = len(r.json().get("voices", []))
        ok("ElevenLabs", f"{n} voices reachable")
    else:
        fail("ElevenLabs", f"HTTP {r.status_code} {r.text[:120]}")
except Exception as e:
    fail("ElevenLabs", e)

# 3) Meta WhatsApp ─ phone-number GET
try:
    pid = os.environ["META_WA_PHONE_NUMBER_ID"]
    tok = os.environ["META_WA_ACCESS_TOKEN"]
    r = httpx.get(
        f"https://graph.facebook.com/v20.0/{pid}",
        params={"access_token": tok},
        timeout=15,
    )
    if r.status_code == 200:
        j = r.json()
        ok("Meta WA", f"phone={j.get('display_phone_number')} verified={j.get('verified_name')}")
    else:
        fail("Meta WA", f"HTTP {r.status_code} {r.text[:200]}")
except Exception as e:
    fail("Meta WA", e)

# 4) IntaSend ─ tiny KES 1 STK push to a *dummy* number (will return validation
# error if the key is wrong, success-shape if it's good).
# We just probe auth: POST checkout with bad phone — expect 4xx but with a
# response body proving the API token was accepted.
try:
    tok = os.environ["INTASEND_API_TOKEN"]
    is_test = os.environ.get("INTASEND_TEST_MODE", "false").lower() == "true"
    base = "https://sandbox.intasend.com" if is_test else "https://payment.intasend.com"
    r = httpx.post(
        f"{base}/api/v1/payment/mpesa-stk-push/",
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        json={"amount": 1, "phone_number": "254700000000", "api_ref": "smoke", "narrative": "ping"},
        timeout=20,
    )
    body = r.text[:250]
    if r.status_code in (200, 201):
        ok("IntaSend", f"auth+STK ok HTTP {r.status_code}")
    elif r.status_code in (400, 422):
        # Validation error → auth was accepted, payload was rejected → key works
        ok("IntaSend", f"auth ok (validation HTTP {r.status_code}) → key live")
    elif r.status_code in (401, 403):
        fail("IntaSend", f"AUTH REJECTED HTTP {r.status_code}: {body}")
    else:
        fail("IntaSend", f"HTTP {r.status_code}: {body}")
except Exception as e:
    fail("IntaSend", e)

# 5) Twilio ─ verify SID/token by GET account
try:
    sid = os.environ["TWILIO_ACCOUNT_SID"]
    tok = os.environ["TWILIO_AUTH_TOKEN"]
    r = httpx.get(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json",
        auth=(sid, tok),
        timeout=15,
    )
    if r.status_code == 200:
        j = r.json()
        ok("Twilio", f"account status={j.get('status')} type={j.get('type')}")
    else:
        fail("Twilio", f"HTTP {r.status_code} {r.text[:120]}")
except Exception as e:
    fail("Twilio", e)

# Summary
print("\n=== SUMMARY ===")
for k, (s, d) in results.items():
    print(f"{s:5s}  {k:12s}  {d}")

sys.exit(0 if all(v[0] == "OK" for v in results.values()) else 1)
