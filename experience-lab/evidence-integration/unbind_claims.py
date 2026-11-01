#!/usr/bin/env python3
"""Unbind withdrawn claims from their routes in the evidence registry, keeping the record.

usage: python3 unbind_claims.py evidence/claims.json "<reason>" CLAIM_ID [CLAIM_ID ...]

route=null is how tools/claims-gate.mjs already skips a claim the site does not
publish; status and public_status record the withdrawal and the note keeps the
previous note after the reason.
"""
import json, sys
path, reason, *ids = sys.argv[1:]
with open(path, encoding='utf-8') as fh:
    data = json.load(fh)
found = set()
for claim in data['claims']:
    if claim['claim_id'] in ids:
        claim['route'] = None
        claim['status'] = claim['public_status'] = 'WITHDRAWN 2026-11-01'
        claim['note'] = reason + ' Previously: ' + claim.get('note', '')
        found.add(claim['claim_id'])
missing = set(ids) - found
if missing:
    sys.exit(f'unknown claim ids: {sorted(missing)}')
with open(path, 'w', encoding='utf-8') as fh:
    fh.write(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
