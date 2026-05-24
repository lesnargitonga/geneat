"""Lightweight payment flow verification helpers.

These are quick smoke checks and shouldn't be used as a substitute for
integration testing against provider sandboxes.
"""
import os
import sys


def main() -> int:
    # Example: verify webhook secret is set for IntaSend/Stripe
    missing = []
    if os.getenv("PAYMENT_PROVIDER") == "intasend" and not os.getenv("INTASEND_WEBHOOK_SECRET"):
        missing.append("INTASEND_WEBHOOK_SECRET")
    if os.getenv("PAYMENT_PROVIDER") == "stripe" and not os.getenv("STRIPE_WEBHOOK_SECRET"):
        missing.append("STRIPE_WEBHOOK_SECRET")
    if missing:
        print("Missing payment webhook secrets:", ", ".join(missing), file=sys.stderr)
        return 1
    print("Payment webhook config looks ok (sanity)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
