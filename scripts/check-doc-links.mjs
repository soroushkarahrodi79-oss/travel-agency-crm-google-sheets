import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const markdownFiles = [];
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.name.endsWith('.md')) markdownFiles.push(absolute);
  }
}

walk(root);

for (const file of markdownFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const withoutCodeBlocks = source.replace(/```[\s\S]*?```/g, '');
  for (const match of withoutCodeBlocks.matchAll(/!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(target.split('#')[0].split('?')[0]);
    } catch {
      failures.push(`${path.relative(root, file)}: invalid encoded link ${target}`);
      continue;
    }
    if (!decoded) continue;
    const resolved = path.resolve(path.dirname(file), decoded);
    const relativeTarget = path.relative(root, resolved);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      failures.push(`${path.relative(root, file)}: link escapes repository (${target})`);
    } else if (!fs.existsSync(resolved)) {
      failures.push(`${path.relative(root, file)}: missing target ${target}`);
    }
  }
}

if (failures.length) {
  console.error('Broken local documentation links:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`✓ ${markdownFiles.length} Markdown files have valid local links.`);
}
