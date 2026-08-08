# Repository plan — prepared, NOT executed

Nothing has been pushed. No remote has been created or modified.

## Measured state of the GitHub account `lesnargitonga`

| Repo | Visibility | Last push | Bearing on this plan |
|---|---|---|---|
| `geneat` | **PUBLIC** | 2026-07-16 | The monorepo's `origin` points here |
| `carepro` | private | 2026-08-05 | CarePro's surviving source — restored from it |
| `sarepta-platform` | private | 2026-07-25 | also lived on the failed disk |
| *(no `hazina` repo)* | — | — | must be created |
| `LesnarAI` | PUBLIC | 2026-07-16 | company site candidate; visibility needs review |

## The visibility problem

`lesnargitonga/geneat` is **public**, and the monorepo currently points at it.

The newly extracted Gen-Eat backend is not a storefront. It carries channel
adapters, payment provider integrations, admin console routes, tenant
resolution, escalation logic and migration history. Pushing that into an
existing public repository is a materially different exposure than whatever is
public there today, and it would be irreversible the moment it is fetched or
indexed.

**Recommendation — default all three to private:**

```
lesnargitonga/geneat        → PRIVATE   (visibility change required first)
lesnargitonga/hazina        → PRIVATE   (create new)
lesnargitonga/lesnarai-web  → PRIVATE   (create new)
```

A publicly reachable product does not require a public repository. The
portfolio proves these systems exist through verified behaviour and evidence,
not through readable source.

## Preconditions before any push

Per repository:

- [x] no `.env` or secret file present — **verified, both products clean**
- [x] no hardcoded credential patterns — **verified**
- [x] no VPS IP or internal host in source — **verified**
- [x] correct `.gitignore` (`.env`, `.venv`, `__pycache__`) — **written**
- [x] `.env.example` with names only, no values — **written**
- [x] tests pass independently — **Gen-Eat 178, Hazina 279**
- [x] no import of the old monorepo at runtime — **verified**
- [x] no import of deleted modules at any nesting depth — **verified**
- [ ] `git init` and first commit — not done
- [ ] visibility decision confirmed by owner — **blocking**
- [ ] history secret-scanned if any existing history is reused

`__pycache__` directories exist on disk in both products. They are covered by
`.gitignore` and will not be committed, but should be cleaned before `git init`
to keep the first commit clean.

## Deliberately not done

- No `git init` in either product — a repository with an owner-visible remote
  is a publication decision, not a mechanical step.
- No push, no remote creation, no visibility change.
- The monorepo remains intact as migration and rollback evidence.
