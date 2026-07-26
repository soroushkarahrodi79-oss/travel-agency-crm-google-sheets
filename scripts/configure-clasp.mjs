import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : '';
};
const scriptId = String(
  valueAfter('--script-id') || process.env.CLASP_SCRIPT_ID || ''
).trim();
const force = args.includes('--force');
const target = path.join(root, '.clasp.json');

if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) {
  console.error(
    'Provide a valid Apps Script ID with --script-id or CLASP_SCRIPT_ID.'
  );
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'src', 'appsscript.json'))) {
  console.error('src/appsscript.json is missing.');
  process.exit(1);
}
if (fs.existsSync(target) && !force) {
  const current = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (current.scriptId !== scriptId || current.rootDir !== 'src') {
    console.error(
      '.clasp.json already targets another project. Review it or use --force.'
    );
    process.exit(1);
  }
  console.log('✓ .clasp.json already targets the requested Apps Script project.');
  process.exit(0);
}

fs.writeFileSync(
  target,
  `${JSON.stringify({scriptId, rootDir: 'src'}, null, 2)}\n`,
  {encoding: 'utf8', mode: 0o600}
);
console.log('✓ Created private .clasp.json for the staging/deployment project.');
console.log('  Run npm run apps-script:doctor before pushing source.');
