import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const properties = {
  TRAVEL_CRM_SPREADSHEET_ID: 'TEST_SPREADSHEET_ID_1234567890',
  TRAVEL_CRM_SCHEMA_VERSION: '1',
  TRAVEL_CRM_AUTH_SECRET: 'integration-test-secret'
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
  AUDIT_LOG: ['At', 'User email', 'Action', 'Entity type', 'Entity ID', 'Details']
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

  getRange(row, column, numRows = 1, numColumns = 1) {
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
}

const sheets = {
  LEADS: new MockSheet('LEADS', headers.LEADS),
  RESERVATIONS: new MockSheet('RESERVATIONS', headers.RESERVATIONS),
  PAYMENTS: new MockSheet('PAYMENTS', headers.PAYMENTS),
  USERS: new MockSheet('USERS', headers.USERS, [[
    'admin@example.com', 'Admin User', 'ADMIN', true, new Date()
  ]]),
  AUDIT_LOG: new MockSheet('AUDIT_LOG', headers.AUDIT_LOG)
};

const spreadsheet = {
  getSheetByName: (name) => sheets[name] || null,
  getSpreadsheetTimeZone: () => 'Europe/Madrid'
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
  SpreadsheetApp: {
    openById: (id) => {
      assert.equal(id, properties.TRAVEL_CRM_SPREADSHEET_ID);
      return spreadsheet;
    },
    flush: () => {}
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
  'Security.gs',
  'AuthService.gs',
  'ReservationsService.gs',
  'PaymentsService.gs',
  'LeadsService.gs',
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

const health = plain(call('runHealthCheck_'));
assert.equal(health.ok, true);
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
console.log('✓ Operational health checks pass on a consistent installation.');
