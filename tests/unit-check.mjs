import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeProperties = {};
const context = vm.createContext({
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => runtimeProperties[key] ?? null
    })
  },
  Utilities: {
    parseDate: (text) => {
      const [year, month, day] = text.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12));
    },
    formatDate: (date, _timeZone, format) => {
      if (format === 'yyyy-MM-dd') return date.toISOString().slice(0, 10);
      throw new Error(`Unsupported test date format: ${format}`);
    }
  }
});

for (const file of [
  'Config.gs',
  'Security.gs',
  'AuthService.gs',
  'LeadsService.gs',
  'PaymentsService.gs',
  'AdminService.gs',
  'Setup.gs'
]) {
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
assert.equal(run('money_("USD 1,234.56")'), 1234.56);
assert.equal(run('money_("1.234")'), 1234);
assert.equal(run('Number.isNaN(money_("12oops34"))'), true);

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
throws('optionalMoney_("-1", "Amount")', /between zero/);
throws('optionalMoney_("1000000001", "Amount")', /between zero/);
throws(
  'validateLeadInput_({name:"Test",phone:"1234567",travelStart:"2026-08-10",travelEnd:"2026-08-09"})',
  /cannot be earlier/
);

assert.equal(run('leadTotal_({saleAmount:0,budget:500})'), 0);
assert.equal(run('leadTotal_({saleAmount:"",budget:500})'), 500);
assert.equal(run('Number.isNaN(leadTotal_({saleAmount:"",budget:""}))'), true);

const summary = JSON.parse(run(
  'JSON.stringify(summarizePayments_(' +
    '{saleAmount:1200,budget:""},' +
    '[{status:"ACTIVE",amount:300},{status:"CANCELLED",amount:200}]' +
  '))'
));
assert.deepEqual(summary, {total: 1200, paid: 300, balance: 900});

assert.equal(run('safeSignatureEquals_("abc123", "abc123")'), true);
assert.equal(run('safeSignatureEquals_("abc123", "abc124")'), false);
assert.equal(run('safeSignatureEquals_("short", "much-longer")'), false);
assert.equal(
  run('escapeHtml_("<script> & \\"quoted\\"")'),
  '&lt;script&gt; &amp; &quot;quoted&quot;'
);

assert.equal(run('isActiveAdminRow_(["a@example.com","A","ADMIN",true])'), true);
assert.equal(run('isActiveAdminRow_(["a@example.com","A","AGENT",true])'), false);
assert.equal(run('isActiveAdminRow_(["a@example.com","A","ADMIN",false])'), false);
assert.equal(
  run(
    'countDuplicateKeys_({' +
      'getLastRow:function(){return 5;},' +
      'getRange:function(){return {getDisplayValues:function(){return ' +
        '[["A"],["b"],["a"],[""]];}};}' +
    '},1)'
  ),
  1
);
assert.equal(
  run(
    'countActiveAdmins_({' +
      'getLastRow:function(){return 4;},' +
      'getRange:function(){return {getValues:function(){return [' +
        '["a@example.com","A","ADMIN",true,""],' +
        '["b@example.com","B","AGENT",true,""],' +
        '["c@example.com","C","ADMIN",false,""]' +
      '];}};}' +
    '})'
  ),
  1
);

assert.deepEqual(
  JSON.parse(run('JSON.stringify(getRuntimeConfig_())')),
  {
    appName: 'Open Travel CRM',
    currency: 'EUR',
    locale: 'en-GB',
    timeZone: 'Europe/Madrid'
  }
);
runtimeProperties.TRAVEL_CRM_APP_NAME = 'Atlas Travel Desk';
runtimeProperties.TRAVEL_CRM_CURRENCY = 'usd';
runtimeProperties.TRAVEL_CRM_LOCALE = 'en-US';
runtimeProperties.TRAVEL_CRM_TIME_ZONE = 'America/New_York';
run('otcRuntimeConfigCache_ = null');
assert.deepEqual(
  JSON.parse(run('JSON.stringify(getRuntimeConfig_())')),
  {
    appName: 'Atlas Travel Desk',
    currency: 'USD',
    locale: 'en-US',
    timeZone: 'America/New_York'
  }
);
runtimeProperties.TRAVEL_CRM_CURRENCY = 'US';
run('otcRuntimeConfigCache_ = null');
throws('getRuntimeConfig_()', /ISO 4217/);

console.log('✓ Currency parsing is international, bounded and rejects malformed input.');
console.log('✓ Dates reject rollover and ambiguous formats.');
console.log('✓ Formula injection, option validation and totals are guarded.');
console.log('✓ Payment summaries preserve zero-value sales and ignore cancellations.');
console.log('✓ Authentication signatures use a timing-resistant comparison.');
console.log('✓ Administrator, health-check and runtime-configuration helpers enforce their contracts.');
