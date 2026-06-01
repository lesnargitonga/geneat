"""Live smoke test for external provider credentials.

The script is careful with redacted local env files. A value such as
REDACTED_ROTATE is reported as SKIP instead of being sent to a provider and
mistaken for a real production outage.

To make skipped providers fail CI/operator checks, set:

    SMOKE_REQUIRED_PROVIDERS=openai,meta,intasend,paystack,twilio,daraja
"""
from __future__ import annotations

import os
import sys
from typing import Callable

import httpx
from dotenv import load_dotenv

load_dotenv()

PLACEHOLDERS = {
    "",
    "REDACTED_ROTATE",
    "CHANGE_ME",
    "change-me",
    "changeme",
    "replace-me",
    "__SET_FROM_RENDER_POSTGRES__",
    "__SET_FROM_RENDER_KEY_VALUE__",
}

required = {
    p.strip().lower()
    for p in os.getenv("SMOKE_REQUIRED_PROVIDERS", "").split(",")
    if p.strip()
}
results: dict[str, tuple[str, str]] = {}


def _value(name: str) -> str:
    return (os.getenv(name) or "").strip()


def configured(*names: str) -> bool:
    return all(_value(name) and _value(name) not in PLACEHOLDERS for name in names)


def ok(name: str, detail: str = "") -> None:
    results[name] = ("OK", detail)
    print(f"[OK]   {name}: {detail}")


def skip(name: str, detail: str) -> None:
    status = "FAIL" if name.lower() in required else "SKIP"
    results[name] = (status, detail)
    print(f"[{status}] {name}: {detail}")


def fail(name: str, err: object) -> None:
    results[name] = ("FAIL", str(err))
    print(f"[FAIL] {name}: {err}")


def run(name: str, required_keys: tuple[str, ...], probe: Callable[[], None]) -> None:
    if not configured(*required_keys):
        skip(name, "missing or placeholder env keys: " + ", ".join(required_keys))
        return
    try:
        probe()
    except Exception as exc:  # noqa: BLE001 - operator smoke script
        fail(name, exc)


def smoke_openai() -> None:
    r = httpx.get(
        "https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {_value('OPENAI_API_KEY')}"},
        timeout=15,
    )
    if r.status_code == 200:
        ok("OpenAI", f"{len(r.json().get('data', []))} models reachable")
    else:
        fail("OpenAI", f"HTTP {r.status_code} {r.text[:160]}")


def smoke_meta() -> None:
    r = httpx.get(
        f"https://graph.facebook.com/v20.0/{_value('META_WA_PHONE_NUMBER_ID')}",
        params={"access_token": _value("META_WA_ACCESS_TOKEN")},
        timeout=15,
    )
    if r.status_code == 200:
        j = r.json()
        ok("Meta WA", f"phone={j.get('display_phone_number')} verified={j.get('verified_name')}")
    else:
        fail("Meta WA", f"HTTP {r.status_code} {r.text[:220]}")


def smoke_intasend() -> None:
    base = "https://sandbox.intasend.com" if _value("INTASEND_TEST_MODE").lower() == "true" else "https://payment.intasend.com"
    r = httpx.post(
        f"{base}/api/v1/payment/mpesa-stk-push/",
        headers={"Authorization": f"Bearer {_value('INTASEND_API_TOKEN')}"},
        json={"amount": 1, "phone_number": "254700000000", "api_ref": "smoke", "narrative": "ping"},
        timeout=20,
    )
    body = r.text[:250]
    if r.status_code in (200, 201):
        ok("IntaSend", f"auth+STK ok HTTP {r.status_code}")
    elif r.status_code in (400, 422):
        ok("IntaSend", f"auth ok; validation HTTP {r.status_code}")
    elif r.status_code in (401, 403):
        fail("IntaSend", f"AUTH REJECTED HTTP {r.status_code}: {body}")
    else:
        fail("IntaSend", f"HTTP {r.status_code}: {body}")


def smoke_paystack() -> None:
    r = httpx.get(
        "https://api.paystack.co/bank",
        headers={"Authorization": f"Bearer {_value('PAYSTACK_SECRET_KEY')}"},
        timeout=15,
    )
    if r.status_code == 200:
        ok("Paystack", "secret key accepted")
    else:
        fail("Paystack", f"HTTP {r.status_code} {r.text[:160]}")


def smoke_twilio() -> None:
    sid = _value("TWILIO_ACCOUNT_SID")
    r = httpx.get(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json",
        auth=(sid, _value("TWILIO_AUTH_TOKEN")),
        timeout=15,
    )
    if r.status_code == 200:
        j = r.json()
        ok("Twilio", f"account status={j.get('status')} type={j.get('type')}")
    else:
        fail("Twilio", f"HTTP {r.status_code} {r.text[:160]}")


def smoke_daraja() -> None:
    base = (
        "https://api.safaricom.co.ke"
        if _value("MPESA_ENV").lower() == "production"
        else "https://sandbox.safaricom.co.ke"
    )
    r = httpx.get(
        f"{base}/oauth/v1/generate",
        params={"grant_type": "client_credentials"},
        auth=(_value("MPESA_CONSUMER_KEY"), _value("MPESA_CONSUMER_SECRET")),
        timeout=15,
    )
    if r.status_code == 200 and r.json().get("access_token"):
        ok("Daraja", "consumer key/secret accepted")
    else:
        fail("Daraja", f"HTTP {r.status_code} {r.text[:160]}")


run("OpenAI", ("OPENAI_API_KEY",), smoke_openai)
run("Meta WA", ("META_WA_PHONE_NUMBER_ID", "META_WA_ACCESS_TOKEN"), smoke_meta)
run("IntaSend", ("INTASEND_API_TOKEN",), smoke_intasend)
run("Paystack", ("PAYSTACK_SECRET_KEY",), smoke_paystack)
run("Twilio", ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"), smoke_twilio)
run("Daraja", ("MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET"), smoke_daraja)

print("\n=== SUMMARY ===")
for provider, (status, detail) in results.items():
    print(f"{status:5s}  {provider:12s}  {detail}")

sys.exit(0 if all(status in {"OK", "SKIP"} for status, _ in results.values()) else 1)
