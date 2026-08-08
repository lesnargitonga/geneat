# Infrastructure issue — paid VPS 2 not provisioned

**Status:** OPEN, provider-side. **Opened:** 2026-08-08.

## Paid vs delivered

| | Paid (Cloud VPS 2) | Delivered |
|---|---|---|
| CPU | 2 vCPU | **1 vCPU** |
| RAM | ~4 GB | **1967 MB** |
| Disk | ~100 GB | **50 GB** (`vda`) |
| Transfer | 10 TB | not verifiable from guest |

Client area shows **VPS Hosting – Cloud VPS 2, Active**, hostname
`lgbpvcc3q.truehost-cloud.ke`. The billing product changed; the instance
configuration did not.

## Evidence — a fresh boot, not a stale reading

The VM rebooted at **2026-08-08 11:14:59 EAT**. That reboot is the decisive
test, because CPU/RAM/disk changes apply at power-on. From this boot's kernel
log:

```
smpboot: Allowing 1 CPUs, 0 hotplug CPUs
Memory: 1931236K/2096612K available
```

`lscpu` confirms 1 CPU, QEMU virtual, KVM. `lsblk` shows `vda` at 50G with
`vda1` consuming all of it — **no unallocated space**, so there is nothing for
`growpart`/`resize2fs` to expand into.

The hypervisor allocated the old profile on a clean boot. This is not a guest
detection failure.

## What to ask the provider

Apply the Cloud VPS 2 resource profile to the existing VM configuration.
**Do not rebuild or reprovision the instance** — a replacement VM would destroy
CarePro and both product runtimes.

## Operating position until resolved

The 1 vCPU / 2 GB host is accepted as the temporary runtime.

- Do not reboot repeatedly to "retry" the resize
- Do not alter filesystem geometry — there is no space to claim
- Do not retune PostgreSQL or raise API memory limits for 4 GB
- Continue on measured current capacity

Capacity on the current plan remains **HEALTHY PILOT CAPACITY**.
