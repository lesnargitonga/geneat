# Incident — local disk read fault, 2026-08-08

## Status: OPEN. Root cause NOT established. Nothing written to the device.

## What is proven

A **block-device read I/O failure at the start of `sdb1`**:

```
Aug 07 08:33:48  Mounting mnt-74A0E222A0E1EB16.mount ...
Aug 07 08:35:18  Failed to mount mnt-74A0E222A0E1EB16.mount     (90s elapsed)
Aug 07 08:35:29  kernel: Buffer I/O error on dev sdb1, logical block 0
```

Logical block 0 holds the NTFS header. Without it there is no filesystem
signature, so `blkid` reports nothing, the UUID never appears, the `fstab`
entry cannot match, and `/mnt/74A0E222A0E1EB16` stays an empty stub. `nofail`
is why the machine still boots normally.

Device: `sdb`, Seagate ST3500414CS, 500 GB, SATA.

## What is NOT proven

**The root cause is undetermined.** A read fault at block 0 does not by itself
distinguish between:

- failing disk media or head
- SATA data cable
- SATA power connection
- motherboard controller port
- filesystem corruption combined with a lower-level read problem

`lsblk` enumerating the device proves the controller sees it. It does **not**
prove the platters spin normally or that the media is intact.

An earlier version of this record called the drive "failing" and described it
as "spinning". Both claims outran the evidence and have been withdrawn.

## Do not write to the device

`ntfsfix`, `fsck`, `chkdsk`, partition repair and formatting all **write**.
Writing to a device with an unreadable block 0 is how recoverable data becomes
unrecoverable. Image first, repair the image, never the original.

## Diagnosis order — cheapest and least destructive first

One controlled hardware isolation pass, not repeated boot cycles:

```
power off  →  reseat SATA data cable  →  reseat power cable
           →  swap SATA data cable    →  move to another SATA port
           →  boot  →  check kernel detection + SMART
```

Then, requiring root:

```bash
sudo smartctl -a /dev/sdb | grep -iE "SMART overall|Reallocated|Pending|Uncorrectable|Power_On_Hours"
sudo file -s /dev/sdb1
```

`Current_Pending_Sector` and `Reallocated_Sector_Ct` are decisive. Only after
those support it should the drive be called bad.

## Imaging target

`sdb1` is ~466 GB. `/srv/ai` has **158 GB free** — it cannot hold a full image.
A destination with ~500 GB free is required. Do not start `ddrescue` before
one exists.

## Source-loss exposure

| Copy | State |
|---|---|
| GitHub `lesnargitonga/carepro` (private) | **safe**, HEAD `20c317c8`, 2026-08-05 17:23 EAT |
| local `sdb1` | unreadable |
| VPS `/opt/apps/carepro` | unreachable (separate incident) |

**Known gap: 2026-08-05 17:23 → 2026-08-07 08:35.** Whatever was edited on that
drive inside that window exists nowhere else that is currently readable. Its
contents cannot be enumerated while the device is unreadable, so the gap is
bounded by time but unknown in content. `sarepta-platform` also lived on this
drive; its last GitHub push was 2026-07-25, so its gap is wider.

## Relationship to the VPS incident

**None.** Different hardware, different failure mode, no causal path. A local
disk fault cannot make a remote VM stop answering, and a remote outage cannot
corrupt a local sector. They are recorded separately because treating them as
one event would obscure both.
