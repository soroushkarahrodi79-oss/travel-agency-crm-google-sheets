import assert from 'node:assert/strict';
import {
  buildClaspRunArgs,
  extractAcceptanceResult,
  formatClaspDiagnostics,
  validateAcceptanceResult
} from '../scripts/staging-check.mjs';

const healthy = {
  ok: true,
  environment: 'staging',
  version: '1.2.0',
  checks: Array.from({length: 8}, (_, index) => ({
    name: `check:${index}`,
    ok: true
  }))
};

assert.deepEqual(
  extractAcceptanceResult(`Pushed files.\n${JSON.stringify(healthy)}`),
  healthy
);
assert.deepEqual(
  extractAcceptanceResult(JSON.stringify({response: {result: healthy}})),
  healthy
);
assert.equal(validateAcceptanceResult(healthy, '1.2.0'), healthy);
assert.throws(
  () => validateAcceptanceResult({...healthy, environment: 'production'}, '1.2.0'),
  /staging/
);
assert.throws(
  () => validateAcceptanceResult({
    ...healthy,
    checks: [...healthy.checks.slice(0, 7), {name: 'broken', ok: false}]
  }, '1.2.0'),
  /failed/
);
assert.equal(
  formatClaspDiagnostics(
    {stdout: 'Calling with super-secret-token', stderr: 'API not deployed'},
    ['super-secret-token']
  ),
  'Calling with [REDACTED]\nAPI not deployed'
);
assert.equal(
  formatClaspDiagnostics({stdout: '', stderr: ''}),
  '[clasp returned no output]'
);
assert.deepEqual(
  buildClaspRunArgs('staging-token'),
  [
    '--yes',
    '@google/clasp@3.3.0',
    '--json',
    'run-function',
    'runStagingAcceptance',
    '--params',
    '["staging-token"]'
  ]
);

console.log('✓ Staging responses are parsed and fail closed on unhealthy deployments.');
