# Full-history secret scan — `lesnargitonga/geneat` (PUBLIC)

**Date:** 2026-08-08 · **Tool:** gitleaks 8.28.0, `--redact`

**Scope — explicit all-ref qualification.** Re-run with the log scope passed
explicitly rather than relied upon:

```
gitleaks git --log-opts="--all" --redact \
  --report-format json --report-path <path> .
```

Fresh full clone: **9 refs**, `git rev-list --all --count` = **268**.
gitleaks reported **264 commits scanned**, 4.73 MB. Same three findings as the
earlier run, now explicitly qualified across all refs.

## Result: no real credential was ever committed

**3 findings, all false positives.** No value was printed at any point.

| # | finding_type | path | commit | date | status | rotation_required |
|---|---|---|---|---|---|---|
| 1 | generic-api-key | `tests/test_config_validator.py:18` | `cac72f59` | 2026-05-24 | **FALSE POSITIVE** — synthetic test fixture | no |
| 2 | generic-api-key | `tests/test_config_validator.py:20` | `cac72f59` | 2026-05-24 | **FALSE POSITIVE** — synthetic test fixture | no |
| 3 | generic-api-key | `.env.example:32` | `d57e38ac` | 2026-05-22 | **FALSE POSITIVE** — matched across a newline onto `ELEVENLABS_VOICE_ID` | no |

### How each was qualified

**1 & 2** — the `_base_settings()` fixture builds values as
`"prod-secret-key-" + ("a" * 64)` and `"prod-jwt-secret-" + ("c" * 64)`.
Measured: 36 chars, 27 distinct, matching the synthetic construction. Not
credentials.

**3** — `ELEVENLABS_API_KEY=` is **empty** at that commit. gitleaks' match
spanned a newline and captured the following line, `ELEVENLABS_VOICE_ID`
(20 chars) — a voice identifier, not a secret. Still empty at HEAD.

## Secondary check — secret-named variables in `.env.example` across all history

Four ever carried a value. All have placeholder characteristics:

| variable | length | distinct chars | assessment |
|---|---:|---:|---|
| `OPENAI_API_KEY` | 6 | 4 | placeholder — real keys are 51+ chars |
| `META_WA_VERIFY_TOKEN` | 9 | 8 | **see correction below — not dismissible on length** |
| `PHONE_HASH_PEPPER` | 13 | 10 | placeholder |
| `SECRET_KEY` | 33 | 15 | low entropy for its length — placeholder |

gitleaks, which applies entropy thresholds precisely for this, flagged none of
them.

## CORRECTION — `META_WA_VERIFY_TOKEN` was misclassified

An earlier version of this report dismissed the 9-character
`META_WA_VERIFY_TOKEN` by comparing it to Meta **access token** length. That
reasoning was wrong and is withdrawn.

A webhook verify token is **a string we choose ourselves**, not one Meta issues.
Nine characters is entirely plausible for a real one. Its length says nothing
about whether it was genuine.

**Correct classification:**

- **HISTORICALLY PUBLIC** — it sat in a public repository
- **POTENTIALLY REAL VERIFY TOKEN**
- **DO NOT REUSE**
- **ROTATE / REGENERATE BEFORE META ACTIVATION**

**What this does not mean.** A verify token authenticates only the initial
webhook subscription handshake. It is not the Graph API credential. **This
finding does not imply `META_WA_ACCESS_TOKEN` or any Graph API credential was
exposed**, and no such exposure was detected.

**Operational impact: none right now.** WhatsApp is inactive on both products,
and the per-product activation design in each repo's `WHATSAPP-ACTIVATION.md`
already specifies generating a fresh `META_WA_VERIFY_TOKEN` per product via
`openssl rand -hex 32`. No outage and no provider rotation is required today —
only that the historical value is never reused at activation.

## Conclusion

The public monorepo exposes **source**, not secrets. Its full operational
backend is publicly readable — channel adapters, payment integrations, admin
console, tenant logic — but no working credential is present in any commit on
any ref.

**No working credential was detected by the explicit all-ref Gitleaks scan and
the subsequent manual qualification.**

This is a detection result, not a mathematical proof that no secret ever
existed in this history. No provider rotation is required on the basis of this
repository, with the single exception of the historical
`META_WA_VERIFY_TOKEN`, which must be regenerated rather than reused.

## Scope limits, stated honestly

- gitleaks detects known patterns and high-entropy strings. A short, unusual,
  low-entropy credential could evade it.
- This scan covers `lesnargitonga/geneat` only. It says nothing about the local
  `.env.exposed_backup_20260524150829`, whose provenance remains unexplained and
  whose comparison against the current `.env` is still blocked by the permission
  classifier.
- The May 24 date on findings 1 and 2 coincides with that backup's filename.
  The coincidence is in the *date*, not in any leaked value — the commit
  contains synthetic fixtures.

## Deliberately not done

Public history was **not** rewritten or deleted. Nothing warranted it.
