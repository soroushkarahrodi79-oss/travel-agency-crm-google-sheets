import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

export function extractAcceptanceResult(output) {
  const text = String(output || '').trim();
  const starts = [];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '{') starts.push(index);
  }
  for (let index = starts.length - 1; index >= 0; index--) {
    try {
      const parsed = JSON.parse(text.slice(starts[index]));
      return parsed.result ?? parsed.response?.result ?? parsed;
    } catch {
      // clasp can print progress lines before the final JSON object.
    }
  }
  throw new Error('clasp did not return a JSON acceptance result.');
}

export function validateAcceptanceResult(result, expectedVersion) {
  assert.equal(result?.ok, true, 'Staging health report is not healthy.');
  assert.equal(result?.environment, 'staging');
  assert.equal(result?.version, expectedVersion);
  assert.ok(Array.isArray(result?.checks) && result.checks.length >= 8);
  assert.equal(
    result.checks.every((check) => check && check.ok === true),
    true,
    'At least one remote staging check failed.'
  );
  return result;
}

export function formatClaspDiagnostics(execution, secrets = []) {
  let output = [execution?.stdout, execution?.stderr]
    .filter(Boolean)
    .join('\n')
    .trim();
  for (const secret of secrets) {
    if (secret) output = output.replaceAll(secret, '[REDACTED]');
  }
  if (!output) return '[clasp returned no output]';
  return output.length > 4000 ? `…${output.slice(-4000)}` : output;
}

export function buildClaspRunArgs(token) {
  return [
    '--yes',
    '@google/clasp@3.3.0',
    '--json',
    'run-function',
    'runStagingAcceptance',
    '--params',
    JSON.stringify([token])
  ];
}

function main() {
  const token = String(process.env.TRAVEL_CRM_STAGING_TOKEN || '').trim();
  const expectedVersion = String(process.env.npm_package_version || '').trim();
  assert.ok(token.length >= 32, 'TRAVEL_CRM_STAGING_TOKEN must be at least 32 characters.');
  assert.match(expectedVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const execution = spawnSync(
    command,
    buildClaspRunArgs(token),
    {encoding: 'utf8', shell: false}
  );
  const diagnostics = formatClaspDiagnostics(execution, [token]);
  if (execution.status !== 0) {
    throw new Error(`Remote acceptance failed: ${diagnostics}`);
  }
  let acceptance;
  try {
    acceptance = extractAcceptanceResult(execution.stdout);
  } catch (error) {
    throw new Error(
      `${error.message} Sanitized clasp output: ${diagnostics}`
    );
  }
  const result = validateAcceptanceResult(
    acceptance,
    expectedVersion
  );
  console.log(
    `✓ Staging ${result.version} passed ${result.checks.length} remote checks.`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
