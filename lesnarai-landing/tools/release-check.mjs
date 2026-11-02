// Release check: things that are fine in the private preview but must not reach production.
//   node tools/release-check.mjs        exit 0 only when the tree may be released
// - client work still awaiting publicity approval (data-pending), D-44;
// - availability data older than three days (re-run tools/field/check_availability.py, then build.py);
// - generated pages out of date with their sources (re-run pages.py and build.py).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(import.meta.dirname, '..');
const fail = [];
const pages = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (['node_modules', 'tools', '.vercel', 'lab'].includes(e.name)) continue;
  const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) pages.push(p); } })(ROOT);
for (const p of pages) {
  const n = (fs.readFileSync(p, 'utf8').match(/data-pending="publicity"/g) || []).length;
  if (n) fail.push(`${path.relative(ROOT, p)}: ${n} client reference(s) awaiting publicity approval`);
}
const avail = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/field/availability.json'), 'utf8'));
const checked = new Date(avail.checked.replace(' EAT', '+03:00').replace(' ', 'T'));
const ageDays = (Date.now() - checked) / 864e5;
if (!(ageDays <= 3)) fail.push(`availability checked ${avail.checked} (${ageDays.toFixed(1)} days ago); re-run check_availability.py and build.py`);
// Compare contents, not git status: a page already modified and regenerated differently must still count.
const digest = () => { const h = crypto.createHash('sha256');
  for (const p of pages) h.update(p).update(fs.existsSync(p) ? fs.readFileSync(p) : ''); return h.digest('hex'); };
const before = digest();
execFileSync('python3', ['tools/field/pages.py'], { cwd: ROOT }); execFileSync('python3', ['tools/field/build.py'], { cwd: ROOT });
if (digest() !== before) fail.push('generated pages were out of date; they have been regenerated, review and commit them');
console.log(fail.length ? `RELEASE BLOCKED\n  ${fail.join('\n  ')}` : '=== RELEASE CHECK PASSES ===');
process.exit(fail.length ? 1 : 0);
