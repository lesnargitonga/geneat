#!/usr/bin/env python
"""Capture-only backend launcher for the Run 2 operator replay.

Nothing under ~/workspace/LesnarAI/backend is modified. This launcher differs
from backend/app.py's own __main__ in exactly two deliberate ways:

  1. It runs with LESNAR_EXTERNAL_ONLY=1, the product's own "empty fleet,
     wait for real telemetry" mode, so initialize_demo_fleet() returns before
     it can create anything. No simulated drone, no LESNAR-DEMO-* seed.

  2. It raises DB_SYNC_INTERVAL so broadcast_telemetry never reaches
     _persist_telemetry_history. That persister coerces absent fields into
     concrete values (armed=False, mode='') and stamps created_at=now, so
     letting it run would write invented values on top of the sealed 608-row
     import and smear its timestamps to today's wall clock.

Both are capture configuration. Neither is the production configuration.
"""
import os, sys, pathlib

RP = pathlib.Path(__file__).resolve().parent
BACKEND = pathlib.Path.home() / "workspace" / "LesnarAI" / "backend"

# Env must be set before importing app: its flags are read at module scope.
os.environ.update({
    "DATABASE_URL":                 f"sqlite:///{RP/'capture_replay.sqlite'}",
    "LESNAR_EXTERNAL_ONLY":         "1",   # empty fleet, real telemetry only
    "LESNAR_ENABLE_DEMO_FLEET":     "0",   # no NYC demo trio
    "LESNAR_LOAD_PERSISTED_FLEET":  "0",
    "LESNAR_REQUIRE_AUTH":          "0",   # capture config, not production
    "LESNAR_ENFORCE_AUDIT_CHAIN":   "0",
    "REDIS_HOST":                   "127.0.0.1",
    "REDIS_PORT":                   "6399", # throwaway redis, not the dev one
    "ALLOW_UNSAFE_WERKZEUG":        "1",
})

sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
import app as A

SEALED_HISTORY_GUARD = 10 ** 9
A.DB_SYNC_INTERVAL = SEALED_HISTORY_GUARD

A.initialize_demo_fleet()
A.start_telemetry_broadcast()
A.start_redis_bridge()
print(f"capture backend up · external_only={A._EXTERNAL_ONLY} "
      f"demo_fleet={A._ENABLE_DEMO_FLEET} db_sync_interval={A.DB_SYNC_INTERVAL}",
      flush=True)
A.socketio.run(A.app, host="127.0.0.1", port=5000, debug=False,
               allow_unsafe_werkzeug=True)
