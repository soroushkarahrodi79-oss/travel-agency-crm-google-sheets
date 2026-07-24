import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set(['.git', 'node_modules', 'coverage', 'dist']);
const excludedFiles = new Set(['.clasp.json.example']);
const findings = [];

const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['Apps Script deployment ID', /\bAKfycb[A-Za-z0-9_-]{20,}\b/],
  ['hard-coded spreadsheet ID', /SpreadsheetApp\.openById\(\s*['"][A-Za-z0-9_-]{20,}['"]/],
  ['hard-coded Script ID', /"scriptId"\s*:\s*"(?!YOUR_)[A-Za-z0-9_-]{20,}"/],
  ['personal email in deployable source', /src[\\/].*:[^\n]*[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i]
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (excludedFiles.has(entry.name)) continue;
    const relative = path.relative(root, absolute);
    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    for (const [name, pattern] of rules) {
      const candidate = name === 'personal email in deployable source'
        ? `${relative}:${text}`
        : text;
      if (pattern.test(candidate)) findings.push(`${name}: ${relative}`);
    }
  }
}

walk(root);

if (fs.existsSync(path.join(root, '.clasp.json'))) {
  findings.push('real .clasp.json file is present');
}

if (findings.length) {
  console.error('Potential publication blockers:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log('✓ No common secrets or deployment identifiers detected.');
}
