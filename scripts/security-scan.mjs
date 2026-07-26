import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excludedFiles = new Set(['.clasp.json.example']);
const findings = [];

const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['Apps Script deployment ID', /\bAKfycb[A-Za-z0-9_-]{20,}\b/],
  ['hard-coded spreadsheet ID', /SpreadsheetApp\.openById\(\s*['"][A-Za-z0-9_-]{20,}['"]/],
  ['hard-coded Script ID', /"scriptId"\s*:\s*"(?!YOUR_)[A-Za-z0-9_-]{20,}"/]
];

function getPublishableFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {cwd: root, encoding: 'utf8'}
  );
  return output.split('\0').filter(Boolean);
}

function scan() {
  for (const relative of getPublishableFiles()) {
    if (excludedFiles.has(path.basename(relative))) continue;
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    for (const [name, pattern] of rules) {
      if (pattern.test(text)) findings.push(`${name}: ${relative}`);
    }
    if (relative.split(path.sep)[0] === 'src') {
      for (const match of text.matchAll(
        /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi
      )) {
        const domain = String(match[1] || '').toLowerCase();
        if (!['example.com', 'example.org', 'example.net'].includes(domain)) {
          findings.push(`personal email in deployable source: ${relative}`);
          break;
        }
      }
    }
  }
}

scan();

if (findings.length) {
  console.error('Potential publication blockers:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log('✓ No common secrets or deployment identifiers detected.');
}
