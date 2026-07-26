/**
 * Administrator-only user lifecycle operations.
 * Users are retained for auditability and can be disabled instead of deleted.
 */
function listUsers(token) {
  requireUser_(token, ['ADMIN']);
  const sheet = getCrmSheet_(OTC.SHEETS.USERS);
  if (sheet.getLastRow() <= 1) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, OTC.HEADERS.USERS.length
  ).getValues().filter(function(row) {
    return cleanText_(row[0], 200);
  }).map(mapUserRow_).sort(function(left, right) {
    if (left.active !== right.active) return left.active ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });
}

function saveUser(token, input) {
  const actor = requireUser_(token, ['ADMIN']);
  const data = input || {};
  const email = cleanText_(data.email, 200).toLowerCase();
  const displayName = cleanText_(data.displayName, 120);
  const role = allowedOption_(data.role || 'AGENT', OTC.OPTIONS.ROLES, 'role');
  const active = data.active !== false && normalize_(data.active) !== 'false';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid user email.');
  }
  if (!displayName) throw new Error('Display name is required.');

  return withCrmLock_(function() {
    const sheet = getCrmSheet_(OTC.SHEETS.USERS);
    const existingRow = findRowById_(sheet, 1, email);
    const previous = existingRow ? sheet.getRange(
      existingRow, 1, 1, OTC.HEADERS.USERS.length
    ).getValues()[0] : null;

    if (email === actor.email && (!active || role !== 'ADMIN')) {
      throw new Error('You cannot change your own administrator access.');
    }
    if (previous && isActiveAdminRow_(previous) && (role !== 'ADMIN' || !active)) {
      if (countActiveAdmins_(sheet) <= 1) {
        throw new Error('The CRM must retain at least one active administrator.');
      }
    }

    const rowNumber = existingRow || firstFreeRow_(sheet, 1);
    const createdAt = previous && previous[4] ? previous[4] : new Date();
    sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.USERS.length).setValues([[
      email,
      cellText_(displayName, 120),
      role,
      active,
      createdAt
    ]]);

    let invalidated = 0;
    if (
      previous &&
      (
        !active ||
        cleanText_(previous[2], 20).toUpperCase() !== role
      )
    ) {
      invalidated = invalidateUserSessions_(email);
    }

    audit_(
      actor,
      existingRow ? 'UPDATE_USER' : 'CREATE_USER',
      'USER',
      email,
      'Role: ' + role + '; active: ' + active +
      '; invalidated sessions: ' + invalidated
    );
    SpreadsheetApp.flush();
    return {
      ok: true,
      user: mapUserRow_([email, displayName, role, active, createdAt])
    };
  });
}

function mapUserRow_(row) {
  return {
    email: cleanText_(row[0], 200).toLowerCase(),
    displayName: cleanText_(row[1], 120),
    role: cleanText_(row[2], 20).toUpperCase(),
    active: row[3] === true || normalize_(row[3]) === 'true',
    createdAt: row[4] instanceof Date
      ? row[4].toISOString()
      : cleanText_(row[4], 40)
  };
}

function isActiveAdminRow_(row) {
  return (
    (row[3] === true || normalize_(row[3]) === 'true') &&
    cleanText_(row[2], 20).toUpperCase() === 'ADMIN'
  );
}
