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
  'I18n.gs',
  'Security.gs',
  'AuthService.gs',
  'LeadsService.gs',
  'PaymentsService.gs',
  'TemplatesService.gs',
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

assert.equal(run('messageLanguage_("es-ES")'), 'es');
assert.equal(run('messageLanguage_("ES")'), 'es');
assert.equal(run('messageLanguage_("en-GB")'), 'en');
// An unsupported locale must degrade to English rather than throw.
assert.equal(run('messageLanguage_("fr-FR")'), 'en');
assert.equal(run('messageLanguage_("")'), 'en');
assert.equal(run('messageLanguage_(null)'), 'en');
// An untranslated string falls back to its English source, never to a key.
assert.equal(
  run('OTC_MESSAGES.es["Lead not found."]'),
  'Lead no encontrado.'
);

assert.equal(run('isoShift_("2026-07-26", 7)'), '2026-08-02');
assert.equal(run('isoShift_("2026-07-26", 0)'), '2026-07-26');
assert.equal(run('isoShift_("2026-01-01", -1)'), '2025-12-31');
assert.equal(run('isoShift_("2028-02-28", 1)'), '2028-02-29');
// A daylight-saving transition must not stretch or shrink the horizon.
assert.equal(run('isoShift_("2026-03-26", 7)'), '2026-04-02');
assert.equal(run('isoShift_("2026-10-22", 7)'), '2026-10-29');
assert.equal(run('isoDayDelta_("2026-07-26", "2026-08-02")'), 7);
assert.equal(run('isoDayDelta_("2026-08-02", "2026-07-26")'), -7);
assert.equal(run('isoDayDelta_("2026-07-26", "2026-07-26")'), 0);
// Counting across a daylight-saving change must not gain or lose a day.
assert.equal(run('isoDayDelta_("2026-03-26", "2026-04-02")'), 7);
assert.equal(run('isoDayDelta_("2026-10-22", "2026-10-29")'), 7);
assert.equal(run('isoDayDelta_("bad", "2026-07-26")'), null);

assert.equal(run('agingBucket_(null)'), 'NO_TRAVEL_DATE');
assert.equal(run('agingBucket_(-1)'), 'OVERDUE');
assert.equal(run('agingBucket_(0)'), 'DUE_SOON');
assert.equal(run('agingBucket_(7)'), 'DUE_SOON');
assert.equal(run('agingBucket_(8)'), 'DUE_LATER');
assert.equal(run('agingBucket_(30)'), 'DUE_LATER');
assert.equal(run('agingBucket_(31)'), 'SCHEDULED');

assert.equal(run('isoShift_("", 7)'), '');
assert.equal(run('isoShift_("not-a-date", 7)'), '');

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
    timeZone: 'Europe/Madrid',
    environment: 'production'
  }
);
runtimeProperties.TRAVEL_CRM_APP_NAME = 'Atlas Travel Desk';
runtimeProperties.TRAVEL_CRM_CURRENCY = 'usd';
runtimeProperties.TRAVEL_CRM_LOCALE = 'en-US';
runtimeProperties.TRAVEL_CRM_TIME_ZONE = 'America/New_York';
runtimeProperties.TRAVEL_CRM_ENVIRONMENT = 'staging';
run('otcRuntimeConfigCache_ = null');
assert.deepEqual(
  JSON.parse(run('JSON.stringify(getRuntimeConfig_())')),
  {
    appName: 'Atlas Travel Desk',
    currency: 'USD',
    locale: 'en-US',
    timeZone: 'America/New_York',
    environment: 'staging'
  }
);
runtimeProperties.TRAVEL_CRM_CURRENCY = 'US';
run('otcRuntimeConfigCache_ = null');
throws('getRuntimeConfig_()', /ISO 4217/);
runtimeProperties.TRAVEL_CRM_CURRENCY = 'USD';
runtimeProperties.TRAVEL_CRM_ENVIRONMENT = 'preview';
run('otcRuntimeConfigCache_ = null');
throws('getRuntimeConfig_()', /production, staging or demo/);

runtimeProperties.TRAVEL_CRM_ENVIRONMENT = 'production';
run('otcRuntimeConfigCache_ = null');
assert.equal(run('formatMoney_(1234.5)'), '$1,234.50');
// A blank or non-finite amount is not the same as a zero amount.
assert.equal(run('formatMoney_("")'), '');
assert.equal(run('formatMoney_(null)'), '');
assert.equal(run('formatMoney_(undefined)'), '');
assert.equal(run('formatMoney_(NaN)'), '');
assert.equal(run('formatMoney_(0)'), '$0.00');

assert.equal(
  run("renderTemplateText_('Hi {{name}}, total {{total}}.', {name: 'Ana', total: '$10'})"),
  'Hi Ana, total $10.'
);
// An unknown token is left visible so a typo is noticed, not silently erased.
assert.equal(
  run("renderTemplateText_('Hi {{missing}}.', {name: 'Ana'})"),
  'Hi {{missing}}.'
);
assert.equal(run("renderTemplateText_('', {name: 'Ana'})"), '');
assert.equal(
  run("renderTemplateText_('{{ name }}', {name: 'Ana'})"),
  'Ana',
  'Whitespace inside the braces is tolerated.'
);

console.log('✓ Currency parsing is international, bounded and rejects malformed input.');
console.log('✓ Dates reject rollover and ambiguous formats.');
console.log('✓ Formula injection, option validation and totals are guarded.');
console.log('✓ Payment summaries preserve zero-value sales and ignore cancellations.');
console.log('✓ Authentication signatures use a timing-resistant comparison.');
console.log('✓ Administrator, health-check and runtime-configuration helpers enforce their contracts.');
