# Upgrading

Treat source code and spreadsheet schema as one release. The application fails
closed when the installed schema version does not match the code.

## Before upgrading

1. Read the target release in `CHANGELOG.md`.
2. Review changes to `src/Config.gs`, sheet headers and security-sensitive files.
3. Create a time-stamped spreadsheet backup.
4. Record the current Git commit and Apps Script deployment version.
5. Run `npm install` and `npm run check` on the target source.
6. Test the upgrade against a copied spreadsheet and non-production Apps Script project.

## Upgrade procedure

```bash
git fetch origin
git checkout <reviewed-release-or-commit>
npm install
npm run check
clasp push
```

In the Apps Script editor:

1. run `setupTravelCrm_()`;
2. confirm it completes without a schema mismatch;
3. run `runHealthCheck_()` and require `ok: true`;
4. create a new immutable Web App version;
5. update the production deployment to that version;
6. complete the deployment acceptance test.

`setupTravelCrm_()` is idempotent for compatible schemas. It does not silently
reorder or replace unexpected headers.

## Release-specific migration notes

### Schema 4 (Calendar follow-up events)

Adds a `CALENDAR_EVENTS` sheet and a new
`https://www.googleapis.com/auth/calendar.events.owned` OAuth scope.
Re-authorize the project when prompted; this scope only grants access to
events the CRM itself creates, never other calendar contents.
`setupTravelCrm_()` creates the sheet automatically; no manual migration is
required.

### Schema 3 (Drive folders per lead)

Adds a `DRIVE_LINKS` sheet and a new `https://www.googleapis.com/auth/drive.file`
OAuth scope. Re-authorize the project when prompted; this scope only grants
access to folders the CRM itself creates, never the account's wider Drive.
`setupTravelCrm_()` creates the sheet automatically; no manual migration is
required.

### Schema 2 (quote and email templates)

Adds a `TEMPLATES` sheet. `setupTravelCrm_()` creates it automatically on the
next run; no manual column changes or data migration are required. Existing
`LEADS`, `RESERVATIONS`, `PAYMENTS`, `USERS` and `AUDIT_LOG` headers are
unchanged.

## Schema mismatch

Do not rename columns until the error disappears. A mismatch may indicate:

- a spreadsheet owner manually changed row 1;
- code was deployed without the required migration;
- the Apps Script project points at the wrong spreadsheet;
- an incomplete upgrade mixed two versions.

Preserve a copy, compare the headers with [the data dictionary](DATA_DICTIONARY.md)
and follow release-specific migration instructions. If none exist, stop and
open an issue without sharing private data.

## Rollback

Code rollback is safe only when the previous code supports the current schema.

1. stop normal use;
2. select the previous Apps Script deployment version;
3. if the schema changed, restore the pre-upgrade spreadsheet copy;
4. restore the previous `TRAVEL_CRM_SPREADSHEET_ID` if needed;
5. run that version's health check and acceptance test;
6. document the incident and preserve the failed upgrade artifacts.

Never partially restore financial sheets while leaving related leads or audit
rows from another point in time.
