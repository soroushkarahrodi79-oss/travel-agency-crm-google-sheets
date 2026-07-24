/**
 * Open Travel CRM — shared configuration and value helpers.
 * All deployment-specific values live in Apps Script Properties.
 */
const OTC = Object.freeze({
  VERSION: '1.0.0',
  PROPERTY_SPREADSHEET_ID: 'TRAVEL_CRM_SPREADSHEET_ID',
  PROPERTY_ADMIN_EMAIL: 'TRAVEL_CRM_ADMIN_EMAIL',
  TIME_ZONE: 'Europe/Madrid',
  AUTH: Object.freeze({
    SECRET_PROPERTY: 'TRAVEL_CRM_AUTH_SECRET',
    OTP_PREFIX: 'TRAVEL_CRM_OTP_',
    SESSION_PREFIX: 'TRAVEL_CRM_SESSION_',
    RATE_PREFIX: 'TRAVEL_CRM_RATE_',
    OTP_TTL_MS: 10 * 60 * 1000,
    SESSION_TTL_MS: 8 * 60 * 60 * 1000,
    RESEND_DELAY_MS: 60 * 1000,
    RATE_WINDOW_MS: 60 * 60 * 1000,
    MAX_ATTEMPTS: 6,
    MAX_EMAILS_PER_WINDOW: 6
  }),
  SHEETS: Object.freeze({
    LEADS: 'LEADS',
    RESERVATIONS: 'RESERVATIONS',
    PAYMENTS: 'PAYMENTS',
    USERS: 'USERS',
    AUDIT: 'AUDIT_LOG'
  }),
  HEADERS: Object.freeze({
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
    AUDIT: ['At', 'User email', 'Action', 'Entity type', 'Entity ID', 'Details']
  }),
  OPTIONS: Object.freeze({
    ROLES: ['ADMIN', 'AGENT'],
    STATUSES: [
      'NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATION',
      'BOOKED_PENDING_PAYMENT', 'CLOSED_WON', 'LOST'
    ],
    SERVICES: ['FLIGHT', 'PACKAGE', 'HOTEL', 'INSURANCE', 'VISA', 'OTHER'],
    SOURCES: ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEB', 'CALL', 'REFERRAL', 'OTHER'],
    PAYMENT_METHODS: ['CARD', 'BANK_TRANSFER', 'CASH', 'FINANCING', 'OTHER']
  })
});

function getCrmSpreadsheet_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty(OTC.PROPERTY_SPREADSHEET_ID);
  if (!id) {
    throw new Error(
      'CRM is not configured. Set Script Properties and run setupTravelCrm_().'
    );
  }
  return SpreadsheetApp.openById(id);
}

function getCrmSheet_(name) {
  const sheet = getCrmSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Required sheet is missing: ' + name + '.');
  return sheet;
}

function cleanText_(value, maxLength) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .substring(0, maxLength || 500);
}

function cellText_(value, maxLength) {
  const text = cleanText_(value, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function normalize_(value) {
  return cleanText_(value, 500)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function money_(value) {
  if (typeof value === 'number') return value;
  let text = cleanText_(value, 50).replace(/[€$\s]/g, '');
  if (!text) return NaN;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    text = comma > dot
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = /^\d{1,3}(,\d{3})+$/.test(text)
      ? text.replace(/,/g, '')
      : text.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  return Number(text);
}

function dateFromInput_(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error('Invalid date.');
    return new Date(value.getTime());
  }
  const text = cleanText_(value, 30);
  if (!text) return '';
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!iso && !local) throw new Error('Invalid date: ' + text + '.');
  const year = Number(iso ? iso[1] : local[3]);
  const month = Number(iso ? iso[2] : local[2]);
  const day = Number(iso ? iso[3] : local[1]);
  const date = new Date(year, month - 1, day);
  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) throw new Error('Invalid date: ' + text + '.');
  return date;
}

function dateToIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : dateFromInput_(value);
  if (!date) return '';
  return Utilities.formatDate(date, OTC.TIME_ZONE, 'yyyy-MM-dd');
}

function nowIso_() {
  return Utilities.formatDate(new Date(), OTC.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function firstFreeRow_(sheet, idColumn) {
  const column = idColumn || 1;
  const maxRows = sheet.getMaxRows();
  if (maxRows <= 1) {
    sheet.insertRowAfter(1);
    return 2;
  }
  const values = sheet.getRange(2, column, maxRows - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (!cleanText_(values[index][0], 200)) return index + 2;
  }
  sheet.insertRowAfter(maxRows);
  return maxRows + 1;
}

function findRowById_(sheet, column, id) {
  const target = cleanText_(id, 120);
  if (!target || sheet.getLastRow() <= 1) return 0;
  const match = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(target)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function withCrmLock_(operation) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}
