# Deployment guide

This guide creates an agency-owned Google Sheet, Apps Script project and Web App
deployment. Complete the acceptance test before adding real customer data.

## Prerequisites

- A Google account; Google Workspace is recommended for production.
- Permission to create a Google Sheet, Apps Script project and Web App deployment.
- Node.js 20+ for local validation.
- [`clasp`](https://github.com/google/clasp) for command-line deployment, or the Apps Script editor for manual copying.

## 1. Prepare the source

Fork the repository if you plan to maintain your own version, then:

```bash
git clone https://github.com/soroushkarahrodi79-oss/travel-agency-crm-google-sheets.git
cd travel-agency-crm-google-sheets
npm install
npm run check
```

Do not continue with a failing check.

## 2. Create the data store

Create a blank Google Sheet. Copy the spreadsheet ID from the URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

Do not share the sheet with agents. The deployment owner requires access; agents
use the Web App.

## 3. Create and connect Apps Script

Create a standalone project at
[`script.google.com`](https://script.google.com/). Copy its Script ID from
**Project Settings**.

```bash
npm install --global @google/clasp
clasp login
cp .clasp.json.example .clasp.json
```

Replace `YOUR_SCRIPT_ID` in `.clasp.json`. The real file is ignored by Git.

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

Push the source:

```bash
clasp push
```

Alternatively, copy every `.gs`, `.html` and `appsscript.json` file under
`src/` into the Apps Script editor.

## 4. Configure the installation

In **Apps Script → Project Settings → Script Properties**, add:

| Property | Value |
| --- | --- |
| `TRAVEL_CRM_SPREADSHEET_ID` | Spreadsheet ID from step 2 |
| `TRAVEL_CRM_ADMIN_EMAIL` | Email of the first administrator |

Optional brand and regional settings are documented in
[configuration](CONFIGURATION.md).

## 5. Run the installer

Select `setupTravelCrm_` in the Apps Script editor and click **Run**. Approve the
requested Sheets and email-sending scopes.

The installer:

- validates the spreadsheet ID and administrator email;
- creates `LEADS`, `RESERVATIONS`, `PAYMENTS`, `USERS` and `AUDIT_LOG`;
- writes and verifies the expected headers;
- adds formatting, checkboxes and list validation;
- creates the first active administrator;
- creates an installation-specific authentication secret and ID;
- records the schema version;
- deletes the temporary `TRAVEL_CRM_ADMIN_EMAIL` property.

Run `runHealthCheck_()` from the editor. It verifies sheet headers, primary-key
uniqueness, relationships, active administrators, schema version and time-zone
alignment. Its returned object must have `ok: true`.

## 6. Deploy the Web App

In Apps Script choose **Deploy → New deployment → Web app**.

- **Execute as:** Me, the deployment owner.
- **Who has access:** the narrowest option suitable for the organization.

For a Workspace installation, prefer domain-only access. If a public deployment
is necessary, the CRM's OTP and user registry remain the application-level
access control, but the public URL should still be treated as sensitive.

Create the deployment and open its `/exec` URL. Do not use the temporary
developer `/dev` URL for production.

## 7. Acceptance test

Use fictional data:

1. Request a code and sign in as the first administrator.
2. Open **Users**, create an active `AGENT`, then sign out.
3. Sign in as the agent and create a fictional lead.
4. Add provider, locator, route and travel dates.
5. Add two installment payments and verify the balance.
6. Attempt an overpayment and confirm it is rejected.
7. Cancel one payment with a reason and confirm it remains visible.
8. Confirm the lead status follows the outstanding balance.
9. As the administrator, create a second lead owned by someone else.
10. Confirm the agent cannot read that lead.
11. Disable the agent and confirm its existing session stops working.
12. Inspect `AUDIT_LOG` for the corresponding actions.
13. Run `runHealthCheck_()` again.

## 8. Production readiness

- Protect the deployment-owner account with MFA.
- Restrict spreadsheet sharing to the smallest possible group.
- Protect `USERS` and `AUDIT_LOG` ranges against casual edits.
- Record who owns the deployment and who can recover that account.
- Configure a spreadsheet backup policy and test restoration.
- Review Apps Script execution logs after launch.
- Document retention, deletion, consent and privacy obligations.
- Never store complete card data, passwords or identity-document images.
- Keep the source version, deployment version and schema version recorded.

Continue with the [operations runbook](OPERATIONS.md).

## Updating an existing deployment

Do not run an unreviewed `clasp push` against production. Back up the
spreadsheet, validate the target release and follow
[UPGRADING.md](UPGRADING.md).
