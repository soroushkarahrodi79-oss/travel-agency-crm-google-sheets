/**
 * Open Travel CRM — shared configuration and value helpers.
 * Deployment-specific values live in Apps Script Properties.
 */
const OTC = Object.freeze({
  VERSION: '1.2.0',
  SCHEMA_VERSION: 1,
  PROPERTY_SPREADSHEET_ID: 'TRAVEL_CRM_SPREADSHEET_ID',
  PROPERTY_ADMIN_EMAIL: 'TRAVEL_CRM_ADMIN_EMAIL',
  PROPERTIES: Object.freeze({
    APP_NAME: 'TRAVEL_CRM_APP_NAME',
    CURRENCY: 'TRAVEL_CRM_CURRENCY',
    LOCALE: 'TRAVEL_CRM_LOCALE',
    TIME_ZONE: 'TRAVEL_CRM_TIME_ZONE',
    ENVIRONMENT: 'TRAVEL_CRM_ENVIRONMENT',
    STAGING_TOKEN: 'TRAVEL_CRM_STAGING_TOKEN',
    SCHEMA_VERSION: 'TRAVEL_CRM_SCHEMA_VERSION',
    INSTALL_ID: 'TRAVEL_CRM_INSTALL_ID'
  }),
  DEFAULTS: Object.freeze({
    APP_NAME: 'Open Travel CRM',
    CURRENCY: 'EUR',
    LOCALE: 'en-GB',
    TIME_ZONE: 'Europe/Madrid',
    ENVIRONMENT: 'production'
  }),
  LIMITS: Object.freeze({
    MAX_MONEY: 1000000000,
    MAX_SEARCH_RESULTS: 100,
    LOCK_TIMEOUT_MS: 20000,
    FOLLOW_UP_WINDOW_DAYS: 7
  }),
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
    PAYMENT_METHODS: ['CARD', 'BANK_TRANSFER', 'CASH', 'FINANCING', 'OTHER'],
    FOLLOW_UP_SCOPES: ['OVERDUE', 'TODAY', 'WEEK']
  })
});

let otcSpreadsheetCache_ = null;
let otcRuntimeConfigCache_ = null;
let otcValidatedSheets_ = {};

function getCrmSpreadsheet_() {
  if (otcSpreadsheetCache_) return otcSpreadsheetCache_;
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(OTC.PROPERTY_SPREADSHEET_ID);
  if (!id) {
    throw new Error(
      'CRM is not configured. Set Script Properties and run setupTravelCrm_().'
    );
  }
  const schema = Number(
    properties.getProperty(OTC.PROPERTIES.SCHEMA_VERSION) || 0
  );
  if (schema !== OTC.SCHEMA_VERSION) {
    throw new Error(
      'CRM schema is not ready for this version. Run setupTravelCrm_() ' +
      'from the Apps Script editor and review the upgrading guide.'
    );
  }
  otcSpreadsheetCache_ = SpreadsheetApp.openById(id);
  return otcSpreadsheetCache_;
}

function getRuntimeConfig_() {
  if (otcRuntimeConfigCache_) return otcRuntimeConfigCache_;
  const properties = PropertiesService.getScriptProperties();
  const appName = cleanText_(
    properties.getProperty(OTC.PROPERTIES.APP_NAME) || OTC.DEFAULTS.APP_NAME,
    80
  ).replace(/[\r\n]+/g, ' ');
  const currency = cleanText_(
    properties.getProperty(OTC.PROPERTIES.CURRENCY) || OTC.DEFAULTS.CURRENCY,
    3
  ).toUpperCase();
  const locale = cleanText_(
    properties.getProperty(OTC.PROPERTIES.LOCALE) || OTC.DEFAULTS.LOCALE,
    20
  );
  const timeZone = cleanText_(
    properties.getProperty(OTC.PROPERTIES.TIME_ZONE) || OTC.DEFAULTS.TIME_ZONE,
    80
  );
  const environment = cleanText_(
    properties.getProperty(OTC.PROPERTIES.ENVIRONMENT) ||
      OTC.DEFAULTS.ENVIRONMENT,
    20
  ).toLowerCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('TRAVEL_CRM_CURRENCY must be an ISO 4217 currency code.');
  }
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale)) {
    throw new Error('TRAVEL_CRM_LOCALE must look like en-GB or es-ES.');
  }
  if (
    timeZone !== 'UTC' &&
    !/^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(timeZone)
  ) {
    throw new Error('TRAVEL_CRM_TIME_ZONE must be an IANA time zone.');
  }
  if (['production', 'staging', 'demo'].indexOf(environment) === -1) {
    throw new Error(
      'TRAVEL_CRM_ENVIRONMENT must be production, staging or demo.'
    );
  }

  otcRuntimeConfigCache_ = {
    appName: appName || OTC.DEFAULTS.APP_NAME,
    currency: currency,
    locale: locale,
    timeZone: timeZone,
    environment: environment
  };
  return otcRuntimeConfigCache_;
}

function getCrmSheet_(name) {
  const sheet = getCrmSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Required sheet is missing: ' + name + '.');
  if (!otcValidatedSheets_[name]) {
    const headerKey = Object.keys(OTC.SHEETS).find(function(key) {
      return OTC.SHEETS[key] === name;
    });
    if (headerKey && OTC.HEADERS[headerKey]) {
      assertCompatibleHeaders_(sheet, OTC.HEADERS[headerKey]);
    }
    otcValidatedSheets_[name] = true;
  }
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
  let text = cleanText_(value, 50)
    .replace(/\s/g, '')
    .replace(/[€$£¥]/g, '')
    .replace(/^[A-Za-z]{3}/, '')
    .replace(/[A-Za-z]{3}$/, '');
  if (!text) return NaN;
  if (!/^[+-]?\d[\d,.]*$/.test(text)) return NaN;
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
    if (isNaN(value.getTime())) throw new Error(t_('Invalid date.'));
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
  const normalized = [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
  const timeZone = getRuntimeConfig_().timeZone;
  let date;
  try {
    date = Utilities.parseDate(normalized, timeZone, 'yyyy-MM-dd');
  } catch (error) {
    throw new Error('Invalid date: ' + text + '.');
  }
  if (
    isNaN(date.getTime()) ||
    Utilities.formatDate(date, timeZone, 'yyyy-MM-dd') !== normalized
  ) throw new Error('Invalid date: ' + text + '.');
  return date;
}

function dateToIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : dateFromInput_(value);
  if (!date) return '';
  return Utilities.formatDate(date, getRuntimeConfig_().timeZone, 'yyyy-MM-dd');
}

/**
 * Shifts a calendar date by whole days. The arithmetic is intentionally done
 * in UTC on a date-only value so a daylight-saving transition inside the
 * window can never turn a seven-day horizon into six or eight days.
 */
function isoShift_(isoDate, days) {
  const parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return '';
  const shifted = new Date(Date.UTC(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]) + Number(days || 0)
  ));
  if (isNaN(shifted.getTime())) return '';
  return shifted.getUTCFullYear() + '-' +
    String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(shifted.getUTCDate()).padStart(2, '0');
}

function nowIso_() {
  return Utilities.formatDate(
    new Date(),
    getRuntimeConfig_().timeZone,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function firstFreeRow_(sheet, idColumn) {
  const column = idColumn || 1;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const maxRows = sheet.getMaxRows();
  if (lastRow <= 1) {
    if (maxRows <= 1) sheet.insertRowAfter(1);
    return 2;
  }
  const values = sheet.getRange(2, column, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (!cleanText_(values[index][0], 200)) return index + 2;
  }
  if (lastRow < maxRows) return lastRow + 1;
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
  lock.waitLock(OTC.LIMITS.LOCK_TIMEOUT_MS);
  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}
