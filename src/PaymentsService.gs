function savePayment(token, input) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const data = input || {};
  const amount = money_(data.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > OTC.LIMITS.MAX_MONEY
  ) {
    throw new Error(
      'Payment amount must be greater than zero and no more than ' +
      OTC.LIMITS.MAX_MONEY + '.'
    );
  }
  if (!data.paymentDate) throw new Error(t_('Payment date is required.'));

  return withCrmLock_(function() {
    const lead = getLeadForMutation_(user, data.leadId);
    const sheet = getCrmSheet_(OTC.SHEETS.PAYMENTS);
    const requestedId = cleanText_(data.paymentId, 120);
    const existingRow = requestedId ? findRowById_(sheet, 1, requestedId) : 0;
    if (requestedId && !existingRow) throw new Error(t_('Payment not found.'));
    if (existingRow) {
      const existing = sheet.getRange(
        existingRow, 1, 1, OTC.HEADERS.PAYMENTS.length
      ).getValues()[0];
      if (cleanText_(existing[1], 120) !== lead.id) {
        throw new Error(t_('Payment does not belong to this lead.'));
      }
      if (cleanText_(existing[7], 30) === 'CANCELLED') {
        throw new Error(t_('A cancelled payment cannot be edited.'));
      }
    }

    const current = listPayments_(lead.id);
    const otherPaid = current.reduce(function(total, payment) {
      if (payment.status !== 'ACTIVE' || payment.id === requestedId) return total;
      return total + payment.amount;
    }, 0);
    const total = leadTotal_(lead);
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error(
        'Set a sale amount or budget greater than zero before adding payments.'
      );
    }
    if (otherPaid + amount > total + 0.01) {
      throw new Error(t_('Payment would exceed the sale total.'));
    }

    const now = new Date();
    const rowNumber = existingRow || firstFreeRow_(sheet, 1);
    const id = requestedId || nextPaymentId_();
    const createdAt = existingRow ? sheet.getRange(existingRow, 9).getValue() : now;
    sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.PAYMENTS.length).setValues([[
      id,
      lead.id,
      dateFromInput_(data.paymentDate),
      roundMoney_(amount),
      allowedOption_(data.method || 'OTHER', OTC.OPTIONS.PAYMENT_METHODS, 'payment method'),
      cellText_(data.reference, 160),
      cellText_(data.notes, 1000),
      'ACTIVE',
      createdAt,
      now,
      user.email,
      ''
    ]]);
    sheet.getRange(rowNumber, 3).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(rowNumber, 4).setNumberFormat('#,##0.00');
    audit_(
      user,
      existingRow ? 'UPDATE_PAYMENT' : 'CREATE_PAYMENT',
      'PAYMENT',
      id,
      'Lead: ' + lead.id + '; amount: ' + roundMoney_(amount)
    );
    syncLeadPaymentStatus_(lead.id, user);
    SpreadsheetApp.flush();
    return {ok: true, lead: getLeadForUser_(user, lead.id)};
  });
}

function cancelPayment(token, input) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const data = input || {};
  const paymentId = cleanText_(data.paymentId, 120);
  const reason = cleanText_(data.reason, 500);
  if (!paymentId || !reason) throw new Error(t_('Payment and cancellation reason are required.'));

  return withCrmLock_(function() {
    const lead = getLeadForMutation_(user, data.leadId);
    const sheet = getCrmSheet_(OTC.SHEETS.PAYMENTS);
    const rowNumber = findRowById_(sheet, 1, paymentId);
    if (!rowNumber) throw new Error(t_('Payment not found.'));
    const row = sheet.getRange(
      rowNumber, 1, 1, OTC.HEADERS.PAYMENTS.length
    ).getValues()[0];
    if (cleanText_(row[1], 120) !== lead.id) {
      throw new Error(t_('Payment does not belong to this lead.'));
    }
    if (cleanText_(row[7], 30) === 'CANCELLED') {
      throw new Error(t_('This payment is already cancelled.'));
    }
    sheet.getRange(rowNumber, 8).setValue('CANCELLED');
    sheet.getRange(rowNumber, 10).setValue(new Date());
    sheet.getRange(rowNumber, 11).setValue(user.email);
    sheet.getRange(rowNumber, 12).setValue(cellText_(reason, 500));
    audit_(user, 'CANCEL_PAYMENT', 'PAYMENT', paymentId, reason);
    syncLeadPaymentStatus_(lead.id, user);
    SpreadsheetApp.flush();
    return {ok: true, lead: getLeadForUser_(user, lead.id)};
  });
}

function listPayments_(leadId) {
  const sheet = getCrmSheet_(OTC.SHEETS.PAYMENTS);
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, OTC.HEADERS.PAYMENTS.length
  ).getValues().filter(function(row) {
    return cleanText_(row[1], 120) === cleanText_(leadId, 120);
  }).map(function(row) {
    return {
      id: cleanText_(row[0], 120),
      paymentDate: dateToIso_(row[2]),
      amount: roundMoney_(money_(row[3])),
      method: cleanText_(row[4], 50),
      reference: cleanText_(row[5], 160),
      notes: cleanText_(row[6], 1000),
      status: cleanText_(row[7], 30),
      cancellationReason: cleanText_(row[11], 500)
    };
  }).sort(function(a, b) {
    return String(b.paymentDate).localeCompare(String(a.paymentDate));
  });
}

function summarizePayments_(lead, payments) {
  const total = leadTotal_(lead);
  const paid = (payments || []).reduce(function(sum, payment) {
    return sum + (payment.status === 'ACTIVE' ? payment.amount : 0);
  }, 0);
  return {
    total: Number.isFinite(total) ? roundMoney_(total) : 0,
    paid: roundMoney_(paid),
    balance: Number.isFinite(total) ? roundMoney_(total - paid) : 0
  };
}

function getLeadForMutation_(user, leadId) {
  const sheet = getCrmSheet_(OTC.SHEETS.LEADS);
  const rowNumber = findRowById_(sheet, 1, leadId);
  if (!rowNumber) throw new Error(t_('Lead not found.'));
  const row = sheet.getRange(
    rowNumber, 1, 1, OTC.HEADERS.LEADS.length
  ).getValues()[0];
  assertLeadAccess_(user, row);
  return mapLeadRow_(row);
}

function nextPaymentId_() {
  return 'PAY-' +
    Utilities.formatDate(
      new Date(),
      getRuntimeConfig_().timeZone,
      'yyyyMMdd-HHmmss'
    ) +
    '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
}

function leadTotal_(lead) {
  const sale = money_(lead && lead.saleAmount);
  if (
    lead &&
    lead.saleAmount !== '' &&
    lead.saleAmount !== null &&
    lead.saleAmount !== undefined &&
    Number.isFinite(sale)
  ) return sale;
  const budget = money_(lead && lead.budget);
  return Number.isFinite(budget) ? budget : NaN;
}

function syncLeadPaymentStatus_(leadId, user) {
  const sheet = getCrmSheet_(OTC.SHEETS.LEADS);
  const rowNumber = findRowById_(sheet, 1, leadId);
  if (!rowNumber) return;
  const row = sheet.getRange(
    rowNumber, 1, 1, OTC.HEADERS.LEADS.length
  ).getValues()[0];
  const lead = mapLeadRow_(row);
  const summary = summarizePayments_(lead, listPayments_(lead.id));
  const current = cleanText_(row[6], 50);
  let next = current;
  if (
    current === 'BOOKED_PENDING_PAYMENT' &&
    summary.total > 0 &&
    summary.balance <= 0.01
  ) {
    next = 'CLOSED_WON';
  } else if (current === 'CLOSED_WON' && summary.balance > 0.01) {
    next = 'BOOKED_PENDING_PAYMENT';
  }
  if (next === current) return;
  sheet.getRange(rowNumber, 7).setValue(next);
  sheet.getRange(rowNumber, 18).setValue(new Date());
  audit_(
    user,
    'AUTO_UPDATE_STATUS',
    'LEAD',
    lead.id,
    'Payment balance changed status from ' + current + ' to ' + next + '.'
  );
}
