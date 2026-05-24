"""Sanity check helper for webhook handshake configuration.

Verifies required webhook secrets are set in env and prints guidance.
"""
import os
import sys


def main() -> int:
    missing = []
    if not os.getenv("META_WA_VERIFY_TOKEN"):
        missing.append("META_WA_VERIFY_TOKEN")
    if not os.getenv("INTASEND_WEBHOOK_SECRET"):
        missing.append("INTASEND_WEBHOOK_SECRET")
    if missing:
        print("Missing webhook secrets:", ", ".join(missing), file=sys.stderr)
        return 1
    print("Webhook handshake secrets configured")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
