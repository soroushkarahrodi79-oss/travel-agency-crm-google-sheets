import assert from 'node:assert/strict';
import {
  extractAcceptanceResult,
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

console.log('✓ Staging responses are parsed and fail closed on unhealthy deployments.');
