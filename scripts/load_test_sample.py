"""Very small synthetic load tester using httpx.

Not a replacement for k6/locust; useful for quick local sanity checks.
"""
import asyncio
import os
import sys

import httpx


async def _run(url: str, concurrency: int = 10, requests: int = 100):
    sem = asyncio.Semaphore(concurrency)

    async def _one(client, i):
        async with sem:
            try:
                r = await client.get(url)
                return r.status_code
            except Exception:
                return None

    async with httpx.AsyncClient() as client:
        tasks = [asyncio.create_task(_one(client, i)) for i in range(requests)]
        res = await asyncio.gather(*tasks)
    print(f"Done. {len([r for r in res if r==200])}/{len(res)} 200s")


def main():
    url = os.getenv("LOAD_TEST_URL", "http://127.0.0.1:8000/")
    asyncio.run(_run(url))


if __name__ == "__main__":
    raise SystemExit(main())
