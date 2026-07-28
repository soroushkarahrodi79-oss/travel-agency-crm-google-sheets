/**
 * Creates or connects the native Google Sheets data store, provisions the
 * schema and registers the first administrator.
 *
 * For the shortest install, run this once without properties: the installer
 * creates an agency-owned spreadsheet and uses the executing Google account as
 * administrator. Existing installations can keep supplying spreadsheet/admin
 * properties explicitly.
 */
function setupTravelCrm_() {
  const properties = PropertiesService.getScriptProperties();
  const installedSchemaText = cleanText_(
    properties.getProperty(OTC.PROPERTIES.SCHEMA_VERSION),
    20
  );
  const installedSchema = installedSchemaText ? Number(installedSchemaText) : 0;
  if (!Number.isInteger(installedSchema) || installedSchema < 0) {
    throw new Error('The installed CRM schema version is invalid.');
  }
  if (installedSchema > OTC.SCHEMA_VERSION) {
    throw new Error(
      'This spreadsheet uses schema ' + installedSchema +
      ', but the deployed code supports only schema ' + OTC.SCHEMA_VERSION +
      '. Deploy a compatible or newer code version; setup will not downgrade it.'
    );
  }
  let id = cleanText_(
    properties.getProperty(OTC.PROPERTY_SPREADSHEET_ID),
    160
  );
  const runtime = getRuntimeConfig_();
  const configuredAdminEmail = cleanText_(
    properties.getProperty(OTC.PROPERTY_ADMIN_EMAIL),
    200
  ).toLowerCase();
  const executingEmail = typeof Session === 'undefined'
    ? ''
    : cleanText_(Session.getEffectiveUser().getEmail(), 200).toLowerCase();
  if (
    !id &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredAdminEmail) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(executingEmail)
  ) {
    throw new Error(
      'The executing account email is unavailable. Set a valid ' +
      'TRAVEL_CRM_ADMIN_EMAIL before creating the spreadsheet.'
    );
  }
  let spreadsheet;
  let createdSpreadsheet = false;
  if (!id) {
    spreadsheet = SpreadsheetApp.create(runtime.appName + ' Data');
    id = spreadsheet.getId();
    properties.setProperty(OTC.PROPERTY_SPREADSHEET_ID, id);
    createdSpreadsheet = true;
  } else if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error(
      'Set a valid TRAVEL_CRM_SPREADSHEET_ID in Script Properties.'
    );
  } else {
    spreadsheet = SpreadsheetApp.openById(id);
  }

  const existingUsers = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  let email = configuredAdminEmail;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    email = existingUsers ? existingAdminEmail_(existingUsers) : '';
  }
  if (!email) email = executingEmail;
  if (!email) {
    throw new Error(
      'The executing account email is unavailable. Set a valid ' +
      'TRAVEL_CRM_ADMIN_EMAIL in Script Properties and run setup again.'
    );
  }
  ensureAuthSecret_();

  ensureSheet_(spreadsheet, OTC.SHEETS.LEADS, OTC.HEADERS.LEADS);
  ensureSheet_(spreadsheet, OTC.SHEETS.RESERVATIONS, OTC.HEADERS.RESERVATIONS);
  ensureSheet_(spreadsheet, OTC.SHEETS.PAYMENTS, OTC.HEADERS.PAYMENTS);
  ensureSheet_(spreadsheet, OTC.SHEETS.USERS, OTC.HEADERS.USERS);
  ensureSheet_(spreadsheet, OTC.SHEETS.AUDIT, OTC.HEADERS.AUDIT);
  ensureSheet_(spreadsheet, OTC.SHEETS.TEMPLATES, OTC.HEADERS.TEMPLATES);
  ensureSheet_(spreadsheet, OTC.SHEETS.DRIVE_LINKS, OTC.HEADERS.DRIVE_LINKS);
  ensureSheet_(spreadsheet, OTC.SHEETS.CALENDAR_EVENTS, OTC.HEADERS.CALENDAR_EVENTS);
  applySheetFormats_(spreadsheet);
  spreadsheet.setSpreadsheetTimeZone(runtime.timeZone);

  const users = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  if (!findRowById_(users, 1, email)) {
    users.appendRow([email, 'Administrator', 'ADMIN', true, new Date()]);
  }
  if (!properties.getProperty(OTC.PROPERTIES.INSTALL_ID)) {
    properties.setProperty(OTC.PROPERTIES.INSTALL_ID, Utilities.getUuid());
  }
  properties.setProperty(
    OTC.PROPERTIES.SCHEMA_VERSION,
    String(OTC.SCHEMA_VERSION)
  );
  properties.deleteProperty(OTC.PROPERTY_ADMIN_EMAIL);
  SpreadsheetApp.flush();
  const health = buildHealthReport_(spreadsheet);
  return {
    ok: true,
    version: OTC.VERSION,
    schemaVersion: OTC.SCHEMA_VERSION,
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: id,
    spreadsheetUrl: spreadsheet.getUrl(),
    createdSpreadsheet: createdSpreadsheet,
    adminEmail: email,
    configuration: runtime,
    sheets: Object.keys(OTC.SHEETS).map(function(key) { return OTC.SHEETS[key]; }),
    health: health,
    nextSteps: [
      'Open the spreadsheet and keep its sharing restricted.',
      'Run runHealthCheck_() and require ok: true.',
      'Deploy the project as a Web App that executes as you.'
    ]
  };
}

function existingAdminEmail_(users) {
  if (!users || users.getLastRow() <= 1) return '';
  const rows = users.getRange(
    2, 1, users.getLastRow() - 1, OTC.HEADERS.USERS.length
  ).getValues();
  for (let index = 0; index < rows.length; index++) {
    const email = cleanText_(rows[index][0], 200).toLowerCase();
    const role = cleanText_(rows[index][2], 20).toUpperCase();
    const active = rows[index][3] === true || normalize_(rows[index][3]) === 'true';
    if (email && role === 'ADMIN' && active) return email;
  }
  return '';
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  assertCompatibleHeaders_(sheet, headers);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#153B66')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);
  return sheet;
}

function assertCompatibleHeaders_(sheet, expected) {
  if (sheet.getMaxColumns() < expected.length) {
    throw new Error(
      'Schema mismatch in ' + sheet.getName() + ': expected at least ' +
      expected.length + ' columns.'
    );
  }
  const existing = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  const populated = existing.some(function(value) {
    return cleanText_(value, 200);
  });
  if (!populated) return;

  const mismatch = expected.findIndex(function(header, index) {
    return cleanText_(existing[index], 200) !== header;
  });
  if (mismatch >= 0) {
    throw new Error(
      'Schema mismatch in ' + sheet.getName() + ' column ' + (mismatch + 1) +
      '. Expected "' + expected[mismatch] + '" but found "' +
      cleanText_(existing[mismatch], 200) + '". Restore the expected header ' +
      'or follow the upgrading guide before running setup again.'
    );
  }
}

function applySheetFormats_(spreadsheet) {
  const leads = spreadsheet.getSheetByName(OTC.SHEETS.LEADS);
  const reservations = spreadsheet.getSheetByName(OTC.SHEETS.RESERVATIONS);
  const payments = spreadsheet.getSheetByName(OTC.SHEETS.PAYMENTS);
  const users = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  const templates = spreadsheet.getSheetByName(OTC.SHEETS.TEMPLATES);
  const driveLinks = spreadsheet.getSheetByName(OTC.SHEETS.DRIVE_LINKS);
  const calendarEvents = spreadsheet.getSheetByName(OTC.SHEETS.CALENDAR_EVENTS);

  leads.getRange('J2:K').setNumberFormat('#,##0.00');
  leads.getRange('L2:M').setNumberFormat('dd/MM/yyyy');
  leads.getRange('O2:O').setNumberFormat('dd/MM/yyyy');
  reservations.getRange('F2:G').setNumberFormat('dd/MM/yyyy');
  payments.getRange('C2:C').setNumberFormat('dd/MM/yyyy');
  payments.getRange('D2:D').setNumberFormat('#,##0.00');
  users.getRange('D2:D').insertCheckboxes();
  templates.getRange('F2:F').insertCheckboxes();
  driveLinks.getRange('D2:E').setNumberFormat('dd/MM/yyyy HH:mm');
  calendarEvents.getRange('D2:D').setNumberFormat('dd/MM/yyyy');
  calendarEvents.getRange('E2:E').setNumberFormat('dd/MM/yyyy HH:mm');

  applyListValidation_(leads.getRange('G2:G'), OTC.OPTIONS.STATUSES);
  applyListValidation_(leads.getRange('H2:H'), OTC.OPTIONS.SERVICES);
  applyListValidation_(leads.getRange('F2:F'), OTC.OPTIONS.SOURCES);
  applyListValidation_(users.getRange('C2:C'), OTC.OPTIONS.ROLES);
  applyListValidation_(payments.getRange('E2:E'), OTC.OPTIONS.PAYMENT_METHODS);
  applyListValidation_(payments.getRange('H2:H'), ['ACTIVE', 'CANCELLED']);
  applyListValidation_(templates.getRange('C2:C'), OTC.OPTIONS.TEMPLATE_TYPES);

  [leads, reservations, payments, users, templates, driveLinks, calendarEvents].forEach(function(sheet) {
    sheet.autoResizeColumns(1, Math.min(sheet.getLastColumn(), 18));
    sheet.setColumnWidths(1, sheet.getLastColumn(), 145);
  });
}

function applyListValidation_(range, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

/**
 * Adds safe fictional data for screenshots and evaluation.
 */
function seedDemoData_() {
  if (getRuntimeConfig_().environment === 'production') {
    throw new Error(
      'Demo data is disabled in production. Use a dedicated demo environment.'
    );
  }
  const user = findActiveUserByEmail_(
    existingAdminEmail_(getCrmSheet_(OTC.SHEETS.USERS))
  );
  if (!user || user.role !== 'ADMIN') {
    throw new Error('An active administrator is required.');
  }
  const leads = getCrmSheet_(OTC.SHEETS.LEADS);
  if (leads.getLastRow() > 1) {
    throw new Error('Demo data can only be seeded into an empty LEADS sheet.');
  }
  const today = new Date();
  const examples = [
    ['DEMO-2026-0001', today, 'Amelia Rivera', '+34 600 000 101', user.email,
      'WEB', 'NEGOTIATION', 'FLIGHT', 'Ecuador', 1450, '',
      new Date(2026, 9, 4), new Date(2026, 9, 18), 2, today,
      'SEND_QUOTE', 'Fictional demo record', today],
    ['DEMO-2026-0002', today, 'Noah Martin', '+34 600 000 102', user.email,
      'REFERRAL', 'BOOKED_PENDING_PAYMENT', 'PACKAGE', 'Japan', 3200, 3200,
      new Date(2026, 10, 8), new Date(2026, 10, 20), 2, today,
      'CONFIRM_PAYMENT', 'Fictional demo record', today]
  ];
  leads.getRange(2, 1, examples.length, OTC.HEADERS.LEADS.length).setValues(examples);
  audit_(user, 'SEED_DEMO', 'SYSTEM', 'demo', 'Created fictional demo records.');
  return {ok: true, created: examples.length};
}

/**
 * Manual, read-only operational check. It is private to the Apps Script editor.
 */
function runHealthCheck_() {
  return buildHealthReport_(getCrmSpreadsheet_());
}

/**
 * Runs the read-only health report through the Apps Script Execution API.
 * This intentionally remains unavailable outside a configured staging
 * environment and requires an installation-specific secret.
 */
function runStagingAcceptance(stagingToken) {
  const config = getRuntimeConfig_();
  if (config.environment !== 'staging') {
    throw new Error('Remote acceptance is available only in staging.');
  }
  const expected = cleanText_(
    PropertiesService.getScriptProperties()
      .getProperty(OTC.PROPERTIES.STAGING_TOKEN),
    300
  );
  const provided = cleanText_(stagingToken, 300);
  if (
    expected.length < 32 ||
    provided.length < 32 ||
    !safeSignatureEquals_(signature_(expected), signature_(provided))
  ) {
    throw new Error('Invalid staging acceptance token.');
  }
  const report = runHealthCheck_();
  return {
    ok: report.ok,
    environment: config.environment,
    version: report.version,
    schemaVersion: report.schemaVersion,
    checkedAt: report.checkedAt,
    checks: report.checks
  };
}

function buildHealthReport_(spreadsheet) {
  const checks = [];
  Object.keys(OTC.SHEETS).forEach(function(key) {
    const name = OTC.SHEETS[key];
    const sheet = spreadsheet.getSheetByName(name);
    const expected = OTC.HEADERS[key];
    if (!sheet) {
      checks.push({name: 'sheet:' + name, ok: false, message: 'Missing sheet.'});
      return;
    }
    let schemaOk = true;
    try {
      assertCompatibleHeaders_(sheet, expected);
    } catch (error) {
      schemaOk = false;
    }
    checks.push({
      name: 'sheet:' + name,
      ok: schemaOk,
      message: schemaOk ? 'Present with compatible headers.' : 'Header mismatch.'
    });
  });

  const users = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  const activeAdmins = users ? countActiveAdmins_(users) : 0;
  checks.push({
    name: 'access:active-admin',
    ok: activeAdmins > 0,
    message: activeAdmins + ' active administrator(s).'
  });

  const configuredSchema = Number(
    PropertiesService.getScriptProperties()
      .getProperty(OTC.PROPERTIES.SCHEMA_VERSION) || 0
  );
  checks.push({
    name: 'schema:version',
    ok: configuredSchema === OTC.SCHEMA_VERSION,
    message: 'Configured ' + configuredSchema + '; code expects ' + OTC.SCHEMA_VERSION + '.'
  });

  [
    OTC.SHEETS.LEADS,
    OTC.SHEETS.RESERVATIONS,
    OTC.SHEETS.PAYMENTS,
    OTC.SHEETS.USERS,
    OTC.SHEETS.TEMPLATES,
    OTC.SHEETS.DRIVE_LINKS,
    OTC.SHEETS.CALENDAR_EVENTS
  ].forEach(function(name) {
    const sheet = spreadsheet.getSheetByName(name);
    const duplicates = sheet ? countDuplicateKeys_(sheet, 1) : 0;
    checks.push({
      name: 'data:unique:' + name,
      ok: duplicates === 0,
      message: duplicates + ' duplicate primary key(s).'
    });
  });

  const relationshipIssues = countRelationshipIssues_(spreadsheet);
  checks.push({
    name: 'data:relationships',
    ok: relationshipIssues.total === 0,
    message:
      relationshipIssues.orphanReservations + ' orphan reservation(s); ' +
      relationshipIssues.orphanPayments + ' orphan payment(s); ' +
      relationshipIssues.orphanDriveLinks + ' orphan Drive link(s); ' +
      relationshipIssues.orphanCalendarEvents + ' orphan calendar event(s); ' +
      relationshipIssues.unknownOwners + ' lead(s) with unknown owners.'
  });

  const configuredTimeZone = getRuntimeConfig_().timeZone;
  const spreadsheetTimeZone = spreadsheet.getSpreadsheetTimeZone();
  checks.push({
    name: 'configuration:time-zone',
    ok: configuredTimeZone === spreadsheetTimeZone,
    message:
      'Configured ' + configuredTimeZone + '; spreadsheet uses ' +
      spreadsheetTimeZone + '.'
  });
  checks.push({
    name: 'configuration:environment',
    ok: ['production', 'staging', 'demo'].indexOf(
      getRuntimeConfig_().environment
    ) >= 0,
    message: 'Environment is ' + getRuntimeConfig_().environment + '.'
  });

  return {
    ok: checks.every(function(check) { return check.ok; }),
    checkedAt: nowIso_(),
    version: OTC.VERSION,
    schemaVersion: OTC.SCHEMA_VERSION,
    checks: checks
  };
}

function countActiveAdmins_(users) {
  if (!users || users.getLastRow() <= 1) return 0;
  return users.getRange(
    2, 1, users.getLastRow() - 1, OTC.HEADERS.USERS.length
  ).getValues().filter(function(row) {
    const active = row[3] === true || normalize_(row[3]) === 'true';
    return active && cleanText_(row[2], 20).toUpperCase() === 'ADMIN';
  }).length;
}

function countDuplicateKeys_(sheet, column) {
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const seen = {};
  let duplicates = 0;
  sheet.getRange(
    2, column, sheet.getLastRow() - 1, 1
  ).getDisplayValues().forEach(function(row) {
    const key = cleanText_(row[0], 200).toLowerCase();
    if (!key) return;
    if (seen[key]) duplicates++;
    else seen[key] = true;
  });
  return duplicates;
}

function countRelationshipIssues_(spreadsheet) {
  const leads = spreadsheet.getSheetByName(OTC.SHEETS.LEADS);
  const reservations = spreadsheet.getSheetByName(OTC.SHEETS.RESERVATIONS);
  const payments = spreadsheet.getSheetByName(OTC.SHEETS.PAYMENTS);
  const users = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  const driveLinks = spreadsheet.getSheetByName(OTC.SHEETS.DRIVE_LINKS);
  const calendarEvents = spreadsheet.getSheetByName(OTC.SHEETS.CALENDAR_EVENTS);
  const leadIds = {};
  const userEmails = {};
  let unknownOwners = 0;

  if (users && users.getLastRow() > 1) {
    users.getRange(2, 1, users.getLastRow() - 1, 1)
      .getDisplayValues().forEach(function(row) {
        const email = cleanText_(row[0], 200).toLowerCase();
        if (email) userEmails[email] = true;
      });
  }
  if (leads && leads.getLastRow() > 1) {
    leads.getRange(2, 1, leads.getLastRow() - 1, 5)
      .getDisplayValues().forEach(function(row) {
        const id = cleanText_(row[0], 120);
        if (!id) return;
        leadIds[id] = true;
        const owner = cleanText_(row[4], 200).toLowerCase();
        if (!owner || !userEmails[owner]) unknownOwners++;
      });
  }

  function countOrphans_(sheet, leadColumn) {
    if (!sheet || sheet.getLastRow() <= 1) return 0;
    let count = 0;
    sheet.getRange(2, leadColumn, sheet.getLastRow() - 1, 1)
      .getDisplayValues().forEach(function(row) {
        const leadId = cleanText_(row[0], 120);
        if (leadId && !leadIds[leadId]) count++;
      });
    return count;
  }

  const orphanReservations = countOrphans_(reservations, 1);
  const orphanPayments = countOrphans_(payments, 2);
  const orphanDriveLinks = countOrphans_(driveLinks, 1);
  const orphanCalendarEvents = countOrphans_(calendarEvents, 1);
  return {
    orphanReservations: orphanReservations,
    orphanPayments: orphanPayments,
    orphanDriveLinks: orphanDriveLinks,
    orphanCalendarEvents: orphanCalendarEvents,
    unknownOwners: unknownOwners,
    total: orphanReservations + orphanPayments + orphanDriveLinks +
      orphanCalendarEvents + unknownOwners
  };
}
