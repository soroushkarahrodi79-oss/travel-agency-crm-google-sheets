function getDashboard(token) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const rows = accessibleLeadRows_(user);
  const byStatus = {};
  OTC.OPTIONS.STATUSES.forEach(function(status) { byStatus[status] = 0; });
  let pipeline = 0;
  let sales = 0;
  rows.forEach(function(row) {
    const status = cleanText_(row[6], 50);
    byStatus[status] = (byStatus[status] || 0) + 1;
    const budget = money_(row[9]);
    const sale = money_(row[10]);
    if (Number.isFinite(budget)) pipeline += budget;
    if (Number.isFinite(sale)) sales += sale;
  });
  return {
    total: rows.length,
    pipeline: roundMoney_(pipeline),
    sales: roundMoney_(sales),
    byStatus: byStatus,
    recent: rows.slice(-6).reverse().map(mapLeadRow_)
  };
}

function searchLeads(token, query, limit) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const needle = normalize_(query);
  const max = Math.min(Math.max(Number(limit) || 30, 1), 100);
  return accessibleLeadRows_(user)
    .filter(function(row) {
      if (!needle) return true;
      return [row[0], row[2], row[3], row[6], row[7], row[8], row[15]]
        .some(function(value) { return normalize_(value).indexOf(needle) >= 0; });
    })
    .slice(-max)
    .reverse()
    .map(mapLeadRow_);
}

function getLead(token, leadId) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  return getLeadForUser_(user, leadId);
}

function getLeadForUser_(user, leadId) {
  const leads = getCrmSheet_(OTC.SHEETS.LEADS);
  const rowNumber = findRowById_(leads, 1, leadId);
  if (!rowNumber) throw new Error('Lead not found.');
  const row = leads.getRange(rowNumber, 1, 1, OTC.HEADERS.LEADS.length).getValues()[0];
  assertLeadAccess_(user, row);
  const lead = mapLeadRow_(row);
  lead.reservation = getReservation_(lead.id);
  lead.payments = listPayments_(lead.id);
  lead.paymentSummary = summarizePayments_(lead, lead.payments);
  return lead;
}

function saveLead(token, input) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const data = input || {};
  validateLeadInput_(data);

  return withCrmLock_(function() {
    const leads = getCrmSheet_(OTC.SHEETS.LEADS);
    const requestedId = cleanText_(data.id, 120);
    const existingRow = requestedId ? findRowById_(leads, 1, requestedId) : 0;
    const now = new Date();
    let rowNumber = existingRow;
    let id = requestedId;
    let createdAt = now;

    if (existingRow) {
      const existing = leads.getRange(
        existingRow, 1, 1, OTC.HEADERS.LEADS.length
      ).getValues()[0];
      assertLeadAccess_(user, existing);
      createdAt = existing[1] || now;
    } else {
      id = nextLeadId_(leads);
      rowNumber = firstFreeRow_(leads, 1);
    }

    const owner = resolveOwnerEmail_(user, data.agentEmail);
    const saleAmount = optionalMoney_(data.saleAmount, 'Sale amount');
    const budget = optionalMoney_(data.budget, 'Budget');
    let status = allowedOption_(data.status || 'NEW', OTC.OPTIONS.STATUSES, 'status');
    if (status === 'CLOSED_WON' && Number.isFinite(saleAmount)) {
      const summary = summarizePayments_(
        {saleAmount: saleAmount, budget: budget},
        listPayments_(id)
      );
      if (summary.balance > 0.01) status = 'BOOKED_PENDING_PAYMENT';
    }

    const row = [
      id,
      createdAt,
      cellText_(data.name, 160),
      cellText_(data.phone, 60),
      owner,
      allowedOption_(data.source || 'OTHER', OTC.OPTIONS.SOURCES, 'source'),
      status,
      allowedOption_(data.service || 'OTHER', OTC.OPTIONS.SERVICES, 'service'),
      cellText_(data.destination, 120),
      Number.isFinite(budget) ? budget : '',
      Number.isFinite(saleAmount) ? saleAmount : '',
      data.travelStart ? dateFromInput_(data.travelStart) : '',
      data.travelEnd ? dateFromInput_(data.travelEnd) : '',
      data.passengers ? positiveInteger_(data.passengers, 'Passengers') : '',
      data.nextFollowUp ? dateFromInput_(data.nextFollowUp) : '',
      cellText_(data.nextAction, 160),
      cellText_(data.notes, 2000),
      now
    ];

    leads.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    leads.getRange(rowNumber, 10, 1, 2).setNumberFormat('#,##0.00');
    leads.getRange(rowNumber, 12, 1, 2).setNumberFormat('dd/MM/yyyy');
    leads.getRange(rowNumber, 15).setNumberFormat('dd/MM/yyyy');
    upsertReservation_(id, data, user);
    audit_(
      user,
      existingRow ? 'UPDATE_LEAD' : 'CREATE_LEAD',
      'LEAD',
      id,
      'Status: ' + status
    );
    SpreadsheetApp.flush();
    return {ok: true, lead: getLeadForUser_(user, id)};
  });
}

function accessibleLeadRows_(user) {
  const sheet = getCrmSheet_(OTC.SHEETS.LEADS);
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, OTC.HEADERS.LEADS.length
  ).getValues().filter(function(row) {
    if (!cleanText_(row[0], 120)) return false;
    return user.role === 'ADMIN' ||
      cleanText_(row[4], 200).toLowerCase() === user.email;
  });
}

function mapLeadRow_(row) {
  return {
    id: cleanText_(row[0], 120),
    createdAt: row[1] instanceof Date ? row[1].toISOString() : cleanText_(row[1], 40),
    name: cleanText_(row[2], 160),
    phone: cleanText_(row[3], 60),
    agentEmail: cleanText_(row[4], 200),
    source: cleanText_(row[5], 50),
    status: cleanText_(row[6], 50),
    service: cleanText_(row[7], 50),
    destination: cleanText_(row[8], 120),
    budget: finiteOrBlank_(money_(row[9])),
    saleAmount: finiteOrBlank_(money_(row[10])),
    travelStart: dateToIso_(row[11]),
    travelEnd: dateToIso_(row[12]),
    passengers: row[13] === '' ? '' : Number(row[13]),
    nextFollowUp: dateToIso_(row[14]),
    nextAction: cleanText_(row[15], 160),
    notes: cleanText_(row[16], 2000),
    updatedAt: row[17] instanceof Date ? row[17].toISOString() : cleanText_(row[17], 40)
  };
}

function validateLeadInput_(data) {
  if (!cleanText_(data.name, 160)) throw new Error('Name is required.');
  if (cleanText_(data.phone, 60).replace(/\D/g, '').length < 7) {
    throw new Error('Phone must contain at least seven digits.');
  }
  if (data.travelStart && data.travelEnd) {
    if (dateFromInput_(data.travelEnd).getTime() < dateFromInput_(data.travelStart).getTime()) {
      throw new Error('Travel end cannot be earlier than travel start.');
    }
  }
}

function resolveOwnerEmail_(user, requestedEmail) {
  if (user.role !== 'ADMIN') return user.email;
  const email = cleanText_(requestedEmail, 200).toLowerCase() || user.email;
  const users = getCrmSheet_(OTC.SHEETS.USERS);
  const row = findRowById_(users, 1, email);
  if (!row) throw new Error('Selected agent is not registered in USERS.');
  const active = users.getRange(row, 4).getValue();
  if (active !== true) throw new Error('Selected agent is disabled.');
  return email;
}

function nextLeadId_(sheet) {
  const year = Utilities.formatDate(new Date(), OTC.TIME_ZONE, 'yyyy');
  let max = 0;
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
      .forEach(function(row) {
        const match = cleanText_(row[0], 120).match(
          new RegExp('^TRV-' + year + '-(\\d+)$')
        );
        if (match) max = Math.max(max, Number(match[1]));
      });
  }
  return 'TRV-' + year + '-' + String(max + 1).padStart(4, '0');
}

function allowedOption_(value, options, fieldName) {
  const text = cleanText_(value, 80).toUpperCase();
  if (options.indexOf(text) === -1) {
    throw new Error('Invalid ' + fieldName + '.');
  }
  return text;
}

function optionalMoney_(value, label) {
  if (value === '' || value === null || value === undefined) return NaN;
  const number = money_(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(label + ' must be zero or greater.');
  }
  return roundMoney_(number);
}

function positiveInteger_(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(label + ' must be a positive integer.');
  }
  return number;
}

function finiteOrBlank_(value) {
  return Number.isFinite(value) ? value : '';
}

function roundMoney_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function listAgentEmails_() {
  const sheet = getCrmSheet_(OTC.SHEETS.USERS);
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues()
    .filter(function(row) { return row[3] === true; })
    .map(function(row) {
      return {email: cleanText_(row[0], 200), name: cleanText_(row[1], 120)};
    });
}
