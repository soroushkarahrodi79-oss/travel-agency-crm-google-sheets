/**
 * Calendar follow-up events, one per lead, kept in sync with the lead's
 * Next follow-up field.
 *
 * The narrow calendar.events.owned OAuth scope covers only events the app
 * itself creates. That is intentionally the same reasoning as the drive.file
 * decision in DriveService.gs: the CRM never reads or lists events it did
 * not create, so approving this scope on install cannot leak the deployer's
 * personal calendar into the CRM.
 *
 * Sync is idempotent by lead ID. Each lead has at most one CRM-owned event,
 * recorded in the CALENDAR_EVENTS sheet:
 *
 *   - If a lead has a follow-up date and is still open, ensure exactly one
 *     event on that date exists.
 *   - If the follow-up date changed since the last sync, the existing event
 *     is moved rather than duplicated.
 *   - If the lead has no follow-up date, or is closed or lost, the linked
 *     event is deleted.
 *
 * This matches the idempotent contract the roadmap asked for: running sync
 * twice in a row is safe and creates no duplicates or drift.
 */
function syncFollowUpEvent(token, leadId) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const lead = getLeadForUser_(user, leadId);
  return withCrmLock_(function() { return syncLeadEvent_(user, lead); });
}

function getFollowUpEvent(token, leadId) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  getLeadForUser_(user, leadId);
  const link = calendarLinkFor_(leadId);
  if (!link.eventId) return {eventId: '', eventUrl: '', followUpDate: ''};
  return link;
}

function syncLeadEvent_(user, lead) {
  const link = calendarLinkFor_(lead.id);
  const wantsEvent = leadFollowUpIsSchedulable_(lead);
  const calendar = ensureCrmCalendar_();

  if (!wantsEvent) {
    if (link.eventId) deleteEventById_(calendar, link.eventId, lead.id, user);
    return {action: 'none', eventId: '', eventUrl: '', followUpDate: ''};
  }

  if (link.eventId && link.followUpDate === lead.nextFollowUp) {
    // Already synced to the right date; nothing to do. Idempotent.
    return {
      action: 'unchanged',
      eventId: link.eventId,
      eventUrl: link.eventUrl,
      followUpDate: link.followUpDate
    };
  }

  const title = calendarEventTitle_(lead);
  const description = calendarEventDescription_(lead);
  const eventDate = dateFromInput_(lead.nextFollowUp);
  let event = null;
  let action;

  if (link.eventId) {
    try {
      event = calendar.getEventById(link.eventId);
    } catch (error) {
      event = null;
    }
    if (event) {
      // Re-create as an all-day event on the new date rather than mutating
      // fields piecemeal, because CalendarApp cannot convert an all-day event
      // to a different all-day date in place without ambiguity.
      event.deleteEvent();
      event = null;
    }
    action = 'moved';
  } else {
    action = 'created';
  }

  event = calendar.createAllDayEvent(title, eventDate);
  event.setDescription(description);
  writeCalendarLink_(lead.id, event.getId(), lead.nextFollowUp, user);
  audit_(
    user,
    action === 'moved' ? 'MOVE_FOLLOW_UP_EVENT' : 'CREATE_FOLLOW_UP_EVENT',
    'LEAD', lead.id,
    'Follow-up event on ' + lead.nextFollowUp + '.'
  );
  SpreadsheetApp.flush();
  return {
    action: action,
    eventId: event.getId(),
    eventUrl: eventUrlFor_(event),
    followUpDate: lead.nextFollowUp
  };
}

function deleteEventById_(calendar, eventId, leadId, user) {
  let event = null;
  try {
    event = calendar.getEventById(eventId);
  } catch (error) {
    event = null;
  }
  if (event) event.deleteEvent();
  removeCalendarLink_(leadId);
  audit_(
    user, 'DELETE_FOLLOW_UP_EVENT', 'LEAD', leadId,
    'Follow-up event removed.'
  );
  SpreadsheetApp.flush();
}

function leadFollowUpIsSchedulable_(lead) {
  if (!lead.nextFollowUp) return false;
  const status = cleanText_(lead.status, 50);
  if (status === 'CLOSED_WON' || status === 'LOST') return false;
  return true;
}

function calendarEventTitle_(lead) {
  const runtime = getRuntimeConfig_();
  return cleanText_(runtime.appName + ' · ' + lead.name, 200);
}

function calendarEventDescription_(lead) {
  const parts = [
    'Lead: ' + lead.id,
    lead.destination ? 'Destination: ' + lead.destination : '',
    lead.nextAction ? 'Next action: ' + lead.nextAction : '',
    lead.agentEmail ? 'Owner: ' + lead.agentEmail : ''
  ].filter(function(part) { return part; });
  return parts.join('\n');
}

function calendarLinkFor_(leadId) {
  const sheet = getCrmSheet_(OTC.SHEETS.CALENDAR_EVENTS);
  const rowNumber = findRowById_(sheet, 1, leadId);
  if (!rowNumber) return {eventId: '', eventUrl: '', followUpDate: ''};
  const row = sheet.getRange(
    rowNumber, 1, 1, OTC.HEADERS.CALENDAR_EVENTS.length
  ).getValues()[0];
  return {
    eventId: cleanText_(row[1], 300),
    eventUrl: cleanText_(row[2], 500),
    followUpDate: dateToIso_(row[3])
  };
}

function writeCalendarLink_(leadId, eventId, followUpDate, user) {
  const sheet = getCrmSheet_(OTC.SHEETS.CALENDAR_EVENTS);
  const existingRow = findRowById_(sheet, 1, leadId);
  const rowNumber = existingRow || firstFreeRow_(sheet, 1);
  const followUpValue = followUpDate ? dateFromInput_(followUpDate) : '';
  sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.CALENDAR_EVENTS.length).setValues([[
    leadId,
    eventId,
    'https://calendar.google.com/calendar/u/0/r/eventedit/' + eventId,
    followUpValue,
    new Date(),
    user.email
  ]]);
  sheet.getRange(rowNumber, 4).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(rowNumber, 5).setNumberFormat('dd/MM/yyyy HH:mm');
}

function removeCalendarLink_(leadId) {
  const sheet = getCrmSheet_(OTC.SHEETS.CALENDAR_EVENTS);
  const rowNumber = findRowById_(sheet, 1, leadId);
  if (!rowNumber) return;
  sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.CALENDAR_EVENTS.length)
    .setValues([['', '', '', '', '', '']]);
}

function eventUrlFor_(event) {
  return 'https://calendar.google.com/calendar/u/0/r/eventedit/' + event.getId();
}

/**
 * Resolves the calendar the CRM writes to. Deployers can pin a specific
 * calendar via TRAVEL_CRM_CALENDAR_ID; otherwise the executing account's
 * default calendar is used, matching how other resources (spreadsheet,
 * Drive root) default to the deployment owner's context.
 */
function ensureCrmCalendar_() {
  const configured = cleanText_(
    PropertiesService.getScriptProperties()
      .getProperty(OTC.PROPERTIES.CALENDAR_ID),
    200
  );
  if (configured) {
    const calendar = CalendarApp.getCalendarById(configured);
    if (calendar) return calendar;
    // Fall through if the configured calendar is missing rather than crash.
  }
  return CalendarApp.getDefaultCalendar();
}
