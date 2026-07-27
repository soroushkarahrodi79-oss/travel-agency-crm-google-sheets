import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const properties = {
  TRAVEL_CRM_SPREADSHEET_ID: 'TEST_SPREADSHEET_ID_1234567890',
  TRAVEL_CRM_SCHEMA_VERSION: '2',
  TRAVEL_CRM_AUTH_SECRET: 'integration-test-secret',
  TRAVEL_CRM_ENVIRONMENT: 'staging',
  TRAVEL_CRM_STAGING_TOKEN: 'integration-staging-token-1234567890'
};
const sentEmails = [];
let uuidSequence = 0;
let lockHeld = false;

const headers = {
  LEADS: [
    'Lead ID', 'Created at', 'Name', 'Phone', 'Agent email', 'Source',
    'Status', 'Service', 'Destination', 'Budget', 'Sale amount',
    'Travel start', 'Travel end', 'Passengers', 'Next follow-up',
    'Next action', 'Notes', 'Updated at'
  ],
  RESERVATIONS: [
    'Lead ID', 'Provider', 'Booking locator', 'Route', 'Destination',
    'Travel start', 'Travel end', 'Updated at', 'Updated by'
  ],
  PAYMENTS: [
    'Payment ID', 'Lead ID', 'Payment date', 'Amount', 'Method',
    'Reference', 'Notes', 'Status', 'Created at', 'Updated at',
    'Updated by', 'Cancellation reason'
  ],
  USERS: ['Email', 'Display name', 'Role', 'Active', 'Created at'],
  AUDIT_LOG: ['At', 'User email', 'Action', 'Entity type', 'Entity ID', 'Details'],
  TEMPLATES: [
    'Template ID', 'Name', 'Type', 'Subject', 'Body', 'Active',
    'Updated at', 'Updated by'
  ]
};

class MockTextFinder {
  constructor(range, target) {
    this.range = range;
    this.target = String(target).toLowerCase();
  }

  matchEntireCell() {
    return this;
  }

  findNext() {
    for (let offset = 0; offset < this.range.numRows; offset++) {
      const value = this.range.sheet.valueAt(
        this.range.row + offset,
        this.range.column
      );
      if (String(value ?? '').toLowerCase() === this.target) {
        const row = this.range.row + offset;
        return {getRow: () => row};
      }
    }
    return null;
  }
}

class MockRange {
  constructor(sheet, row, column, numRows = 1, numColumns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    return Array.from({length: this.numRows}, (_, rowOffset) =>
      Array.from({length: this.numColumns}, (_, columnOffset) =>
        this.sheet.valueAt(
          this.row + rowOffset,
          this.column + columnOffset
        )
      )
    );
  }

  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => {
      if (value instanceof Date) return value.toISOString();
      if (value === true) return 'TRUE';
      if (value === false) return 'FALSE';
      return value === null || value === undefined ? '' : String(value);
    }));
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.column);
  }

  setValues(values) {
    for (let rowOffset = 0; rowOffset < this.numRows; rowOffset++) {
      for (
        let columnOffset = 0;
        columnOffset < this.numColumns;
        columnOffset++
      ) {
        this.sheet.setValueAt(
          this.row + rowOffset,
          this.column + columnOffset,
          values[rowOffset][columnOffset]
        );
      }
    }
    return this;
  }

  setValue(value) {
    this.sheet.setValueAt(this.row, this.column, value);
    return this;
  }

  setNumberFormat() {
    return this;
  }

  setBackground() {
    return this;
  }

  setFontColor() {
    return this;
  }

  setFontWeight() {
    return this;
  }

  setVerticalAlignment() {
    return this;
  }

  insertCheckboxes() {
    return this;
  }

  setDataValidation() {
    return this;
  }

  createTextFinder(target) {
    return new MockTextFinder(this, target);
  }
}

class MockSheet {
  constructor(name, header, rows = []) {
    this.name = name;
    this.rows = [header.slice(), ...rows.map((row) => row.slice())];
    this.maxRows = 1000;
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    for (let index = this.rows.length - 1; index >= 0; index--) {
      if (this.rows[index]?.some((value) => value !== '' && value != null)) {
        return index + 1;
      }
    }
    return 0;
  }

  getMaxRows() {
    return this.maxRows;
  }

  getMaxColumns() {
    return this.rows[0].length;
  }

  getLastColumn() {
    return this.getMaxColumns();
  }

  getRange(row, column, numRows = 1, numColumns = 1) {
    if (typeof row === 'string') return new MockRange(this, 1, 1);
    assert.equal(typeof row, 'number', 'Integration mock expects numeric ranges.');
    return new MockRange(this, row, column, numRows, numColumns);
  }

  valueAt(row, column) {
    return this.rows[row - 1]?.[column - 1] ?? '';
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) {
      this.rows.push(Array(this.getMaxColumns()).fill(''));
    }
    while (this.rows[row - 1].length < column) {
      this.rows[row - 1].push('');
    }
    this.rows[row - 1][column - 1] = value;
  }

  appendRow(row) {
    this.rows.push(row.slice());
    return this;
  }

  insertRowAfter() {
    this.maxRows++;
    return this;
  }

  insertColumnsAfter() {
    return this;
  }

  setFrozenRows() {
    return this;
  }

  setHiddenGridlines() {
    return this;
  }

  setRowHeight() {
    return this;
  }

  autoResizeColumns() {
    return this;
  }

  setColumnWidths() {
    return this;
  }
}

const sheets = {
  LEADS: new MockSheet('LEADS', headers.LEADS),
  RESERVATIONS: new MockSheet('RESERVATIONS', headers.RESERVATIONS),
  PAYMENTS: new MockSheet('PAYMENTS', headers.PAYMENTS),
  USERS: new MockSheet('USERS', headers.USERS, [[
    'admin@example.com', 'Admin User', 'ADMIN', true, new Date()
  ]]),
  AUDIT_LOG: new MockSheet('AUDIT_LOG', headers.AUDIT_LOG),
  TEMPLATES: new MockSheet('TEMPLATES', headers.TEMPLATES)
};

let spreadsheetTimeZone = 'Europe/Madrid';
const spreadsheet = {
  getId: () => 'CREATED_SPREADSHEET_ID_1234567890',
  getName: () => 'Open Travel CRM Data',
  getUrl: () =>
    'https://docs.google.com/spreadsheets/d/CREATED_SPREADSHEET_ID_1234567890/edit',
  getSheetByName: (name) => sheets[name] || null,
  getSpreadsheetTimeZone: () => spreadsheetTimeZone,
  setSpreadsheetTimeZone: (value) => {
    spreadsheetTimeZone = value;
  },
  insertSheet: (name) => {
    const sheet = new MockSheet(name, []);
    sheets[name] = sheet;
    return sheet;
  }
};

function dateParts(date, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
}

function formatDate(date, timeZone, pattern) {
  const parts = dateParts(date, timeZone);
  if (pattern === 'yyyy') return parts.year;
  if (pattern === 'yyyy-MM-dd') {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  if (pattern === 'yyyyMMdd-HHmmss') {
    return `${parts.year}${parts.month}${parts.day}-` +
      `${parts.hour}${parts.minute}${parts.second}`;
  }
  if (pattern === "yyyy-MM-dd'T'HH:mm:ss") {
    return `${parts.year}-${parts.month}-${parts.day}T` +
      `${parts.hour}:${parts.minute}:${parts.second}`;
  }
  throw new Error(`Unsupported integration date format: ${pattern}`);
}

const scriptProperties = {
  getProperty: (key) => properties[key] ?? null,
  setProperty: (key, value) => {
    properties[key] = String(value);
    return scriptProperties;
  },
  deleteProperty: (key) => {
    delete properties[key];
    return scriptProperties;
  },
  getProperties: () => ({...properties})
};

const context = vm.createContext({
  console,
  Date,
  PropertiesService: {
    getScriptProperties: () => scriptProperties
  },
  Session: {
    getEffectiveUser: () => ({
      getEmail: () => 'admin@example.com'
    })
  },
  SpreadsheetApp: {
    create: (name) => {
      assert.equal(name, 'Open Travel CRM Data');
      return spreadsheet;
    },
    openById: (id) => {
      assert.equal(id, properties.TRAVEL_CRM_SPREADSHEET_ID);
      return spreadsheet;
    },
    flush: () => {},
    newDataValidation: () => {
      const builder = {
        requireValueInList: () => builder,
        setAllowInvalid: () => builder,
        build: () => ({type: 'list'})
      };
      return builder;
    }
  },
  LockService: {
    getScriptLock: () => ({
      waitLock: () => {
        assert.equal(lockHeld, false, 'Nested or unreleased ScriptLock detected.');
        lockHeld = true;
      },
      releaseLock: () => {
        assert.equal(lockHeld, true, 'ScriptLock released without acquisition.');
        lockHeld = false;
      }
    })
  },
  MailApp: {
    sendEmail: (message) => {
      sentEmails.push({...message});
    }
  },
  Utilities: {
    DigestAlgorithm: {SHA_256: 'SHA_256'},
    getUuid: () => {
      uuidSequence++;
      return `${String(uuidSequence).padStart(8, '0')}-0000-4000-8000-000000000000`;
    },
    computeDigest: (_algorithm, value) =>
      [...crypto.createHash('sha256').update(String(value)).digest()],
    computeHmacSha256Signature: (value, secret) =>
      [...crypto.createHmac('sha256', String(secret)).update(String(value)).digest()],
    parseDate: (value) => new Date(`${value}T12:00:00.000Z`),
    formatDate
  }
});

for (const file of [
  'Config.gs',
  'I18n.gs',
  'Security.gs',
  'AuthService.gs',
  'ReservationsService.gs',
  'PaymentsService.gs',
  'LeadsService.gs',
  'TemplatesService.gs',
  'AdminService.gs',
  'Setup.gs',
  'WebApp.gs'
]) {
  vm.runInContext(
    fs.readFileSync(path.join(root, 'src', file), 'utf8'),
    context,
    {filename: file}
  );
}

const functionFromRuntime = (name) => vm.runInContext(name, context);
const call = (name, ...args) => functionFromRuntime(name)(...args);
const plain = (value) => JSON.parse(JSON.stringify(value));
const extractCode = (email) => {
  const message = [...sentEmails].reverse().find((item) => item.to === email);
  assert.ok(message, `No OTP email captured for ${email}.`);
  const match = message.htmlBody.match(/>(\d{6})</);
  assert.ok(match, `No OTP code found for ${email}.`);
  return match[1];
};

const generic = plain(call('requestAccessCode', 'admin@example.com'));
assert.equal(generic.ok, true);
assert.equal(sentEmails.length, 1);
const adminCode = extractCode('admin@example.com');
assert.throws(
  () => call('verifyAccessCode', 'admin@example.com', '000000'),
  /invalid or expired/
);
const adminSession = plain(
  call('verifyAccessCode', 'admin@example.com', adminCode)
);
assert.equal(adminSession.user.role, 'ADMIN');

const bootstrap = plain(call('getBootstrap', adminSession.token));
assert.equal(bootstrap.capabilities.manageUsers, true);
assert.equal(bootstrap.configuration.currency, 'EUR');
assert.equal(bootstrap.configuration.environment, 'staging');

plain(call('saveUser', adminSession.token, {
  email: 'agent@example.com',
  displayName: 'Agent User',
  role: 'AGENT',
  active: true
}));
assert.equal(plain(call('listUsers', adminSession.token)).length, 2);

call('requestAccessCode', 'agent@example.com');
const agentSession = plain(call(
  'verifyAccessCode',
  'agent@example.com',
  extractCode('agent@example.com')
));
assert.equal(agentSession.user.role, 'AGENT');

const agentLead = plain(call('saveLead', adminSession.token, {
  name: 'Fictional Traveller',
  phone: '+34 600 000 001',
  agentEmail: 'agent@example.com',
  source: 'WEB',
  status: 'BOOKED_PENDING_PAYMENT',
  service: 'PACKAGE',
  destination: 'Lisbon',
  budget: '1200',
  saleAmount: '1000',
  travelStart: '2026-09-10',
  travelEnd: '2026-09-15',
  passengers: '2',
  nextFollowUp: '2026-08-15',
  nextAction: 'Confirm deposit',
  provider: 'Fictional Travel',
  locator: 'DEMO123',
  route: 'MAD-LIS',
  notes: 'Integration test record'
})).lead;
assert.equal(agentLead.agentEmail, 'agent@example.com');

const adminLead = plain(call('saveLead', adminSession.token, {
  name: 'Admin-owned Traveller',
  phone: '+34 600 000 002',
  agentEmail: 'admin@example.com',
  source: 'REFERRAL',
  status: 'NEW',
  service: 'FLIGHT',
  destination: 'Rome',
  budget: '500'
})).lead;

const agentSearch = plain(call(
  'searchLeads',
  agentSession.token,
  '',
  50,
  {}
));
assert.deepEqual(agentSearch.map((lead) => lead.id), [agentLead.id]);
assert.throws(
  () => call('getLead', agentSession.token, adminLead.id),
  /belongs to another agent/
);

let paidLead = plain(call('savePayment', agentSession.token, {
  leadId: agentLead.id,
  paymentDate: '2026-08-01',
  amount: '400',
  method: 'BANK_TRANSFER',
  reference: 'TEST-1'
})).lead;
assert.equal(
  paidLead.paymentSummary.balance,
  600,
  JSON.stringify(paidLead.payments)
);
assert.equal(paidLead.status, 'BOOKED_PENDING_PAYMENT');

paidLead = plain(call('savePayment', agentSession.token, {
  leadId: agentLead.id,
  paymentDate: '2026-08-02',
  amount: '600',
  method: 'CARD',
  reference: 'TEST-2'
})).lead;
assert.equal(paidLead.paymentSummary.balance, 0);
assert.equal(paidLead.status, 'CLOSED_WON');

assert.throws(
  () => call('savePayment', agentSession.token, {
    leadId: agentLead.id,
    paymentDate: '2026-08-03',
    amount: '1',
    method: 'CASH'
  }),
  /exceed the sale total/
);
assert.throws(
  () => call('saveLead', agentSession.token, {
    ...paidLead,
    id: agentLead.id,
    name: agentLead.name,
    phone: agentLead.phone,
    status: paidLead.status,
    service: agentLead.service,
    source: agentLead.source,
    saleAmount: '999'
  }),
  /lower than active payments/
);

const paymentToCancel = paidLead.payments.find(
  (payment) => payment.reference === 'TEST-2'
);
paidLead = plain(call('cancelPayment', agentSession.token, {
  leadId: agentLead.id,
  paymentId: paymentToCancel.id,
  reason: 'Fictional integration cancellation'
})).lead;
assert.equal(
  paidLead.paymentSummary.balance,
  600,
  JSON.stringify(paidLead.payments)
);
assert.equal(paidLead.status, 'BOOKED_PENDING_PAYMENT');
assert.equal(
  paidLead.payments.find((payment) => payment.id === paymentToCancel.id).status,
  'CANCELLED'
);

plain(call('saveUser', adminSession.token, {
  email: 'agent@example.com',
  displayName: 'Agent User',
  role: 'AGENT',
  active: false
}));
assert.throws(
  () => call('getDashboard', agentSession.token),
  /expired|disabled|registered/
);

// The follow-up queue runs against a dedicated agent so the expected counts
// stay isolated from the leads created earlier in this file, and every date is
// derived from the runtime clock so the assertions never expire.
plain(call('saveUser', adminSession.token, {
  email: 'queue@example.com',
  displayName: 'Queue Agent',
  role: 'AGENT',
  active: true
}));
call('requestAccessCode', 'queue@example.com');
const queueSession = plain(call(
  'verifyAccessCode',
  'queue@example.com',
  extractCode('queue@example.com')
));

const isoShift = functionFromRuntime('isoShift_');
const queueToday = functionFromRuntime('dateToIso_')(new Date());
const queueLead = (name, followUp, status, budget) => plain(call(
  'saveLead',
  adminSession.token,
  {
    name,
    phone: '+34 600 000 900',
    agentEmail: 'queue@example.com',
    source: 'WEB',
    status,
    service: 'FLIGHT',
    destination: 'Quito',
    budget: budget === undefined ? '900' : budget,
    nextFollowUp: followUp,
    nextAction: 'Call the customer'
  }
)).lead;

const overdueLead = queueLead('Queue Overdue', isoShift(queueToday, -1), 'NEW');
const todayLead = queueLead('Queue Today', queueToday, 'CONTACTED');
const weekLead = queueLead('Queue Week', isoShift(queueToday, 1), 'QUOTED');
queueLead('Queue Beyond Horizon', isoShift(queueToday, 10), 'NEW');
queueLead('Queue Lost', isoShift(queueToday, -1), 'LOST');
queueLead('Queue Undated', '', 'NEW');
// A closed lead is only left at CLOSED_WON when it carries no outstanding
// total, so this one is created without a budget on purpose.
queueLead('Queue Closed', isoShift(queueToday, -1), 'CLOSED_WON', '');

const overdueQueue = plain(call('getFollowUpQueue', queueSession.token, 'OVERDUE'));
assert.deepEqual(overdueQueue.leads.map((lead) => lead.id), [overdueLead.id]);
assert.deepEqual(overdueQueue.counts, {OVERDUE: 1, TODAY: 1, WEEK: 2});
assert.equal(overdueQueue.today, queueToday);
assert.equal(overdueQueue.horizon, isoShift(queueToday, 7));
assert.deepEqual(
  plain(call('getFollowUpQueue', queueSession.token, 'TODAY'))
    .leads.map((lead) => lead.id),
  [todayLead.id]
);
// WEEK spans today through the horizon, ordered from the most urgent date.
assert.deepEqual(
  plain(call('getFollowUpQueue', queueSession.token, 'WEEK'))
    .leads.map((lead) => lead.id),
  [todayLead.id, weekLead.id]
);
// An unspecified scope falls back to the overdue queue.
assert.equal(
  plain(call('getFollowUpQueue', queueSession.token, '')).scope,
  'OVERDUE'
);
assert.throws(
  () => call('getFollowUpQueue', queueSession.token, 'YESTERYEAR'),
  /Invalid follow-up scope/
);
assert.throws(
  () => call('getFollowUpQueue', 'not-a-valid-session-token-value-123456'),
  /session/
);
// Ownership still applies: an administrator supervises every agent's queue,
// while an agent only ever sees their own.
assert.equal(
  plain(call('getFollowUpQueue', adminSession.token, 'OVERDUE'))
    .leads.some((lead) => lead.id === overdueLead.id),
  true
);
assert.equal(
  plain(call('getFollowUpQueue', queueSession.token, 'WEEK'))
    .leads.every((lead) => lead.agentEmail === 'queue@example.com'),
  true
);

// The balance report also runs against its own agent, so the expected money
// totals cannot drift when fixtures elsewhere in this file change.
plain(call('saveUser', adminSession.token, {
  email: 'report@example.com',
  displayName: 'Report Agent',
  role: 'AGENT',
  active: true
}));
call('requestAccessCode', 'report@example.com');
const reportSession = plain(call(
  'verifyAccessCode',
  'report@example.com',
  extractCode('report@example.com')
));

const reportLead = (name, travelStart, budget, status) => plain(call(
  'saveLead',
  adminSession.token,
  {
    name,
    phone: '+34 600 000 800',
    agentEmail: 'report@example.com',
    source: 'WEB',
    status: status || 'NEGOTIATION',
    service: 'PACKAGE',
    destination: 'Lima',
    budget,
    travelStart
  }
)).lead;

const startedLead = reportLead('Report Departed', isoShift(queueToday, -2), '1000');
const soonLead = reportLead('Report Soon', isoShift(queueToday, 3), '1000');
reportLead('Report Later', isoShift(queueToday, 20), '1000');
reportLead('Report Scheduled', isoShift(queueToday, 60), '1000');
reportLead('Report Undated', '', '1000');
// Excluded: fully collected, no longer collectible, and nothing agreed yet.
const settledLead = reportLead('Report Settled', isoShift(queueToday, 10), '500');
reportLead('Report Lost', isoShift(queueToday, 5), '1000', 'LOST');
reportLead('Report No Total', isoShift(queueToday, 5), '');

plain(call('savePayment', adminSession.token, {
  leadId: settledLead.id,
  paymentDate: queueToday,
  amount: '500',
  method: 'CASH'
}));
plain(call('savePayment', adminSession.token, {
  leadId: soonLead.id,
  paymentDate: queueToday,
  amount: '400',
  method: 'CARD'
}));

const report = plain(call('getOutstandingReport', reportSession.token));
assert.equal(report.totals.leads, 5);
assert.equal(report.totals.outstanding, 4600);
assert.equal(report.totals.paid, 400);
assert.deepEqual(
  Object.keys(report.buckets).reduce((counts, name) => {
    counts[name] = report.buckets[name].count;
    return counts;
  }, {}),
  {OVERDUE: 1, DUE_SOON: 1, DUE_LATER: 1, SCHEDULED: 1, NO_TRAVEL_DATE: 1}
);
assert.equal(report.buckets.OVERDUE.outstanding, 1000);
assert.equal(report.buckets.DUE_SOON.outstanding, 600);
// A departure already under way outranks everything else.
assert.equal(report.rows[0].id, startedLead.id);
assert.equal(report.rows[0].bucket, 'OVERDUE');
assert.equal(report.rows[0].daysToTravel, -2);
assert.equal(report.rows[report.rows.length - 1].bucket, 'NO_TRAVEL_DATE');
const soonRow = report.rows.find((row) => row.id === soonLead.id);
assert.equal(soonRow.balance, 600);
assert.equal(soonRow.paid, 400);
assert.equal(soonRow.lastPaymentDate, queueToday);
assert.equal(
  report.rows.some((row) => row.id === settledLead.id),
  false,
  'A fully collected lead must not appear as outstanding.'
);
assert.equal(
  report.rows.every((row) => row.agentEmail === 'report@example.com'),
  true,
  'The report must respect agent ownership.'
);
assert.equal(report.truncated, false);
assert.throws(
  () => call('getOutstandingReport', 'too-short'),
  /session/
);

// Switching the deployment locale must translate what agents read without
// touching the diagnostics operators and CI grep for.
properties.TRAVEL_CRM_LOCALE = 'es-ES';
vm.runInContext('otcRuntimeConfigCache_ = null;', context);
assert.throws(
  () => call('getFollowUpQueue', queueSession.token, 'YESTERYEAR'),
  /Rango de seguimiento no válido/
);
assert.throws(
  () => call('getLead', queueSession.token, 'TRV-0000-9999'),
  /Lead no encontrado/
);
assert.throws(
  () => call('getBootstrap', 'too-short'),
  /Falta tu sesión/
);
assert.equal(
  plain(call('getFollowUpQueue', queueSession.token, 'OVERDUE')).counts.OVERDUE,
  1,
  'Translation must not alter behaviour.'
);
assert.throws(
  () => call('runStagingAcceptance', 'wrong-token-with-at-least-32-characters'),
  /Invalid staging acceptance token/
);
properties.TRAVEL_CRM_LOCALE = 'en-GB';
vm.runInContext('otcRuntimeConfigCache_ = null;', context);
assert.throws(
  () => call('getLead', queueSession.token, 'TRV-0000-9999'),
  /Lead not found/
);

// Templates: administrator-managed, agent-rendered against their own leads.
assert.throws(
  () => call('saveTemplate', queueSession.token, {name: 'Blocked', body: 'x'}),
  /permission/
);
const quoteTemplate = plain(call('saveTemplate', adminSession.token, {
  name: 'Standard quote',
  type: 'QUOTE',
  subject: 'Your {{destination}} quote',
  body: 'Hi {{name}}, your trip to {{destination}} totals {{total}} with ' +
    '{{balance}} outstanding. Unknown token: {{doesNotExist}}.'
})).template;
assert.equal(quoteTemplate.id, 'TPL-0001');
assert.equal(quoteTemplate.active, true);
const draftTemplate = plain(call('saveTemplate', adminSession.token, {
  name: 'Draft template',
  type: 'EMAIL',
  body: 'Draft body',
  active: false
})).template;

assert.deepEqual(
  plain(call('listTemplates', adminSession.token)).map((tpl) => tpl.id),
  ['TPL-0002', 'TPL-0001'],
  'Administrators see every template, sorted by name.'
);
assert.deepEqual(
  plain(call('listTemplates', reportSession.token)).map((tpl) => tpl.id),
  ['TPL-0001'],
  'Agents never see an inactive template.'
);

const rendered = plain(call(
  'renderLeadTemplate', reportSession.token, soonLead.id, quoteTemplate.id
));
assert.equal(rendered.subject, 'Your Lima quote');
assert.match(rendered.body, /^Hi Report Soon, your trip to Lima totals/);
// A balance of 600 in EUR renders with the deployment's currency formatting.
assert.match(rendered.body, /600/);
// An unrecognised placeholder is left visible rather than silently erased.
assert.match(rendered.body, /Unknown token: \{\{doesNotExist\}\}\./);

assert.throws(
  () => call('renderLeadTemplate', reportSession.token, adminLead.id, quoteTemplate.id),
  /belongs to another agent/,
  'Rendering must respect the same ownership as opening the lead.'
);
assert.throws(
  () => call('renderLeadTemplate', reportSession.token, soonLead.id, draftTemplate.id),
  /Template not found/,
  'An agent cannot render an inactive template.'
);
assert.equal(
  plain(call('renderLeadTemplate', adminSession.token, soonLead.id, draftTemplate.id)).body,
  'Draft body',
  'An administrator can still render an inactive template.'
);
assert.throws(
  () => call('saveTemplate', adminSession.token, {name: '', body: 'x'}),
  /name is required/
);
assert.throws(
  () => call('saveTemplate', adminSession.token, {name: 'No body', body: ''}),
  /body is required/
);
// Updating an existing template keeps its ID rather than minting a new one.
const updatedTemplate = plain(call('saveTemplate', adminSession.token, {
  id: quoteTemplate.id,
  name: 'Standard quote (revised)',
  type: 'QUOTE',
  body: 'Revised body for {{name}}.'
})).template;
assert.equal(updatedTemplate.id, quoteTemplate.id);
assert.equal(updatedTemplate.name, 'Standard quote (revised)');

const health = plain(call('runHealthCheck_'));
assert.equal(health.ok, true);
const remoteAcceptance = plain(call(
  'runStagingAcceptance',
  properties.TRAVEL_CRM_STAGING_TOKEN
));
assert.equal(remoteAcceptance.ok, true);
assert.equal(remoteAcceptance.environment, 'staging');
assert.throws(
  () => call('runStagingAcceptance', 'wrong-token-with-at-least-32-characters'),
  /Invalid staging acceptance token/
);
delete properties.TRAVEL_CRM_SPREADSHEET_ID;
const oneStepSetup = plain(call('setupTravelCrm_'));
assert.equal(oneStepSetup.createdSpreadsheet, true);
assert.match(oneStepSetup.spreadsheetUrl, /CREATED_SPREADSHEET_ID/);
assert.equal(
  properties.TRAVEL_CRM_SPREADSHEET_ID,
  'CREATED_SPREADSHEET_ID_1234567890'
);
assert.equal(lockHeld, false);

const auditActions = sheets.AUDIT_LOG.rows.slice(1).map((row) => row[2]);
for (const action of [
  'SIGN_IN',
  'CREATE_USER',
  'CREATE_LEAD',
  'CREATE_PAYMENT',
  'AUTO_UPDATE_STATUS',
  'CANCEL_PAYMENT',
  'UPDATE_USER'
]) {
  assert.ok(auditActions.includes(action), `Missing audit action ${action}.`);
}

console.log('✓ OTP issuance, verification and authenticated bootstrap work end to end.');
console.log('✓ Administrator and agent ownership boundaries are enforced.');
console.log('✓ Payments, overpayment guards, cancellations and status sync are consistent.');
console.log('✓ Access changes invalidate sessions and retain auditable history.');
console.log('✓ Follow-up queue scopes, ordering and ownership are correct.');
console.log('✓ Outstanding balances are aged, ranked, scoped and exclude settled leads.');
console.log('✓ Templates are administrator-managed, ownership-scoped and render unknown tokens visibly.');
console.log('✓ Locale switching translates agent errors and spares operator diagnostics.');
console.log('✓ Operational health checks pass on a consistent installation.');
console.log('✓ One-step setup can create and return a native spreadsheet.');
