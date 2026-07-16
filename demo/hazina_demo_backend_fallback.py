"""Hazina Nomads — demo-safe backend adapter.

A self-contained FastAPI app that reproduces the portal's real backend contract
(/healthz, /catalog/businesses/{slug}/hazina, /mock/message, /api/public/orders/{ref})
using MOCK providers and in-memory state. It mirrors the architecture of the
production app (app/channels/mock.py, app/services/order_tracking.py,
app/api/public_orders.py) WITHOUT importing anything that needs real secrets,
databases, WhatsApp/Meta, or payment keys.

Why a separate file: the production backend requires live .env + Postgres + Redis
+ provider keys. For a safe Loom we exercise the same request -> route -> conversation
pipeline -> state change -> tracking-view flow against fake data only.

Run:
    HAZINA_DEMO_PORT=8000 .venv/bin/python demo/hazina_demo_backend.py
or via scripts/run_hazina_demo_safe.sh

Guarantees: no outbound WhatsApp/email/payment calls; no real phone numbers;
in-memory store wiped on restart; CORS limited to the local portal origin.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

SEED_PATH = Path(__file__).resolve().parent / "hazina_demo_seed.json"
SEED = json.loads(SEED_PATH.read_text(encoding="utf-8"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Mock providers (stand-ins for app/channels/whatsapp + app/integrations/payments)
# --------------------------------------------------------------------------- #
class MockWhatsAppProvider:
    """Records 'sent' WhatsApp messages instead of calling Meta. Demo only."""

    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send(self, to: str, body: str) -> dict:
        record = {"to": to, "body": body, "provider": "mock", "sent_at": _now().isoformat()}
        self.sent.append(record)
        return record


class MockPaymentProvider:
    """Creates a fake checkout link and marks it paid. No IntaSend/Paystack call."""

    def create_checkout(self, reference: str, amount_usd: float) -> dict:
        return {
            "provider": "mock",
            "reference": reference,
            "amount_usd": amount_usd,
            "checkout_url": f"https://pay.demo.test/checkout/{reference}",
            "status": "pending",
        }


WHATSAPP = MockWhatsAppProvider()
PAYMENTS = MockPaymentProvider()


# --------------------------------------------------------------------------- #
# In-memory state
# --------------------------------------------------------------------------- #
ORDERS: dict[str, dict] = {}          # reference -> order
ORDER_TOKENS: dict[str, str] = {}     # reference -> token
CONVERSATIONS: dict[str, dict] = {}   # msisdn -> {conversation_id, stage, cart}
LEADS: list[dict] = []                # captured leads/order intents


def _seed_orders() -> None:
    for row in SEED.get("seed_orders", []):
        ref = row["reference"]
        total = sum(line["price_usd"] * line["quantity"] for line in row["lines"])
        ORDERS[ref] = {
            "reference": ref,
            "placed_at": (_now() - timedelta(days=2)).isoformat(),
            "destination": row["destination"],
            "delivery_window": "5–8 business days",
            "lines": row["lines"],
            "total_usd": round(total, 2),
            "total_kes": int(total * 129),
            "payment_status": row.get("payment_status", "paid"),
            "fulfillment_status": row.get("fulfillment_status", "processing"),
            "source": "seed",
        }
        ORDER_TOKENS[ref] = row["token"]


_seed_orders()


def _timeline_for(order: dict) -> list[dict]:
    steps = [
        ("placed", "Order placed", "done"),
        ("paid", "Payment confirmed", "done" if order["payment_status"] == "paid" else "pending"),
        ("packed", "Packed in Nairobi studio",
         "done" if order["fulfillment_status"] in {"packed", "shipped", "delivered"} else "pending"),
        ("shipped", "Handed to courier",
         "done" if order["fulfillment_status"] in {"shipped", "delivered"} else "pending"),
        ("delivered", "Delivered", "done" if order["fulfillment_status"] == "delivered" else "pending"),
    ]
    note = "Courier: demo run — no real shipment." if order["fulfillment_status"] != "delivered" else None
    return [
        {"id": sid, "label": label, "status": status, "courier_note": note if sid == "shipped" else None}
        for sid, label, status in steps
    ]


def _create_order(*, msisdn: str, collection_id: str, destination: str = "Demo City") -> dict:
    coll = next((c for c in SEED["collections"] if c["id"] == collection_id), SEED["collections"][0])
    ref = f"HN-ORD-{secrets.randbelow(90000) + 10000}"
    token = "demo-" + secrets.token_hex(4)
    checkout = PAYMENTS.create_checkout(ref, coll["price_usd"])
    order = {
        "reference": ref,
        "placed_at": _now().isoformat(),
        "destination": destination,
        "delivery_window": "5–8 business days",
        "lines": [{"name": coll["title"], "quantity": 1, "price_usd": coll["price_usd"]}],
        "total_usd": float(coll["price_usd"]),
        "total_kes": int(coll["price_usd"] * 129),
        "payment_status": "pending",
        "fulfillment_status": "processing",
        "checkout_url": checkout["checkout_url"],
        "source": "whatsapp_demo",
        "customer_msisdn": msisdn,
    }
    ORDERS[ref] = order
    ORDER_TOKENS[ref] = token
    LEADS.append({
        "type": "order_intent",
        "reference": ref,
        "collection": coll["title"],
        "msisdn": msisdn,
        "captured_at": _now().isoformat(),
    })
    return order


# --------------------------------------------------------------------------- #
# Mini conversation router (mirrors app/channels/mock.handle_inbound + AI graph)
# --------------------------------------------------------------------------- #
def _conversation(msisdn: str) -> dict:
    convo = CONVERSATIONS.get(msisdn)
    if convo is None:
        convo = {"conversation_id": str(uuid.uuid4()), "stage": "greeting", "cart": None}
        CONVERSATIONS[msisdn] = convo
    return convo


def _collections_blurb() -> str:
    return " | ".join(f"{c['title']} (${c['price_usd']})" for c in SEED["collections"])


def route_message(msisdn: str, text: str) -> dict:
    """Deterministic intent router. Returns reply + chips + state, like the real graph."""
    convo = _conversation(msisdn)
    lowered = text.lower().strip()
    actions: list[dict] = []
    escalated = False

    track = re.search(r"\bHN-ORD-\d{5}\b", text.upper())

    if track:
        ref = track.group(0)
        order = ORDERS.get(ref)
        if order:
            token = ORDER_TOKENS[ref]
            reply = (f"Order {ref} is '{order['fulfillment_status']}', payment {order['payment_status']}. "
                     f"Track it here: /orders/{ref}?token={token}")
            actions = [{"label": "Open tracking", "value": f"/orders/{ref}?token={token}", "primary": True, "interactive_id": "track"}]
        else:
            reply = f"I couldn't find {ref}. Want to see our collections instead?"
    elif convo["stage"] == "awaiting_collection" or any(c["id"] in lowered or c["title"].lower().split()[0] in lowered for c in SEED["collections"]):
        chosen = next((c for c in SEED["collections"] if c["id"] in lowered or c["title"].lower().split()[0] in lowered), None)
        if chosen:
            order = _create_order(msisdn=msisdn, collection_id=chosen["id"])
            WHATSAPP.send(msisdn, f"Reserved {chosen['title']} — pay at {order['checkout_url']}")
            convo["stage"] = "ordered"
            token = ORDER_TOKENS[order["reference"]]
            reply = (f"Lovely choice — {chosen['title']} (${chosen['price_usd']}). I've created order "
                     f"{order['reference']} and a secure (demo) checkout link. Track anytime: "
                     f"/orders/{order['reference']}?token={token}")
            actions = [
                {"label": "Pay now (demo)", "value": order["checkout_url"], "primary": True, "interactive_id": "pay"},
                {"label": "Track order", "value": f"/orders/{order['reference']}?token={token}", "primary": False, "interactive_id": "track"},
            ]
        else:
            convo["stage"] = "awaiting_collection"
            reply = f"Which box would you like? {_collections_blurb()}"
            actions = [{"label": c["title"], "value": c["id"], "primary": False, "interactive_id": c["id"]} for c in SEED["collections"]]
    elif any(w in lowered for w in ("order", "buy", "checkout", "gift", "purchase")):
        convo["stage"] = "awaiting_collection"
        reply = f"Happy to help you order a gift box! Pick one: {_collections_blurb()}"
        actions = [{"label": c["title"], "value": c["id"], "primary": False, "interactive_id": c["id"]} for c in SEED["collections"]]
    elif any(w in lowered for w in ("collection", "browse", "show", "catalog", "boxes")):
        reply = f"Here are our curated boxes: {_collections_blurb()}. Say 'order' to start one."
        actions = [{"label": "Start an order", "value": "order", "primary": True, "interactive_id": "order"}]
    elif any(w in lowered for w in ("human", "agent", "help", "complaint", "refund")):
        escalated = True
        reply = "I'm connecting you to a Hazina host (demo escalation — no real handoff happens)."
    else:
        reply = ("Karibu to Hazina Nomads! I can show collections, take an order, or track a delivery. "
                 "Try 'show collections' or 'order'.")
        actions = [
            {"label": "Show collections", "value": "collections", "primary": True, "interactive_id": "collections"},
            {"label": "Track an order", "value": "track", "primary": False, "interactive_id": "track"},
        ]

    return {"reply": reply, "conversation_id": convo["conversation_id"], "escalated": escalated, "actions": actions}


# --------------------------------------------------------------------------- #
# FastAPI app
# --------------------------------------------------------------------------- #
app = FastAPI(title="Hazina Demo-Safe Backend", version="demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://127.0.0.1:3004"),
        "http://localhost:3004",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MockMessageIn(BaseModel):
    phone: str = Field(..., examples=["+254700000001"])
    text: str = Field(..., min_length=1, max_length=4000)
    name: Optional[str] = None
    language: Optional[str] = None
    business_id: Optional[str] = None
    business_slug: Optional[str] = None


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "mode": "demo-safe", "providers": "mock", "orders": len(ORDERS)}


@app.get("/catalog/businesses/{slug}/hazina")
def catalog(slug: str) -> dict:
    return {
        "source": "demo_backend",
        "backend_truth": True,
        "brand": {"name": SEED["business"]["brand"], "tagline": SEED["business"]["tagline"]},
        "collections": SEED["collections"],
        "treasures": SEED["treasures"],
        "categories": SEED["categories"],
        "photos": {},
    }


@app.post("/mock/message")
def mock_message(payload: MockMessageIn) -> dict:
    return route_message(payload.phone, payload.text)


@app.get("/api/public/orders/{order_id}")
def public_order(order_id: str, token: str = Query(..., min_length=4, max_length=64)) -> dict:
    ref = order_id.strip()
    order = ORDERS.get(ref)
    if order is None or ORDER_TOKENS.get(ref) != token.strip():
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "reference": order["reference"],
        "placed_at": order["placed_at"],
        "destination": order["destination"],
        "delivery_window": order["delivery_window"],
        "lines": [{"name": l["name"], "quantity": l["quantity"], "price_usd": l["price_usd"]} for l in order["lines"]],
        "total_usd": order["total_usd"],
        "total_kes": order["total_kes"],
        "payment_status": order["payment_status"],
        "fulfillment_status": order["fulfillment_status"],
        "timeline": _timeline_for(order),
    }


# ---- Demo-only operator endpoints (required by the demo spec) -------------- #
class CreateLeadIn(BaseModel):
    phone: str = Field(..., examples=["+254700000050"])
    collection_id: str
    destination: str = "Demo City"


@app.post("/api/demo/leads")
def create_lead(payload: CreateLeadIn) -> dict:
    order = _create_order(msisdn=payload.phone, collection_id=payload.collection_id, destination=payload.destination)
    return {"ok": True, "reference": order["reference"], "token": ORDER_TOKENS[order["reference"]], "order": order}


@app.post("/api/demo/whatsapp/handoff")
def whatsapp_handoff(payload: MockMessageIn) -> dict:
    result = route_message(payload.phone, payload.text)
    return {"ok": True, "handoff": result, "whatsapp_sent": WHATSAPP.sent[-3:]}


@app.get("/api/demo/orders")
def list_orders() -> dict:
    return {
        "count": len(ORDERS),
        "leads": LEADS,
        "orders": [
            {
                "reference": o["reference"], "destination": o["destination"],
                "total_usd": o["total_usd"], "payment_status": o["payment_status"],
                "fulfillment_status": o["fulfillment_status"], "source": o.get("source"),
                "track_token": ORDER_TOKENS[o["reference"]],
            }
            for o in ORDERS.values()
        ],
        "whatsapp_outbox": WHATSAPP.sent,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("HAZINA_DEMO_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
