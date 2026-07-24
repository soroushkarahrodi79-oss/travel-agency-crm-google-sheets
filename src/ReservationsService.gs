function getReservation_(leadId) {
  const sheet = getCrmSheet_(OTC.SHEETS.RESERVATIONS);
  const rowNumber = findRowById_(sheet, 1, leadId);
  if (!rowNumber) {
    return {
      provider: '', locator: '', route: '', destination: '',
      travelStart: '', travelEnd: ''
    };
  }
  const row = sheet.getRange(
    rowNumber, 1, 1, OTC.HEADERS.RESERVATIONS.length
  ).getValues()[0];
  return {
    provider: cleanText_(row[1], 160),
    locator: cleanText_(row[2], 120),
    route: cleanText_(row[3], 200),
    destination: cleanText_(row[4], 120),
    travelStart: dateToIso_(row[5]),
    travelEnd: dateToIso_(row[6])
  };
}

function upsertReservation_(leadId, data, user) {
  const sheet = getCrmSheet_(OTC.SHEETS.RESERVATIONS);
  const existingRow = findRowById_(sheet, 1, leadId);
  const rowNumber = existingRow || firstFreeRow_(sheet, 1);
  sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.RESERVATIONS.length).setValues([[
    leadId,
    cellText_(data.provider, 160),
    cellText_(data.locator, 120),
    cellText_(data.route, 200),
    cellText_(data.destination, 120),
    data.travelStart ? dateFromInput_(data.travelStart) : '',
    data.travelEnd ? dateFromInput_(data.travelEnd) : '',
    new Date(),
    user.email
  ]]);
  sheet.getRange(rowNumber, 6, 1, 2).setNumberFormat('dd/MM/yyyy');
}
