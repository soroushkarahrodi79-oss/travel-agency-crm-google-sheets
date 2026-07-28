/**
 * A Google Drive folder per lead, created on request and never re-created.
 *
 * The CRM only creates the folder and remembers its link; it deliberately
 * does not enumerate the folder's contents. The narrow drive.file OAuth
 * scope grants the app visibility only into items it created itself, so a
 * document an agent later drags into that folder through Drive's own UI
 * would not reliably show up through this scope. Rather than build a file
 * listing that quietly misses files, the CRM stops at the folder link and
 * leaves document management inside it to Drive directly.
 */
function getLeadDriveFolder(token, leadId) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  getLeadForUser_(user, leadId); // Ownership check; the lead itself is unused.
  return driveLinkFor_(leadId);
}

/**
 * Idempotent: calling this again for a lead that already has a folder
 * returns the existing link rather than creating a second one.
 */
function createLeadDriveFolder(token, leadId) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  const lead = getLeadForUser_(user, leadId);
  return withCrmLock_(function() {
    const existing = driveLinkFor_(lead.id);
    if (existing.folderId) return existing;

    const root = ensureDriveRootFolder_();
    const folder = root.createFolder(driveFolderName_(lead));
    const sheet = getCrmSheet_(OTC.SHEETS.DRIVE_LINKS);
    const rowNumber = firstFreeRow_(sheet, 1);
    const now = new Date();
    sheet.getRange(rowNumber, 1, 1, OTC.HEADERS.DRIVE_LINKS.length).setValues([[
      lead.id, folder.getId(), folder.getUrl(), now, now, user.email
    ]]);
    audit_(
      user, 'CREATE_DRIVE_FOLDER', 'LEAD', lead.id,
      'Created a Drive folder for document storage.'
    );
    SpreadsheetApp.flush();
    return driveLinkFor_(lead.id);
  });
}

function driveLinkFor_(leadId) {
  const sheet = getCrmSheet_(OTC.SHEETS.DRIVE_LINKS);
  const rowNumber = findRowById_(sheet, 1, leadId);
  if (!rowNumber) return {folderId: '', folderUrl: ''};
  const row = sheet.getRange(
    rowNumber, 1, 1, OTC.HEADERS.DRIVE_LINKS.length
  ).getValues()[0];
  return {
    folderId: cleanText_(row[1], 200),
    folderUrl: cleanText_(row[2], 500)
  };
}

function driveFolderName_(lead) {
  return cleanText_(lead.id + ' - ' + lead.name, 200);
}

/**
 * Finds or creates the single top-level folder every lead folder lives
 * under. The id is cached in Script Properties to avoid a Drive search on
 * every call; if the cached folder was trashed or deleted, this falls back
 * to searching by name and creates it again if still missing. A folder this
 * script creates stays visible to it under the drive.file scope regardless
 * of which agent is signed in, since the Web App always executes as the
 * deployment owner.
 */
function ensureDriveRootFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const cachedId = cleanText_(
    properties.getProperty(OTC.PROPERTIES.DRIVE_ROOT_FOLDER_ID), 200
  );
  if (cachedId) {
    try {
      return DriveApp.getFolderById(cachedId);
    } catch (error) {
      // The cached folder no longer exists; fall through and recreate it.
    }
  }
  const name = getRuntimeConfig_().appName + ' Leads';
  const found = DriveApp.getFoldersByName(name);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(name);
  properties.setProperty(OTC.PROPERTIES.DRIVE_ROOT_FOLDER_ID, folder.getId());
  return folder;
}
