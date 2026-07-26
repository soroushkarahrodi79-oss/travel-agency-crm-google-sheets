import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const claspPath = path.join(root, '.clasp.json');

assert.ok(
  fs.existsSync(claspPath),
  'Missing .clasp.json. Run npm run apps-script:configure -- --script-id YOUR_SCRIPT_ID.'
);
const clasp = JSON.parse(fs.readFileSync(claspPath, 'utf8'));
assert.match(clasp.scriptId || '', /^[A-Za-z0-9_-]{20,}$/);
assert.equal(clasp.rootDir, 'src');
assert.ok(fs.existsSync(path.join(root, 'src', 'appsscript.json')));

const ignore = read('.gitignore');
for (const pattern of [
  '.clasp.json',
  '.clasprc.json',
  'client_secret*.json',
  'credentials*.json',
  'service-account*.json'
]) {
  assert.ok(ignore.includes(pattern), `.gitignore must include ${pattern}`);
}

const tracked = spawnSync(
  'git',
  ['ls-files', '.clasp.json', '.clasprc.json', 'client_secret*.json',
    'credentials*.json', 'service-account*.json'],
  {cwd: root, encoding: 'utf8'}
);
assert.equal(tracked.status, 0, tracked.stderr);
assert.equal(tracked.stdout.trim(), '', 'Private deployment files are tracked.');

console.log('✓ Apps Script project configuration is structurally valid.');
console.log('✓ Deployment identifiers and OAuth credentials remain untracked.');
