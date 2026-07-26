function requireUser_(token, allowedRoles) {
  const value = cleanText_(token, 200);
  if (value.length < 50) throw new Error(t_('Your session is missing or invalid.'));

  const properties = PropertiesService.getScriptProperties();
  const key = sessionKey_(value);
  const stored = properties.getProperty(key);
  if (!stored) throw new Error(t_('Your session has expired. Sign in again.'));

  let session;
  try {
    session = JSON.parse(stored);
  } catch (error) {
    properties.deleteProperty(key);
    throw new Error(t_('Your session is invalid. Sign in again.'));
  }
  if (!session.expiresAt || Number(session.expiresAt) <= Date.now()) {
    properties.deleteProperty(key);
    throw new Error(t_('Your session has expired. Sign in again.'));
  }

  const user = findActiveUserByEmail_(session.email);
  if (!user) {
    properties.deleteProperty(key);
    throw new Error(t_('Your CRM account is disabled or no longer registered.'));
  }
  if (allowedRoles && allowedRoles.indexOf(user.role) === -1) {
    throw new Error(t_('You do not have permission for this action.'));
  }

  return user;
}

function findActiveUserByEmail_(emailValue) {
  const email = cleanText_(emailValue, 200).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const users = getCrmSheet_(OTC.SHEETS.USERS);
  const row = findRowById_(users, 1, email);
  if (!row) return null;
  const values = users.getRange(row, 1, 1, OTC.HEADERS.USERS.length).getValues()[0];
  const active = values[3] === true || normalize_(values[3]) === 'true';
  const role = cleanText_(values[2], 20).toUpperCase();
  if (!active || OTC.OPTIONS.ROLES.indexOf(role) === -1) return null;
  return {
    email: email,
    displayName: cleanText_(values[1], 120) || email,
    role: role
  };
}

function assertLeadAccess_(user, leadRow) {
  if (user.role === 'ADMIN') return;
  const owner = cleanText_(leadRow[4], 200).toLowerCase();
  if (owner !== user.email) throw new Error(t_('This lead belongs to another agent.'));
}

function audit_(user, action, entityType, entityId, details) {
  const sheet = getCrmSheet_(OTC.SHEETS.AUDIT);
  sheet.appendRow([
    new Date(),
    cleanText_(user && user.email, 200),
    cleanText_(action, 80),
    cleanText_(entityType, 80),
    cleanText_(entityId, 120),
    cellText_(details, 1000)
  ]);
}

function publicUser_(user) {
  return {
    email: user.email,
    displayName: user.displayName,
    role: user.role
  };
}

function ensureAuthSecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty(OTC.AUTH.SECRET_PROPERTY);
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty(OTC.AUTH.SECRET_PROPERTY, secret);
  }
  return secret;
}

function signature_(text) {
  return Utilities.computeHmacSha256Signature(
    String(text || ''),
    ensureAuthSecret_()
  ).map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function otpKey_(email) {
  return OTC.AUTH.OTP_PREFIX + signature_(normalize_(email)).substring(0, 40);
}

function sessionKey_(token) {
  return OTC.AUTH.SESSION_PREFIX + signature_(token).substring(0, 48);
}

function rateKey_(email) {
  return OTC.AUTH.RATE_PREFIX + signature_(normalize_(email)).substring(0, 40);
}

function invalidateUserSessions_(emailValue) {
  const email = cleanText_(emailValue, 200).toLowerCase();
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  let invalidated = 0;
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(OTC.AUTH.SESSION_PREFIX) !== 0) return;
    try {
      const session = JSON.parse(all[key]);
      if (cleanText_(session.email, 200).toLowerCase() === email) {
        properties.deleteProperty(key);
        invalidated++;
      }
    } catch (error) {
      properties.deleteProperty(key);
    }
  });
  return invalidated;
}
