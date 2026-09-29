# Simy, architecture visual: source specification

There is no messenger to film. The desktop client is a ratchet test harness
(`clients/desktop/simy-desktop/src/RatchetTest.tsx`, 324 lines) inside a 75 line
shell, and the relay serves a single `static/index.html`. That is the whole
visual surface. Filming it would misrepresent the project.

The real subject is the trust architecture, and it is fully source-backed. This
document specifies a diagram to be drawn from the implementation, not
illustrated from imagination.

Verified 29 September 2026 against `~/publish-stage/Simy`.

## Every element, and the file that proves it

| element | evidence in the repository |
|---|---|
| Client / device runtime | `crates/comm-core/src/device.rs`, 230 lines |
| X3DH key agreement | `crates/comm-core/src/x3dh.rs`, 652 lines |
| Double Ratchet | `crates/comm-core/src/double_ratchet.rs`, 829 lines |
| Local session persistence | `crates/comm-core/src/ratchet_store_fs.rs`, 233 lines |
| Core surface | `crates/comm-core/src/lib.rs`, 529 lines. 2,473 lines across the five |
| Relay service | `services/relay/src/main.rs`, axum on tokio |
| PostgreSQL | `sqlx` in the relay. Core tables `relay_mailboxes` and `relay_messages` in `migrations/0001_init.sql` |
| Prekey bundles, device records, accounts | `migrations/0004_prekey_bundles.sql`, `0005_device_records.sql`, `0006_accounts.sql` |
| Media and feed | `migrations/0002`, `0003`, `0008` |
| Redis replay and throttle | `redis::aio::MultiplexedConnection` in `main.rs`. `replay_ttl_margin_seconds`, `submit_rate_limit_per_minute`, `retrieve_rate_limit_per_minute` |
| Retention windows | `min_ttl_seconds`, `default_ttl_seconds`, `max_ttl_seconds` in relay config |
| Push provider boundary | `docs/architecture.md`, trust boundaries section |

## The four trust zones, quoted from docs/architecture.md

1. Untrusted network between client and relay.
2. Semi-trusted relay that handles only ciphertext and minimum operational
   metadata.
3. Trusted client runtime, only to the extent that the endpoint has not been
   compromised.
4. External push providers treated as untrusted hint channels.

The diagram's primary job is to make zone 2 unmistakable: the relay is inside
the picture, and the plaintext is not.

## What the diagram must show on each side of the boundary

Inside the client, never leaving it: plaintext content, private key material,
X3DH shared secrets, ratchet state.

Crossing the network and held by the relay: ciphertext envelopes, mailbox
records, public prekey bundles, device records, delivery state, TTL expiry,
replay counters.

## Implemented foundation versus remaining work

This distinction is not optional. `README.md` from line 1186 lists what is not
done, and the diagram must not imply otherwise.

Implemented, and drawn as solid: comm-core with X3DH and Double Ratchet, the
filesystem ratchet store, the relay with its Postgres schema and Redis replay
and rate limiting, TTL enforcement in config.

Not yet production ready, and drawn as clearly provisional: audit and hardening
of the 1:1 X3DH and Double Ratchet session core, audited MLS for groups, device
enrolment, trust and revocation flows, production-grade relay wiring for the
desktop ratchet client, Kotlin and Swift bindings from the Rust core, encrypted
local stores on Android and iOS, push token management and wake-hint delivery,
production-grade abuse controls at the edge, signing and update infrastructure.

A reader must be able to tell at a glance which parts are built and which are
stated intent. Use one visual device for that distinction and nothing else.

## Drawing constraints

Permitted: a flat, precise, orthogonal diagram in the site's own typography and
neutral palette. Boundary lines. Labels taken verbatim from the table above.

Not permitted: floating phones, device mockups, padlocks, shields, glowing
packets, keyholes, network globes, circuit-board textures, neon, a messenger
screen of any kind, or a "hacker" register. Nothing that implies a finished
consumer product.

Higgsfield's role here, if any, is limited to depth and camera movement across
a diagram that has already been drawn correctly. It must not generate the
diagram, invent a component, or soften the built versus unbuilt distinction.

## Honest one-line summary for the page

The relay carries sealed envelopes between mailboxes, verifies the signature on
a published prekey bundle, and performs no decryption of its own. The relay and
the cryptographic core are built. The end-user messenger is not finished.
