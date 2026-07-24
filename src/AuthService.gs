function requestAccessCode(emailValue) {
  cleanupExpiredAuth_();
  const email = cleanText_(emailValue, 200).toLowerCase();
  const generic = {
    ok: true,
    message: 'If the account is active, an access code has been sent.',
    expiresInMinutes: OTC.AUTH.OTP_TTL_MS / 60000
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic;

  const user = findActiveUserByEmail_(email);
  if (!user) return generic;

  const properties = PropertiesService.getScriptProperties();
  const key = otpKey_(email);
  const previousText = properties.getProperty(key);
  if (previousText) {
    try {
      const previous = JSON.parse(previousText);
      if (Date.now() - Number(previous.requestedAt || 0) < OTC.AUTH.RESEND_DELAY_MS) {
        return generic;
      }
    } catch (error) {}
  }
  if (!consumeEmailQuota_(properties, email)) return generic;

  const code = generateOtp_();
  properties.setProperty(key, JSON.stringify({
    email: email,
    codeSignature: signature_(email + ':' + code),
    requestedAt: Date.now(),
    expiresAt: Date.now() + OTC.AUTH.OTP_TTL_MS,
    attempts: 0
  }));

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Your Open Travel CRM access code',
      name: 'Open Travel CRM',
      htmlBody:
        '<div style="font-family:Arial,sans-serif;max-width:520px">' +
        '<h2 style="color:#12385f">Open Travel CRM</h2>' +
        '<p>Your one-time access code is:</p>' +
        '<div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#12385f">' +
        code +
        '</div><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>' +
        '</div>'
    });
  } catch (error) {
    properties.deleteProperty(key);
    throw new Error('The access email could not be sent. Contact an administrator.');
  }
  return generic;
}

function verifyAccessCode(emailValue, codeValue) {
  const email = cleanText_(emailValue, 200).toLowerCase();
  const code = cleanText_(codeValue, 20);
  const properties = PropertiesService.getScriptProperties();
  const key = otpKey_(email);
  const stored = properties.getProperty(key);
  if (!stored) throw new Error('The code is invalid or expired.');

  let record;
  try {
    record = JSON.parse(stored);
  } catch (error) {
    properties.deleteProperty(key);
    throw new Error('The code is invalid or expired.');
  }
  if (Number(record.expiresAt || 0) <= Date.now()) {
    properties.deleteProperty(key);
    throw new Error('The code has expired.');
  }
  record.attempts = Number(record.attempts || 0) + 1;
  if (record.attempts > OTC.AUTH.MAX_ATTEMPTS) {
    properties.deleteProperty(key);
    throw new Error('Too many attempts. Request a new code.');
  }
  if (record.codeSignature !== signature_(email + ':' + code)) {
    properties.setProperty(key, JSON.stringify(record));
    throw new Error('The code is invalid or expired.');
  }

  const user = findActiveUserByEmail_(email);
  if (!user) {
    properties.deleteProperty(key);
    throw new Error('The account is disabled or no longer registered.');
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  properties.setProperty(sessionKey_(token), JSON.stringify({
    email: user.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + OTC.AUTH.SESSION_TTL_MS
  }));
  properties.deleteProperty(key);
  audit_(user, 'SIGN_IN', 'SESSION', 'web', 'Successful OTP sign-in.');
  return {ok: true, token: token, user: publicUser_(user)};
}

function signOut(token) {
  const value = cleanText_(token, 200);
  if (value) {
    PropertiesService.getScriptProperties().deleteProperty(sessionKey_(value));
  }
  return {ok: true};
}

function generateOtp_() {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid()
  );
  let number = 0;
  for (let index = 0; index < 6; index++) {
    number = (number * 256 + ((bytes[index] + 256) % 256)) % 900000;
  }
  return String(100000 + number).padStart(6, '0');
}

function consumeEmailQuota_(properties, email) {
  const key = rateKey_(email);
  const now = Date.now();
  let record = {windowStartedAt: now, count: 0};
  try {
    record = JSON.parse(properties.getProperty(key) || JSON.stringify(record));
  } catch (error) {}
  if (now - Number(record.windowStartedAt || 0) >= OTC.AUTH.RATE_WINDOW_MS) {
    record = {windowStartedAt: now, count: 0};
  }
  if (Number(record.count || 0) >= OTC.AUTH.MAX_EMAILS_PER_WINDOW) return false;
  record.count = Number(record.count || 0) + 1;
  record.expiresAt = Number(record.windowStartedAt) + OTC.AUTH.RATE_WINDOW_MS;
  properties.setProperty(key, JSON.stringify(record));
  return true;
}

function cleanupExpiredAuth_() {
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(function(key) {
    if (
      key.indexOf(OTC.AUTH.OTP_PREFIX) !== 0 &&
      key.indexOf(OTC.AUTH.SESSION_PREFIX) !== 0 &&
      key.indexOf(OTC.AUTH.RATE_PREFIX) !== 0
    ) return;
    try {
      const record = JSON.parse(all[key]);
      if (Number(record.expiresAt || 0) <= now) properties.deleteProperty(key);
    } catch (error) {
      properties.deleteProperty(key);
    }
  });
}
