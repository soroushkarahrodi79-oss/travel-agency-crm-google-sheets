# Operations runbook

This runbook is for the person responsible for a production deployment.

## Ownership record

Keep an internal record of:

- repository fork and deployed commit;
- Apps Script project and production deployment ID;
- spreadsheet owner and approved editors;
- deployment-owner account and recovery owner;
- configured locale, currency and time zone;
- declared environment (`production`, `staging` or `demo`);
- backup location, frequency and retention period.

Do not place secrets or customer data in a public issue.

## Routine checks

### Weekly

1. Run `runHealthCheck_()` from the Apps Script editor.
2. Review failed Apps Script executions and email-send errors.
3. Review disabled or stale accounts in **Users**.
4. Inspect unusual sign-ins, cancellations and role changes in `AUDIT_LOG`.
5. Confirm backup jobs or manual copies succeeded.

### Monthly

1. Restore a recent backup into a separate test spreadsheet.
2. Review spreadsheet editors and deployment access.
3. Check Apps Script quota usage and execution latency.
4. Pull upstream security and maintenance releases into the fork.
5. Run `npm run check` against the deployed source version.
6. Run the protected **Apps Script staging** workflow before production updates.

## User lifecycle

### Add a user

An administrator opens **Users**, enters the email, display name and role, and
saves an active record. The user can then request an OTP.

### Change a role

Role changes invalidate that user's existing sessions. The user must sign in
again. An administrator cannot remove their own administrator access through
the Web App.

### Offboard a user

Disable the user. Do not delete its row; historical leads and audit events still
reference the email. Reassign open leads as needed. Existing sessions are
invalidated.

## Backup and recovery

At minimum, create time-stamped copies of the spreadsheet in a restricted Drive
folder. For stronger recovery objectives, use an approved Workspace backup
product or a scheduled export.

Recovery test:

1. copy the backup to a restricted test location;
2. point a non-production Apps Script project at the restored spreadsheet;
3. run `setupTravelCrm_()` and `runHealthCheck_()`;
4. verify users, lead ownership, reservations, active/cancelled payments and audit rows;
5. remove test access and document the result.

Changing the production spreadsheet ID is a controlled recovery action. Verify
the restored copy before updating `TRAVEL_CRM_SPREADSHEET_ID`.

## Incident response

### Suspected account compromise

1. Disable the affected user in `USERS` or through **Users**.
2. Remove unintended spreadsheet editors.
3. Replace the deployment-owner credentials according to Workspace policy.
4. Review `AUDIT_LOG` and Apps Script execution logs.
5. If broad session invalidation is needed, rotate `TRAVEL_CRM_AUTH_SECRET`;
   this signs out every user.
6. Preserve evidence and follow the organization's notification process.

### Suspected data corruption

1. Stop normal use and avoid running the installer against unexpected headers.
2. Copy the current spreadsheet for evidence.
3. Compare with the most recent known-good backup.
4. Restore into a separate spreadsheet and run the health check.
5. Switch production only after acceptance testing.

### Email codes are not arriving

Check the user's active record, spam filtering, deployment-owner Mail quotas and
Apps Script execution logs. Repeated requests are intentionally subject to a
one-minute cooldown and a per-address hourly limit.

## Capacity signals

Plan a move to a database-backed architecture when several of these become
routine:

- dashboard or search latency is operationally disruptive;
- concurrent edits frequently wait for the script lock;
- Apps Script execution, Mail or property quotas are approached;
- reporting requires large cross-sheet scans;
- immutable financial audit or regulated controls are required;
- multiple branches need independent access and data partitions.

Do not solve scale problems by weakening ownership checks, removing locks or
giving agents direct spreadsheet access.
