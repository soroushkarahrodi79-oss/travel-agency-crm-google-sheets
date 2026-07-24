/**
 * Creates the five required sheets and the first administrator.
 * Set TRAVEL_CRM_SPREADSHEET_ID and TRAVEL_CRM_ADMIN_EMAIL in Script
 * Properties, then run this function manually from the Apps Script editor.
 */
function setupTravelCrm_() {
  const properties = PropertiesService.getScriptProperties();
  const id = cleanText_(
    properties.getProperty(OTC.PROPERTY_SPREADSHEET_ID),
    160
  );
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error(
      'Set a valid TRAVEL_CRM_SPREADSHEET_ID in Script Properties.'
    );
  }

  const spreadsheet = SpreadsheetApp.openById(id);
  const existingUsers = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  let email = cleanText_(
    properties.getProperty(OTC.PROPERTY_ADMIN_EMAIL),
    200
  ).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    email = existingUsers ? existingAdminEmail_(existingUsers) : '';
  }
  if (!email) {
    throw new Error(
      'Set a valid TRAVEL_CRM_ADMIN_EMAIL in Script Properties.'
    );
  }
  ensureAuthSecret_();

  ensureSheet_(spreadsheet, OTC.SHEETS.LEADS, OTC.HEADERS.LEADS);
  ensureSheet_(spreadsheet, OTC.SHEETS.RESERVATIONS, OTC.HEADERS.RESERVATIONS);
  ensureSheet_(spreadsheet, OTC.SHEETS.PAYMENTS, OTC.HEADERS.PAYMENTS);
  ensureSheet_(spreadsheet, OTC.SHEETS.USERS, OTC.HEADERS.USERS);
  ensureSheet_(spreadsheet, OTC.SHEETS.AUDIT, OTC.HEADERS.AUDIT);
  applySheetFormats_(spreadsheet);

  const users = spreadsheet.getSheetByName(OTC.SHEETS.USERS);
  if (!findRowById_(users, 1, email)) {
    users.appendRow([email, 'Administrator', 'ADMIN', true, new Date()]);
  }
  properties.deleteProperty(OTC.PROPERTY_ADMIN_EMAIL);
  SpreadsheetApp.flush();
  return {
    ok: true,
    version: OTC.VERSION,
    spreadsheetName: spreadsheet.getName(),
    adminEmail: email,
    sheets: Object.keys(OTC.SHEETS).map(function(key) { return OTC.SHEETS[key]; })
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

function applySheetFormats_(spreadsheet) {
  const leads = spreadsheet.getSheetByName(OTC.SHEETS.LEADS);
  const reservations = spreadsheet.getSheetByName(OTC.SHEETS.RESERVATIONS);
  const payments = spreadsheet.getSheetByName(OTC.SHEETS.PAYMENTS);
  const users = spreadsheet.getSheetByName(OTC.SHEETS.USERS);

  leads.getRange('J2:K').setNumberFormat('#,##0.00');
  leads.getRange('L2:M').setNumberFormat('dd/MM/yyyy');
  leads.getRange('O2:O').setNumberFormat('dd/MM/yyyy');
  reservations.getRange('F2:G').setNumberFormat('dd/MM/yyyy');
  payments.getRange('C2:C').setNumberFormat('dd/MM/yyyy');
  payments.getRange('D2:D').setNumberFormat('#,##0.00');
  users.getRange('D2:D').insertCheckboxes();

  applyListValidation_(leads.getRange('G2:G'), OTC.OPTIONS.STATUSES);
  applyListValidation_(leads.getRange('H2:H'), OTC.OPTIONS.SERVICES);
  applyListValidation_(leads.getRange('F2:F'), OTC.OPTIONS.SOURCES);
  applyListValidation_(users.getRange('C2:C'), OTC.OPTIONS.ROLES);
  applyListValidation_(payments.getRange('E2:E'), OTC.OPTIONS.PAYMENT_METHODS);
  applyListValidation_(payments.getRange('H2:H'), ['ACTIVE', 'CANCELLED']);

  [leads, reservations, payments, users].forEach(function(sheet) {
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
