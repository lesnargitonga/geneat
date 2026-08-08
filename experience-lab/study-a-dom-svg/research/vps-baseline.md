# VPS baseline — captured 2026-08-07, before any change

Live capture over SSH. **Read-only: nothing was installed, started, stopped or
reconfigured.** Access path unchanged and preserved; no key was generated,
rotated or read.

## Host

| | |
|---|---|
| Hostname | `LgbpVCC3Q.truehost-cloud.ke` |
| User | `root` |
| CPU | **1 vCPU** |
| RAM | 1967 MB total · 664 used · **1303 available** |
| Swap | **already present** — `/swapfile`, 1000 MB, 72.6 MB used |
| Disk | 50 GB · 6.8 GB used · **40 GB available** (15%) |

Swap already exists, so the planned swap step is unnecessary.

## CarePro — healthy, untouched

| | |
|---|---|
| Runtime | **PM2**, not systemd — process `carepro`, fork mode |
| Uptime | 42 h · 4 restarts · status `online` |
| Memory | 358.4 MB |
| Port | 3000 (`next-server`, Next.js 15.5.21) |
| Health | `http://127.0.0.1:3000/` → **HTTP 200** |
| Path | `/opt/apps/carepro` |
| Nginx | `carepro-vps` → `carepro.co.ke`, `www.carepro.co.ke`, `vps.carepro.co.ke` |

## Data engines — the finding that changes the plan

| Engine | State |
|---|---|
| PostgreSQL | **not installed** — no native binary, no container, unit inactive |
| Redis | **not installed** — no native binary, no container, unit inactive |
| Docker | daemon running, **zero containers** |
| Nginx | active, single site (`carepro-vps`) |

**CarePro's database is remote.** Its Prisma provider is `postgresql` and
`DATABASE_URL` resolves to an external managed database, not localhost.
(Checked as a boolean; no value printed.)

Consequences for the target architecture:

1. There is **no "existing CarePro database/user"** on this VPS to sit alongside
   `geneat_prod` and `hazina_prod`. That branch of the plan describes something
   that does not exist here.
2. PostgreSQL and Redis would both be **greenfield installs**.
3. This is *good* for safety: because CarePro's data lives elsewhere, database
   work on this VPS cannot endanger it. CarePro's exposure is limited to CPU,
   RAM and Nginx contention.

## Capacity arithmetic for the proposed runtime

Against 1303 MB available on 1 vCPU:

| Component | Realistic steady-state |
|---|---|
| PostgreSQL (tuned small) | 150–250 MB |
| Redis (capped `maxmemory`) | 30–50 MB |
| `geneat-api`, 1 worker | 150–250 MB |
| `hazina-api`, 1 worker | 150–250 MB |
| **Total added** | **~480–800 MB** |

Fits within 1303 MB, but leaves little headroom, and **1 vCPU is the real
constraint** — four services plus CarePro contend for one core. Workable for
low traffic; it will not absorb a burst. Recommend `MemoryMax` on each unit so
one product cannot starve CarePro.

## Ports currently listening

22 (sshd) · 80, 443 (nginx) · 3000 (CarePro). Nothing else. `8001`/`8002` are
free for the two product APIs behind Nginx.
