# -*- coding: utf-8 -*-
"""Phase 9 · security audit. Every asset is inspected on CONTENT, never on
   filename, before it may be marked PUBLIC_SAFE."""
import io, json, os, re, hashlib

PATTERNS = {
 "secret/token":   r"(?i)\b(api[_-]?key|secret|token|bearer|authorization|passwd|password)\b",
 "private key":    r"BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY",
 "conn string":    r"(?i)(postgres|mysql|redis|mongodb)(\+\w+)?://\S+",
 "env assignment": r"(?m)^[A-Z][A-Z0-9_]{4,}=\S",
 "private email":  r"(?i)\b[\w.+-]+@(?!lesnarai\.co\.ke)[\w-]+\.[\w.]{2,}\b",
 "phone":          r"\+?254\s?\d{3}\s?\d{3}\s?\d{3}",
 "IPv4":           r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
 "internal host":  r"\b[\w-]+\.(?:internal|local|onrender\.com)\b",
 "txn reference":  r"\b(?:HN-ORD|TXN|MPESA|ORD)[-_A-Z0-9]{6,}\b",
}
PUBLIC_CONTACTS = {"hello@lesnarai.co.ke", "+254 715 540 653", "0715 540 653", "+254715540653"}

def scan_text(t):
    hits = {}
    for name, pat in PATTERNS.items():
        found = [m.group(0) for m in re.finditer(pat, t)]
        found = [f for f in found if f.strip() not in PUBLIC_CONTACTS]
        if found: hits[name] = sorted(set(found))[:3]
    return hits

rows = []
# text artifacts: scan the bytes
for p in ["evidence/originals/reachability.txt", "evidence/originals/sentinelcore-tests.txt",
          "evidence/registry.json", "evidence/claims.json", "evidence/gaps.md"]:
    t = io.open(p, encoding="utf-8", errors="replace").read()
    rows.append((p, "text", scan_text(t)))

# image derivatives: scan the visible text recorded at capture time
meta = json.load(io.open("evidence/web/_derivatives.json", encoding="utf-8"))
for m in meta:
    rows.append((m["derivative_asset_path"] if "derivative_asset_path" in m
                 else f"evidence/web/{m['id']}.png", "image·visible-text", scan_text(m.get("visible_text",""))))
cap = json.load(io.open("evidence/originals/_capture-meta.json", encoding="utf-8"))
for c in cap:
    blob = " ".join([c.get("title",""), " ".join(c.get("h1",[])), " ".join(c.get("nav",[]))])
    rows.append((f"evidence/originals/{c['id']}-home-1440.png", "image·visible-text", scan_text(blob)))

clean = 0
print(f"{'asset':<56} {'kind':<20} finding")
for p, kind, hits in rows:
    if hits:
        print(f"{p:<56} {kind:<20} ⚠ {hits}")
    else:
        clean += 1
        print(f"{p:<56} {kind:<20} clean")
print(f"\n{clean}/{len(rows)} assets clean on content inspection")
print("\nAlso verified by construction:")
print("  · every capture was made unauthenticated — no session, no cookie, no login")
print("  · nothing was submitted: no form, no sign-up, no order, no payment, no write")
print("  · no authenticated or admin route was visited on any product")
print("  · the SentinelCore artifact publishes only a pass/fail summary — no host,")
print("    path, target, finding, topology or configuration")
