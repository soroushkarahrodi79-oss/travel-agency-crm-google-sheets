# Deployment guide

## Prerequisites

- A Google account; Google Workspace is recommended for production.
- Permission to create a Google Sheet and an Apps Script project.
- Node.js 20+ only if using local checks or `clasp`.

## 1. Create the spreadsheet

Create a blank spreadsheet. Do not add customer data yet.

## 2. Create the Apps Script project

Either copy the files in `src/` through the editor or use `clasp`.

Example local `.clasp.json`—never commit the real Script ID:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

## 3. Run the installer

In Apps Script **Project Settings → Script Properties**, add:

| Property | Value |
| --- | --- |
| `TRAVEL_CRM_SPREADSHEET_ID` | ID from the spreadsheet URL |
| `TRAVEL_CRM_ADMIN_EMAIL` | First administrator email |

Run `setupTravelCrm_()` from the editor and authorize the requested Sheets and
email-sending scopes. The installer deletes the temporary admin-email property
after success. Confirm that these tabs exist:

- `LEADS`
- `RESERVATIONS`
- `PAYMENTS`
- `USERS`
- `AUDIT_LOG`

## 4. Register users

Add users to `USERS`:

| Email | Display name | Role | Active |
| --- | --- | --- | --- |
| your agent account | Agent name | `AGENT` | checked |

Use only `ADMIN` or `AGENT`. Disable access by clearing the Active checkbox.

## 5. Deploy the Web App

Recommended settings:

- Execute as: **Me** (the deployment owner)
- Access: your Workspace domain, or Google-account users for a demo

The Web App sends a one-time code only to active emails registered in `USERS`.
Agents do not need direct spreadsheet access. Codes expire after 10 minutes;
sessions expire after 8 hours and are revalidated against `USERS` on every
request.

## 6. Acceptance test

1. Request a code and sign in as an administrator.
2. Create a fictional lead.
3. Edit its reservation.
4. Add two installment payments.
5. Edit one payment.
6. Cancel one payment with a reason.
7. Confirm totals and `AUDIT_LOG`.
8. Sign in as an agent and verify they cannot open another agent's lead.

## 7. Production checklist

- Restrict Web App access to the intended organization.
- Keep the deployment owner account protected with MFA.
- Protect the USERS and AUDIT_LOG sheets.
- Create a backup policy for the spreadsheet.
- Review Apps Script execution logs.
- Test recovery from a copied spreadsheet.
- Document data retention and privacy obligations for your jurisdiction.
