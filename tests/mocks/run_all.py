"""Run both mock servers (AT + Daraja) for manual dev:

    python -m tests.mocks.run_all
"""
from __future__ import annotations

import asyncio

import uvicorn


async def _serve(app_path: str, port: int) -> None:
    config = uvicorn.Config(app_path, host="0.0.0.0", port=port, log_level="warning")
    await uvicorn.Server(config).serve()


async def main() -> None:
    await asyncio.gather(
        _serve("tests.mocks.africastalking_mock:app", 9001),
        _serve("tests.mocks.mpesa_mock:app", 9002),
    )


if __name__ == "__main__":
    print("Mock AT  → http://localhost:9001  (POST /version1/messaging, GET /__recorded__)")
    print("Mock M-Pesa → http://localhost:9002  (POST /mpesa/stkpush/v1/processrequest)")
    asyncio.run(main())
