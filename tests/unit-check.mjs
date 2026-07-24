import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({});

for (const file of ['Config.gs', 'LeadsService.gs', 'PaymentsService.gs']) {
  vm.runInContext(
    fs.readFileSync(path.join(root, 'src', file), 'utf8'),
    context,
    {filename: file}
  );
}

const run = (expression) => vm.runInContext(expression, context);
const throws = (expression, pattern) => {
  assert.throws(() => run(expression), pattern);
};

assert.equal(run('money_("1.234,56")'), 1234.56);
assert.equal(run('money_("1,234.56")'), 1234.56);
assert.equal(run('money_("1 234,56 €")'), 1234.56);
assert.equal(run('money_("1.234")'), 1234);

assert.equal(run('dateFromInput_("2026-12-31").getDate()'), 31);
assert.equal(run('dateFromInput_("31/12/2026").getMonth()'), 11);
throws('dateFromInput_("2026-02-31")', /Invalid date/);
throws('dateFromInput_("12-31-2026")', /Invalid date/);

assert.equal(run('cellText_("=IMPORTXML(\\"x\\")", 100)'), '\'=IMPORTXML("x")');
assert.equal(run('cellText_("+34910000000", 100)'), "'+34910000000");
assert.equal(run('normalize_("  Málaga  ")'), 'malaga');

assert.equal(
  run('allowedOption_("flight", OTC.OPTIONS.SERVICES, "service")'),
  'FLIGHT'
);
throws('optionalMoney_("-1", "Amount")', /zero or greater/);
throws(
  'validateLeadInput_({name:"Test",phone:"1234567",travelStart:"2026-08-10",travelEnd:"2026-08-09"})',
  /cannot be earlier/
);

const summary = JSON.parse(run(
  'JSON.stringify(summarizePayments_(' +
    '{saleAmount:1200,budget:""},' +
    '[{status:"ACTIVE",amount:300},{status:"CANCELLED",amount:200}]' +
  '))'
));
assert.deepEqual(summary, {total: 1200, paid: 300, balance: 900});

console.log('✓ Currency parsing handles European and international input.');
console.log('✓ Dates reject rollover and ambiguous formats.');
console.log('✓ Formula injection and option validation guards work.');
console.log('✓ Installment totals ignore cancelled payments.');
