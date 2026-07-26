import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const config = read('src/Config.gs');
const changelog = read('CHANGELOG.md');
const citation = read('CITATION.cff');
const version = packageJson.version;

assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.ok(
  config.includes(`VERSION: '${version}'`),
  `src/Config.gs does not declare version ${version}`
);
assert.ok(
  changelog.includes(`## [${version}]`),
  `CHANGELOG.md does not contain a ${version} release section`
);
assert.ok(
  new RegExp(`^version:\\s*["']?${version.replace(/\./g, '\\.')}["']?\\s*$`, 'm')
    .test(citation),
  `CITATION.cff does not declare version ${version}`
);
assert.equal(
  packageJson.repository?.url,
  'git+https://github.com/soroushkarahrodi79-oss/travel-agency-crm-google-sheets.git'
);
assert.ok(packageJson.bugs?.url);
assert.ok(packageJson.homepage);

console.log(`✓ Release metadata is consistent for v${version}.`);
