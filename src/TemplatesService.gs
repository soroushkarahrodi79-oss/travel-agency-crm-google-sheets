/**
 * Reusable quote and customer-email templates.
 *
 * Templates are shared across the agency and administrator-managed. A
 * template that stops being used is set inactive rather than deleted,
 * mirroring how USERS are disabled and payments are cancelled elsewhere in
 * this app: past renders stay explainable instead of pointing at a row that
 * no longer exists.
 */
function listTemplates(token) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const sheet = getCrmSheet_(OTC.SHEETS.TEMPLATES);
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, OTC.HEADERS.TEMPLATES.length
  ).getValues()
    .map(mapTemplateRow_)
    .filter(function(template) {
      return user.role === 'ADMIN' || template.active;
    })
    .sort(function(left, right) { return left.name.localeCompare(right.name); });
}

function saveTemplate(token, input) {
  const user = requireUser_(token, ['ADMIN']);
  const data = input || {};
  const name = cleanText_(data.name, OTC.LIMITS.MAX_TEMPLATE_NAME);
  if (!name) throw new Error(t_('Template name is required.'));
  const type = allowedOption_(
    data.type || 'EMAIL', OTC.OPTIONS.TEMPLATE_TYPES, 'template type'
  );
  const body = cleanText_(data.body, OTC.LIMITS.MAX_TEMPLATE_BODY);
  if (!body) throw new Error(t_('Template body is required.'));
  const subject = cleanText_(data.subject, OTC.LIMITS.MAX_TEMPLATE_SUBJECT);
  const active = data.active !== false;

  return withCrmLock_(function() {
    const sheet = getCrmSheet_(OTC.SHEETS.TEMPLATES);
    const requestedId = cleanText_(data.id, 120);
    const existingRow = requestedId ? findRowById_(sheet, 1, requestedId) : 0;
    if (requestedId && !existingRow) throw new Error(t_('Template not found.'));
    const id = existingRow ? requestedId : nextTemplateId_(sheet);
    const rowNumber = existingRow || firstFreeRow_(sheet, 1);

    sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.TEMPLATES.length).setValues([[
      id,
      name,
      type,
      cellText_(subject, OTC.LIMITS.MAX_TEMPLATE_SUBJECT),
      cellText_(body, OTC.LIMITS.MAX_TEMPLATE_BODY),
      active,
      new Date(),
      user.email
    ]]);
    audit_(
      user,
      existingRow ? 'UPDATE_TEMPLATE' : 'CREATE_TEMPLATE',
      'TEMPLATE',
      id,
      'Name: ' + name + '; type: ' + type + '; active: ' + active
    );
    SpreadsheetApp.flush();
    return {ok: true, template: getTemplateById_(id)};
  });
}

/**
 * Renders a template's subject and body against a lead's current data.
 *
 * Ownership follows the same rule as opening the lead itself: an agent can
 * only render templates for their own leads. An inactive template can still
 * be rendered by an administrator (to review or reactivate it) but is
 * otherwise treated as not found, matching what listTemplates already hides.
 */
function renderLeadTemplate(token, leadId, templateId) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const lead = getLeadForUser_(user, leadId);
  const template = getTemplateById_(templateId);
  if (!template || (!template.active && user.role !== 'ADMIN')) {
    throw new Error(t_('Template not found.'));
  }
  const context = templateContext_(user, lead);
  return {
    id: template.id,
    name: template.name,
    type: template.type,
    subject: renderTemplateText_(template.subject, context),
    body: renderTemplateText_(template.body, context)
  };
}

function getTemplateById_(templateId) {
  const sheet = getCrmSheet_(OTC.SHEETS.TEMPLATES);
  const rowNumber = findRowById_(sheet, 1, templateId);
  if (!rowNumber) return null;
  return mapTemplateRow_(
    sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.TEMPLATES.length).getValues()[0]
  );
}

function mapTemplateRow_(row) {
  return {
    id: cleanText_(row[0], 120),
    name: cleanText_(row[1], OTC.LIMITS.MAX_TEMPLATE_NAME),
    type: cleanText_(row[2], 20),
    subject: cleanText_(row[3], OTC.LIMITS.MAX_TEMPLATE_SUBJECT),
    body: cleanText_(row[4], OTC.LIMITS.MAX_TEMPLATE_BODY),
    active: row[5] === true || normalize_(row[5]) === 'true',
    updatedAt: row[6] instanceof Date ? row[6].toISOString() : cleanText_(row[6], 40),
    updatedBy: cleanText_(row[7], 200)
  };
}

function nextTemplateId_(sheet) {
  let max = 0;
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
      .forEach(function(row) {
        const match = cleanText_(row[0], 120).match(/^TPL-(\d+)$/);
        if (match) max = Math.max(max, Number(match[1]));
      });
  }
  return 'TPL-' + String(max + 1).padStart(4, '0');
}

/**
 * Placeholder values available to a rendered template. Kept flat ({{name}},
 * not {{lead.name}}) so the syntax stays approachable for a non-technical
 * agent, and limited to what a customer could see on a quote or email: no
 * internal identifiers, emails other than the acting agent's, or audit data.
 */
function templateContext_(user, lead) {
  const runtime = getRuntimeConfig_();
  const summary = lead.paymentSummary || {};
  return {
    name: lead.name || '',
    phone: lead.phone || '',
    destination: lead.destination || '',
    service: lead.service || '',
    travelStart: lead.travelStart || '',
    travelEnd: lead.travelEnd || '',
    passengers: lead.passengers === '' ? '' : String(lead.passengers),
    nextAction: lead.nextAction || '',
    budget: formatMoney_(lead.budget),
    saleAmount: formatMoney_(lead.saleAmount),
    total: formatMoney_(summary.total),
    paid: formatMoney_(summary.paid),
    balance: formatMoney_(summary.balance),
    agentName: user.displayName,
    agentEmail: user.email,
    appName: runtime.appName,
    today: dateToIso_(new Date())
  };
}

/**
 * Substitutes {{token}} placeholders. An unrecognised token is left exactly
 * as written rather than erased, so a typo shows up as visible garbage an
 * agent will notice before it reaches a customer, instead of silently
 * disappearing.
 */
function renderTemplateText_(text, context) {
  return String(text || '').replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    function(match, key) {
      return Object.prototype.hasOwnProperty.call(context, key)
        ? String(context[key])
        : match;
    }
  );
}
