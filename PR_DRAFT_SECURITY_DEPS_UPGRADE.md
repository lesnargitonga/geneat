# PR Draft: chore(security): pin critical deps & add security audit

## Summary
- Add `scripts/security_audit.sh` to run `bandit`, `pip-audit`, and `safety` and write JSON reports to `logs/security/`.
- Pin several high-risk packages identified by `pip-audit` and `bandit`:
  - `python-multipart` -> `0.0.27`
  - `python-dotenv` -> `1.2.2`
  - `orjson` -> `3.11.5`
  - `PyJWT` -> `2.12.0`
- Keep major LLM-related libraries (langchain / langgraph) unchanged to avoid breaking dependency resolution; these need a coordinated upgrade and are tracked separately.

## Files changed
- `requirements.txt` — pinned critical packages.
- `scripts/security_audit.sh` — new audit script.
- `README.md` — link to `SECURITY.md`.

## Test results (local)
- Ran test suite and captured output at `logs/test_upgrade_run.txt`.
- Several tests fail after these changes; failing tests are recorded in the logs and must be addressed before merging.
  - `test_escalation_via_tool` — DB error: `sqlite3.OperationalError: no such table: tool_invocations` during test run.
  - Multiple `Settings` validation tests fail due to the stricter production checks added earlier (`SECRET_KEY` / `JWT_SECRET` validations). These are expected and intentional hardening; tests need updating to provide required secrets or mock `is_prod` behaviour.

## Security findings (short)
- `pip-audit` previously reported critical/important findings in `langchain-*`, `langgraph-*`, `langchain-text-splitters`, `orjson`, `python-multipart`, `python-dotenv`, `pyjwt`.
- This PR fixes only the packages that can be safely upgraded without major code changes. Remaining high-risk libs require a dedicated migration.

## Next steps (recommendations)
1. Review this branch locally: `git fetch && git checkout security/deps-upgrade`.
2. Run `./scripts/security_audit.sh` and review `logs/security/*`.
3. Address failing tests:
   - For `tool_invocations` table: ensure test DB schema/migrations are applied in test fixtures or create a factory to create the table before use.
   - For `Settings` validation: update tests to set required prod secrets or adjust test harness to run under `APP_ENV=dev` where appropriate.
4. Plan a separate PR to upgrade `langchain`/`langgraph` and other LLM libs (major version changes). That plan should include:
   - Dependency matrix and expected code changes.
   - Staged rollouts and extensive unit/integration testing using a dedicated branch.

## How to push/open PR
- Branch has been pushed to remote: `origin/security/deps-upgrade`.
- Create the PR on GitHub (draft) using the suggested title above and include this draft as PR body.

---

Logs: `logs/test_upgrade_run.txt` (full test output saved)
