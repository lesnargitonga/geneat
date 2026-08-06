# Proof assets

Empty by design after Waves A and B.

This directory holds **real** evidence only: interface screenshots,
architecture diagrams derived from the codebase, and recorded operational
sequences. §7.9 is explicit — "Do not present a fictional browser mock-up as
the primary proof" — and §10 forbids fake proof outright.

Nothing has been placed here because nothing has been captured. The Gen-Eat
panel marked `EVIDENCE PENDING` says so on the page rather than filling the
space with a plausible-looking mock.

## Required before this directory is populated (Wave E)

- A screenshot of the running Gen-Eat interface, captured from the live product
- An architecture diagram generated from, or checked against, `app/`
- A verified response from `api.lesnarai.co.ke` if a live status claim is made

## Review before committing anything here

Any capture from a running Gen-Eat or Hazina instance must be checked for
customer data, phone numbers, order contents, staff names and internal
identifiers first. This repository is not the right place for an unreviewed
production screenshot.

## Parity note

Study B's `public/proof/` is also empty, for the same reason and at the same
wave. If one study gains real screenshots before the other, the comparison
becomes a comparison of *evidence gathering effort* rather than of rendering
approach — so proof assets should land in both studies together, or the
difference must be declared in `scripts/check-content-parity.mjs`.
