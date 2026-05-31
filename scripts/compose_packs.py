#!/usr/bin/env python3
"""Explain why Hazina collection composites are disabled.

Hazina Nomads should use exact collection photography only. Earlier composite
pack shots made the site feel less premium and could misrepresent the product,
so this script now exits with instructions instead of generating assets.
"""
from __future__ import annotations


def main() -> None:
    raise SystemExit(
        "Hazina pack composites are disabled. Photograph the exact finished "
        "collection, place the image in hazina-portal/public/treasures/, and "
        "wire that file in hazina-portal/lib/products.ts."
    )


if __name__ == "__main__":
    main()
