import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const failures = [];
const pass = (message) => console.log(`✓ ${message}`);
const check = (condition, message) => {
  if (condition) pass(message);
  else failures.push(message);
};

const gsFiles = fs.readdirSync(src)
  .filter((name) => name.endsWith('.gs'))
  .sort();

for (const file of gsFiles) {
  const source = fs.readFileSync(path.join(src, file), 'utf8');
  try {
    Function(source);
  } catch (error) {
    failures.push(`${file}: invalid JavaScript syntax (${error.message})`);
  }
}
check(
  !failures.some((failure) => failure.includes('invalid JavaScript syntax')),
  `${gsFiles.length} Apps Script files have valid JavaScript syntax`
);

const globals = new Map();
for (const file of gsFiles) {
  const source = fs.readFileSync(path.join(src, file), 'utf8');
  for (const match of source.matchAll(/^function\s+([\w$]+)\s*\(/gm)) {
    const files = globals.get(match[1]) || [];
    files.push(file);
    globals.set(match[1], files);
  }
}
const duplicates = [...globals].filter(([, files]) => files.length > 1);
check(duplicates.length === 0, 'global Apps Script functions are unique');

for (const relative of ['src/Index.html', 'docs/index.html']) {
  const html = fs.readFileSync(path.join(root, relative), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      Function(match[1]);
    } catch (error) {
      failures.push(`${relative}: invalid browser JavaScript (${error.message})`);
    }
  }
  check(
    !failures.some((failure) => failure.startsWith(`${relative}:`)),
    `${relative} has valid inline JavaScript`
  );
}

const allSource = gsFiles
  .map((file) => fs.readFileSync(path.join(src, file), 'utf8'))
  .join('\n');
for (const name of [
  'requestAccessCode', 'verifyAccessCode', 'signOut', 'getBootstrap',
  'getDashboard', 'searchLeads', 'getLead', 'saveLead', 'savePayment',
  'cancelPayment'
]) {
  check(
    new RegExp(`function\\s+${name}\\s*\\(`).test(allSource),
    `public endpoint ${name} exists`
  );
}

check(
  allSource.includes('function setupTravelCrm_(') &&
    allSource.includes('function seedDemoData_(') &&
    !allSource.includes('function setupTravelCrm(') &&
    !allSource.includes('function seedDemoData('),
  'installer and demo seed cannot be called from the browser'
);
check(
  allSource.includes('requireUser_(token') &&
    allSource.includes('computeHmacSha256Signature') &&
    allSource.includes('MAX_ATTEMPTS') &&
    allSource.includes('MAX_EMAILS_PER_WINDOW') &&
    allSource.includes('SESSION_TTL_MS') &&
    allSource.includes('assertLeadAccess_') &&
    allSource.includes('LockService.getScriptLock()'),
  'OTP sessions, ownership and concurrency controls are present'
);
check(
  allSource.includes("function cellText_(") &&
    allSource.includes("/^[=+\\-@]/"),
  'spreadsheet formula-injection guard is present'
);
check(
  allSource.includes("'CANCELLED'") &&
    allSource.includes('Payment would exceed the sale total'),
  'payments retain cancellations and prevent overpayment'
);
check(
  !/\bMJM\b/i.test(allSource) &&
    !/karahrodi/i.test(allSource) &&
    !/@gmail\.com/i.test(allSource),
  'deployable source contains no private CRM branding or personal email'
);

const index = fs.readFileSync(path.join(src, 'Index.html'), 'utf8');
check(
  ['provider', 'locator', 'route', 'travelStart', 'travelEnd', 'paymentAmount']
    .every((id) => index.includes(`'${id}'`) || index.includes(`id="${id}"`)),
  'UI includes reservation, travel and installment fields'
);
check(
  !index.includes('http://') && !index.includes('https://'),
  'runtime UI has no external network dependency'
);

const manifest = JSON.parse(
  fs.readFileSync(path.join(src, 'appsscript.json'), 'utf8')
);
assert.equal(manifest.runtimeVersion, 'V8');
check(
  manifest.oauthScopes.length === 2 &&
    manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets') &&
    manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'),
  'manifest uses only Sheets and email-sending scopes'
);
check(
  manifest.webapp.executeAs === 'USER_DEPLOYING',
  'web app executes as the deployment owner'
);

for (const file of [
  'README.md', 'README.es.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'ROADMAP.md', 'CITATION.cff',
  'docs/ARCHITECTURE.md', 'docs/DEPLOYMENT.md', 'docs/SECURITY_MODEL.md'
]) {
  check(fs.existsSync(path.join(root, file)), `${file} exists`);
}

check(
  !fs.existsSync(path.join(root, '.clasp.json')),
  'real Apps Script project identifier is not committed'
);
const claspIgnore = fs.readFileSync(path.join(root, '.claspignore'), 'utf8');
check(
  claspIgnore.includes('!appsscript.json') &&
    claspIgnore.includes('!**/*.gs') &&
    claspIgnore.includes('!**/*.html') &&
    !claspIgnore.includes('!src/**'),
  '.claspignore is relative to rootDir and includes Apps Script sources'
);
const gitIgnore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
check(
  gitIgnore.includes('.clasp.json') &&
    gitIgnore.includes('.clasprc.json') &&
    gitIgnore.includes('client_secret'),
  'local clasp and OAuth credential files are ignored'
);

if (failures.length) {
  console.error('\nFailed checks:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('\nAll static checks passed.');
}
