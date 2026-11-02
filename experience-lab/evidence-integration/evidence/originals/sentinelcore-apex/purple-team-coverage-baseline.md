# Purple-Team Coverage Baseline (2026-08-06)

Measured baseline of the platform **before** any qualification/judging, per the
directive to build a strong baseline first. Regenerate with `scripts/coverage_baseline.py`.

## Progression
| stage | detection visibility | intrusion-correlated | correlated intrusion |
|---|---|---|---|
| initial measurement | 10/18 = 55.6% | 10/18 = 55.6% | INCIDENT |
| + detection library (`sentinel_detection`) | 18/18 = 100% | 10/18 = 55.6% | INCIDENT |
| + active-abuse detections | 22/22 = 100% | 14/22 = 63.6% | INCIDENT |
| **+ app-exploitation & supply-chain risk classes** | **28/28 = 100%** | **20/28 = 71.4%** | INCIDENT |

## Current state
- **Technique catalog:** 28 techniques across 10 ATT&CK tactics (adds execution &
  supply-chain: deserialization, XXE, dependency confusion, prompt-injection,
  OAuth pre-hijack, TLS downgrade).
- **Detection visibility: 28/28 = 100%.** Every technique the offensive modules can
  exercise now fires a detection through the unified `sentinel_detection` library,
  with severities (2 low · 5 medium · 8 high · 3 critical). Zero undetected.
- **Intrusion correlation: 10/18 = 55.6% (honest).** The 10 active-intrusion
  detections map to the engine's canonical attack stages and are correlated into an
  **INCIDENT**. The other 8 are posture/reconnaissance detections — *visible*, but
  deliberately **not** mislabelled as active intrusions.

## Architecture
- The **decision engine stays untouched** (still the qualified core). The new
  detection library sits in front of it: raw observation → detections → the
  intrusion-staged detections feed `ShadowOperations` correlation.
- Posture detections (missing headers, wildcard CORS, weak TLS, insecure cookie,
  server disclosure, open redirect, user-enumeration, untrusted cert) surface as
  findings with severity but carry no attack stage.

## Next increments to raise the baseline (still not judging)
1. **Convert legitimate active abuse from posture → intrusion telemetry** where the
   server genuinely observes it: session-cookie **replay** → `suspicious_session_activity`;
   wildcard-CORS **cross-origin read** → `sensitive_resource_access`; credential
   **enumeration bursts** → repeated `unusual_authentication`. Raises intrusion
   correlation past 55.6% *honestly* (only when active abuse is observed).
2. **Wire the real `AssessmentModules`** (web/API/auth/TLS) into the purple-team loop
   against cloned repos, so the observation feeding the detection library comes from
   real targets, not the synthetic weak app.
3. **Re-run this baseline after each increment**; only once coverage is strong do we
   return to blind qualification of the decision engine.

Artifact: `coverage_baseline.json`.
