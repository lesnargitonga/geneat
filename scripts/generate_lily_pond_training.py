"""Generate Lily Pond golden-path SFT examples.

The output is JSONL in OpenAI chat fine-tuning style: one complete training
object per line. It is deliberately synthetic and should be treated as
golden-path behavior guidance, not as a replacement for real conversation
logs or evals.

Examples:

    ./.venv/bin/python scripts/generate_lily_pond_training.py
    ./.venv/bin/python scripts/generate_lily_pond_training.py --examples 100 --seed 42
    ./.venv/bin/python scripts/generate_lily_pond_training.py --sample 2
"""
from __future__ import annotations

import argparse
import json
import random
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


CAFE_NAME = "Lily Pond Cafe"
ASSISTANT_NAME = "Asha"
SYSTEM_PROMPT = (
    f"You are {ASSISTANT_NAME}, Gen-Eat's WhatsApp ordering assistant at {CAFE_NAME}. "
    "Sound warm, brief, and natural. Quote only menu-backed prices. Use tools for "
    "knowledge lookup, photos, order creation, customer names, and M-Pesa STK. "
    "Never say paid, confirmed, pickup ready, or ready by a time until payment has landed."
)
DEFAULT_OUTPUT = Path("lily_pond_training_v1.jsonl")
DEFAULT_EXAMPLES = 50
DEFAULT_SEED = 20260524
DEMO_MSISDN = "+254700000001"


@dataclass(frozen=True)
class MenuItem:
    name: str
    price: int
    aliases: tuple[str, ...] = ()
    category: str = "menu"


# Keep this aligned with scripts/seed_geneat_demo.py for lily-pond-cafe.
MENU_ITEMS: tuple[MenuItem, ...] = (
    MenuItem("Demo Espresso", 10, ("10 bob demo espresso", "demo order"), "demo"),
    MenuItem("Espresso", 120, ("single espresso",), "coffee"),
    MenuItem("Double Espresso", 160, ("double",), "coffee"),
    MenuItem("Flat White", 220, ("flatwhite",), "coffee"),
    MenuItem("Cappuccino", 220, (), "coffee"),
    MenuItem("Latte", 220, (), "coffee"),
    MenuItem("Cold Brew", 250, (), "coffee"),
    MenuItem("Mocha", 280, (), "coffee"),
    MenuItem("Avocado Toast on Sourdough", 450, ("avocado toast", "avo toast"), "breakfast"),
    MenuItem("Mandazi & Masala Chai", 230, ("mandazi", "masala chai", "mandazi and chai"), "breakfast"),
    MenuItem("Big Pond Plate", 620, (), "breakfast"),
    MenuItem("Coconut Granola Bowl", 380, ("granola",), "breakfast"),
    MenuItem("Pancake Stack", 420, ("pancakes",), "breakfast"),
    MenuItem("Chicken Caesar Wrap", 480, ("caesar wrap",), "lunch"),
    MenuItem("Halloumi & Avo Bowl", 520, ("halloumi bowl",), "lunch"),
    MenuItem("Sukuma & Coconut Curry", 420, ("coconut curry", "sukuma curry"), "lunch"),
    MenuItem("Sweet Potato Fries", 250, (), "lunch"),
    MenuItem("Soup of the day", 280, ("soup",), "lunch"),
    MenuItem("Butter Croissant", 180, ("croissant",), "pastry"),
    MenuItem("Pain au Chocolat", 220, ("chocolate pastry",), "pastry"),
    MenuItem("Almond Croissant", 250, (), "pastry"),
    MenuItem("Banana-Cardamom Loaf", 220, ("banana loaf",), "pastry"),
    MenuItem("Chocolate Brownie", 200, ("brownie",), "pastry"),
    MenuItem("Lemon Tart", 240, (), "pastry"),
)


SHENG_GREETINGS = ("Niaje", "Sasa", "Mambo", "Vipi", "Oya", "Habari")
BUY_INTENTS = ("I want", "Nataka", "Nipe", "Can I get", "I'd like to order", "Let me get")
PRICE_INTENTS = ("How much is", "Bei ya", "What is the price of", "Ni how much for")
PHOTO_INTENTS = ("Send me a pic of", "Show me", "Naweza ona", "Do you have a photo of")
CUSTOMER_NAMES = ("Lesnar", "Aisha", "Brian", "Njeri", "Kevin", "Wanjiku", "Imani")
PICKUP_HINTS = ("before class", "in 10 minutes", "after my lecture", "now", "at the counter")


TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "knowledge_lookup",
            "description": "Search Lily Pond's menu, prices, hours, and policies.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "k": {"type": "integer", "minimum": 1, "maximum": 10},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_customer_name",
            "description": "Save the customer's first name.",
            "parameters": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": "Create an order once items and prices are settled.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "sku_or_name": {"type": "string"},
                                "qty": {"type": "integer", "minimum": 1},
                                "unit_price": {"type": "number"},
                            },
                            "required": ["sku_or_name", "qty", "unit_price"],
                            "additionalProperties": False,
                        },
                    },
                    "delivery_notes": {"type": ["string", "null"]},
                    "appointment_time_iso": {"type": ["string", "null"]},
                },
                "required": ["items"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_mpesa_payment",
            "description": "Trigger an M-Pesa STK push for a pending order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount_kes": {"type": "number"},
                    "order_reference": {"type": "string"},
                    "msisdn": {"type": "string"},
                },
                "required": ["amount_kes", "order_reference", "msisdn"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_menu_photo",
            "description": "Send a real menu-item photo over WhatsApp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item": {"type": "string"},
                    "caption": {"type": ["string", "null"]},
                },
                "required": ["item"],
                "additionalProperties": False,
            },
        },
    },
]


def _call_id() -> str:
    return f"call_{uuid.uuid4().hex[:8]}"


def _order_id() -> str:
    return str(uuid.uuid4())


def _args(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def _tool_call(call_id: str, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": _args(arguments)},
    }


def _tool_msg(call_id: str, name: str, content: dict[str, Any] | str) -> dict[str, Any]:
    if not isinstance(content, str):
        content = json.dumps(content, separators=(",", ":"), ensure_ascii=False)
    return {"role": "tool", "tool_call_id": call_id, "name": name, "content": content}


def _assistant_tool(name: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str]:
    call_id = _call_id()
    return {"role": "assistant", "tool_calls": [_tool_call(call_id, name, arguments)]}, call_id


def _base(messages: list[dict[str, Any]], *, include_tools: bool) -> dict[str, Any]:
    obj: dict[str, Any] = {"messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages]}
    if include_tools:
        obj["tools"] = TOOL_SCHEMAS
        obj["parallel_tool_calls"] = False
    return obj


def _display_item(rng: random.Random, item: MenuItem) -> str:
    choices = (item.name, *item.aliases)
    return rng.choice(choices).lower()


def generate_price_check(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    item = rng.choice(MENU_ITEMS)
    greeting = rng.choice(SHENG_GREETINGS)
    question = rng.choice(PRICE_INTENTS)
    assistant, call_id = _assistant_tool(
        "knowledge_lookup",
        {"query": f"{item.name} price", "k": 3},
    )
    messages = [
        {"role": "user", "content": f"{greeting}, {question} {_display_item(rng, item)}?"},
        assistant,
        _tool_msg(call_id, "knowledge_lookup", f"{item.name} is KES {item.price}."),
        {"role": "assistant", "content": f"{item.name} is KES {item.price}. Want me to set one up for pickup?"},
    ]
    return _base(messages, include_tools=include_tools)


def generate_availability_check(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    category = rng.choice(("pastry", "coffee", "breakfast", "lunch"))
    items = [item for item in MENU_ITEMS if item.category == category]
    item = rng.choice(items)
    assistant, call_id = _assistant_tool(
        "knowledge_lookup",
        {"query": f"{item.name} availability price", "k": 4},
    )
    messages = [
        {"role": "user", "content": f"Do you have {_display_item(rng, item)} today?"},
        assistant,
        _tool_msg(call_id, "knowledge_lookup", f"{item.name} is available at KES {item.price}."),
        {"role": "assistant", "content": f"Yes, we have {item.name} today at KES {item.price}. Want one?"},
    ]
    return _base(messages, include_tools=include_tools)


def generate_budget_recommendation(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    budget = rng.choice((200, 250, 300, 500))
    picks = [item for item in MENU_ITEMS if item.price <= budget and item.category != "demo"]
    rng.shuffle(picks)
    picks = picks[:3]
    assistant, call_id = _assistant_tool(
        "knowledge_lookup",
        {"query": f"menu items under KES {budget}", "k": 5},
    )
    options = ", ".join(f"{item.name} KES {item.price}" for item in picks)
    messages = [
        {"role": "user", "content": f"Niaje, what's good under {budget} bob?"},
        assistant,
        _tool_msg(call_id, "knowledge_lookup", options),
        {"role": "assistant", "content": f"Good picks under KES {budget}: {options}. Want me to order one of those?"},
    ]
    return _base(messages, include_tools=include_tools)


def generate_order_and_pay(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    item = rng.choice(MENU_ITEMS)
    name = rng.choice(CUSTOMER_NAMES)
    greeting = rng.choice(SHENG_GREETINGS)
    intent = rng.choice(BUY_INTENTS)
    qty = rng.choice((1, 1, 1, 2))
    total = item.price * qty
    order_id = _order_id()
    order_ref = order_id[:8]

    name_call, name_call_id = _assistant_tool("update_customer_name", {"name": name})
    order_call, order_call_id = _assistant_tool(
        "create_order",
        {
            "items": [{"sku_or_name": item.name, "qty": qty, "unit_price": item.price}],
            "delivery_notes": rng.choice(PICKUP_HINTS),
        },
    )
    pay_call, pay_call_id = _assistant_tool(
        "request_mpesa_payment",
        {"amount_kes": total, "order_reference": order_ref, "msisdn": DEMO_MSISDN},
    )

    messages = [
        {"role": "user", "content": f"{greeting}, my name is {name}. {intent} {qty} {_display_item(rng, item)}."},
        name_call,
        _tool_msg(name_call_id, "update_customer_name", {"ok": True, "name": name}),
        order_call,
        _tool_msg(
            order_call_id,
            "create_order",
            {
                "ok": True,
                "order_id": order_id,
                "amount_kes": total,
                "payment_status": "pending",
            },
        ),
        pay_call,
        _tool_msg(
            pay_call_id,
            "request_mpesa_payment",
            {
                "ok": True,
                "provider": "intasend",
                "amount_kes": total,
                "checkout_request_id": f"INV-{order_ref}",
                "message": "STK push sent.",
            },
        ),
        {
            "role": "assistant",
            "content": (
                f"Got it, {name} - {qty} x {item.name} = KES {total}. "
                "I sent the M-Pesa STK prompt to your phone. Enter your PIN; "
                "I'll send the receipt and pickup timing once payment lands."
            ),
        },
    ]
    return _base(messages, include_tools=include_tools)


def generate_order_missing_name(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    item = rng.choice(MENU_ITEMS)
    name = rng.choice(CUSTOMER_NAMES)
    qty = 1
    total = item.price
    order_id = _order_id()
    order_ref = order_id[:8]
    name_call, name_call_id = _assistant_tool("update_customer_name", {"name": name})
    order_call, order_call_id = _assistant_tool(
        "create_order",
        {"items": [{"sku_or_name": item.name, "qty": qty, "unit_price": item.price}]},
    )
    pay_call, pay_call_id = _assistant_tool(
        "request_mpesa_payment",
        {"amount_kes": total, "order_reference": order_ref, "msisdn": DEMO_MSISDN},
    )
    messages = [
        {"role": "user", "content": f"Can I get {_display_item(rng, item)}?"},
        {"role": "assistant", "content": "Sure - what name should I put on the order?"},
        {"role": "user", "content": name},
        name_call,
        _tool_msg(name_call_id, "update_customer_name", {"ok": True, "name": name}),
        order_call,
        _tool_msg(order_call_id, "create_order", {"ok": True, "order_id": order_id, "amount_kes": total, "payment_status": "pending"}),
        pay_call,
        _tool_msg(pay_call_id, "request_mpesa_payment", {"ok": True, "provider": "intasend", "amount_kes": total, "message": "STK push sent."}),
        {
            "role": "assistant",
            "content": (
                f"Thanks, {name}. I sent the M-Pesa STK for {item.name} at KES {total}. "
                "Enter your PIN; I'll confirm once payment lands."
            ),
        },
    ]
    return _base(messages, include_tools=include_tools)


def generate_photo_request(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    item = rng.choice(MENU_ITEMS)
    intent = rng.choice(PHOTO_INTENTS)
    assistant, call_id = _assistant_tool(
        "send_menu_photo",
        {"item": item.name, "caption": f"{item.name} at Lily Pond"},
    )
    messages = [
        {"role": "user", "content": f"{intent} {_display_item(rng, item)}."},
        assistant,
        _tool_msg(
            call_id,
            "send_menu_photo",
            {"ok": True, "sent": True, "channel": "whatsapp", "item": item.name, "message": "Photo sent successfully."},
        ),
        {"role": "assistant", "content": "Sent it over. Want me to order one for pickup?"},
    ]
    return _base(messages, include_tools=include_tools)


def generate_payment_pending_status(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    item = rng.choice((MENU_ITEMS[0], MENU_ITEMS[3], MENU_ITEMS[18], MENU_ITEMS[21]))
    qty = rng.choice((1, 2))
    total = item.price * qty
    messages = [
        {"role": "user", "content": f"{rng.choice(BUY_INTENTS)} {qty} {_display_item(rng, item)} again."},
        {
            "role": "assistant",
            "content": (
                f"I already have {qty} x {item.name} for KES {total} waiting on payment. "
                "Check the STK prompt on your phone and enter your PIN; I'll confirm once it lands. "
                "If it expired, type 'resend STK'."
            ),
        },
    ]
    return _base(messages, include_tools=include_tools)


def generate_cancellation(rng: random.Random, *, include_tools: bool) -> dict[str, Any]:
    item = rng.choice(MENU_ITEMS)
    total = item.price
    messages = [
        {"role": "user", "content": "Wait no, cancel payment. I changed my mind."},
        {
            "role": "assistant",
            "content": (
                f"No problem - I cancelled the pending {item.name} order for KES {total}. "
                "Ignore any old STK prompt; nothing is confirmed unless you enter your PIN and payment lands."
            ),
        },
    ]
    return _base(messages, include_tools=include_tools)


GENERATORS: tuple[tuple[Callable[[random.Random], dict[str, Any]], float], ...] = (
    (generate_order_and_pay, 0.28),
    (generate_order_missing_name, 0.14),
    (generate_price_check, 0.20),
    (generate_availability_check, 0.12),
    (generate_budget_recommendation, 0.10),
    (generate_photo_request, 0.10),
    (generate_payment_pending_status, 0.04),
    (generate_cancellation, 0.02),
)


ALLOWED_TOOL_NAMES = {tool["function"]["name"] for tool in TOOL_SCHEMAS}
BAD_PENDING_COPY = ("order confirmed", "payment confirmed", "pickup ready", "ready by", "you have paid")


def _iter_tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    return list(message.get("tool_calls") or [])


def validate_example(example: dict[str, Any]) -> None:
    messages = example.get("messages")
    if not isinstance(messages, list) or len(messages) < 2:
        raise ValueError("example must contain at least system + one turn")
    pending_tool_call_ids: set[str] = set()
    for message in messages:
        role = message.get("role")
        if role not in {"system", "user", "assistant", "tool"}:
            raise ValueError(f"invalid role: {role!r}")
        for tool_call in _iter_tool_calls(message):
            call_id = str(tool_call.get("id") or "")
            fn = ((tool_call.get("function") or {}).get("name") or "")
            raw_args = ((tool_call.get("function") or {}).get("arguments") or "")
            if fn not in ALLOWED_TOOL_NAMES:
                raise ValueError(f"unknown tool call: {fn}")
            json.loads(raw_args)
            pending_tool_call_ids.add(call_id)
        if role == "tool":
            call_id = str(message.get("tool_call_id") or "")
            if call_id not in pending_tool_call_ids:
                raise ValueError(f"tool message without matching call id: {call_id}")
            pending_tool_call_ids.remove(call_id)
        if role == "assistant" and isinstance(message.get("content"), str):
            lowered = message["content"].lower()
            if "stk" in lowered and any(bad in lowered for bad in BAD_PENDING_COPY):
                raise ValueError(f"unsafe pending payment wording: {message['content']!r}")
    if pending_tool_call_ids:
        raise ValueError(f"tool calls missing tool responses: {sorted(pending_tool_call_ids)}")


def build_dataset(*, examples: int, seed: int, include_tools: bool) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    funcs = [func for func, _weight in GENERATORS]
    weights = [weight for _func, weight in GENERATORS]
    dataset: list[dict[str, Any]] = []
    for _ in range(examples):
        generator = rng.choices(funcs, weights=weights, k=1)[0]
        example = generator(rng, include_tools=include_tools)
        validate_example(example)
        dataset.append(example)
    return dataset


def write_jsonl(path: Path, dataset: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for entry in dataset:
            handle.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Lily Pond JSONL SFT golden paths.")
    parser.add_argument("--examples", type=int, default=DEFAULT_EXAMPLES, help="number of JSONL examples to write")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output JSONL path")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="random seed for reproducible output")
    parser.add_argument("--sample", type=int, default=0, help="print this many generated examples after writing")
    parser.add_argument("--no-tools", action="store_true", help="omit root tools schemas from each JSONL line")
    args = parser.parse_args()

    if args.examples < 10:
        raise SystemExit("OpenAI SFT datasets need at least 10 examples; use --examples 10 or more.")

    dataset = build_dataset(
        examples=args.examples,
        seed=args.seed,
        include_tools=not args.no_tools,
    )
    write_jsonl(args.output, dataset)
    print(f"Wrote {len(dataset)} Lily Pond training examples to {args.output}")
    print(f"Seed: {args.seed}")
    print("Menu prices are aligned with scripts/seed_geneat_demo.py.")
    if args.sample:
        print()
        for entry in dataset[: args.sample]:
            print(json.dumps(entry, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
