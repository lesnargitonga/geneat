# Incident — VPS unreachable from one location, 2026-08-07/08

## Status: CLOSED. Root cause: network path, not the host.

## Resolution

The VPS recovered on its own. On reconnection the evidence showed the machine
had never been down at all.

| Evidence | Reading |
|---|---|
| `uptime` | **6 days 12 hours** — booted 2026-08-01 22:05, a week before the outage |
| Reboot history | last boot Aug 1; **no reboot, no shutdown** during the window |
| OOM events, all time | **0** |
| Journal lines during 2026-08-07 20:00 → 2026-08-08 08:00 UTC | **1685** — logging continuously |
| UFW logs in window | inbound packets from external internet IPs at 05:26 and 07:41 EAT |
| Services | `geneat-api`, `hazina-api`, `postgresql`, `redis-server`, `nginx` all stayed `active` |
| CarePro | same PM2 process, PID 96317, never restarted |

**The host was alive, serving, and receiving traffic from the public internet
throughout the period it was unreachable from this workstation.**

## Cause

**Transient network-path reachability incident; exact upstream cause
undetermined.**

The path between this workstation (`102.209.57.58`) and the VPS
(`102.203.116.141`) failed and later recovered without intervention. Both
addresses sit in Kenyan AFRINIC space, but no evidence available from either
endpoint identifies which hop or provider was responsible. Naming a specific
routing or peering fault would exceed what was measured.

Ruled out by evidence, not by assumption:

- **VM down / rebooted / crashed** — uptime unbroken for 6 days
- **OOM or resource exhaustion** — zero OOM events ever; the box was logging
  normally with ~1 GB available
- **Provider suspension** — service continued serving other traffic; invoice
  paid to 31 Aug
- **Guest firewall blocking this workstation** — UFW allows 22/80/443 from
  anywhere, no deny rule for `102.209.57.58`, `fail2ban` inactive
- **The Gen-Eat / Hazina deployment** — the services never stopped, never
  restarted, and never triggered a memory event

**Note on ICMP:** ping reports 100% loss even now, with all ports open. ICMP is
filtered on this host and was never a valid liveness test.

## State on recovery

```
ram 1967MB · used 973MB · available 994MB · swap 69MB · load 0.02 · disk 39G free
geneat-api 152.7MB · hazina-api 127.6MB · redis 3.2MB · nginx 8.8MB
carepro 200 · api.geneat 200 · api.hazina 200 · nginx -t successful
```

RSS drifted up slightly from the 2026-08-07 baseline (geneat 147.0 → 152.7 MB,
hazina 121.9 → 127.6 MB), well inside `MemoryMax=380M`. **HEALTHY PILOT
CAPACITY** stands.

## Lesson

Unreachability is not the same as being down. Nothing was rolled back during
the outage, and that was the right call — a rollback would have destroyed a
verified deployment to fix a fault that was never on the host.

The disk fault recorded in
[incident-2026-08-08-local-disk.md](incident-2026-08-08-local-disk.md) remains
open and is unrelated.
