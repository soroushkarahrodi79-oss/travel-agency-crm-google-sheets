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

## 2. Choose the data-store path

Recommended: let `setupTravelCrm_()` create a native Google Sheet in your
account. Leave `TRAVEL_CRM_SPREADSHEET_ID` unset and continue to step 3.

To connect an existing blank Sheet, copy its ID from:

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
clasp login
npm run apps-script:configure -- --script-id YOUR_SCRIPT_ID
npm run apps-script:doctor
```

The repository invokes a version-pinned `clasp` on demand. The generated
`.clasp.json` is private and ignored by Git.

Push the source:

```bash
npm run apps-script:push
```

Alternatively, copy every `.gs`, `.html` and `appsscript.json` file under
`src/` into the Apps Script editor.

## 4. Configure the installation

For the one-step path, no required property is necessary when Apps Script can
read the executing account email. Otherwise add:

| Property | Value |
| --- | --- |
| `TRAVEL_CRM_SPREADSHEET_ID` | Optional existing Spreadsheet ID from step 2 |
| `TRAVEL_CRM_ADMIN_EMAIL` | Email of the first administrator |

Optional brand and regional settings are documented in
[configuration](CONFIGURATION.md).

## 5. Run the installer

Select `setupTravelCrm_` in the Apps Script editor and click **Run**. Approve the
requested Sheets, email-sending and Drive scopes. The Drive scope is the narrow
`drive.file` grant: it only covers folders the CRM itself creates (one per
lead, for document storage), never the account's wider Drive contents.

The installer:

- creates a native Google Sheet when no spreadsheet is configured;
- infers the executing account when no administrator email is configured;
- validates the spreadsheet ID and administrator email;
- creates `LEADS`, `RESERVATIONS`, `PAYMENTS`, `USERS`, `AUDIT_LOG`,
  `TEMPLATES` and `DRIVE_LINKS`;
- writes and verifies the expected headers;
- adds formatting, checkboxes and list validation;
- creates the first active administrator;
- creates an installation-specific authentication secret and ID;
- records the schema version;
- deletes the temporary `TRAVEL_CRM_ADMIN_EMAIL` property.

Copy the returned `spreadsheetUrl`. Run `runHealthCheck_()` from the editor. It
verifies sheet headers, primary-key
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

## Automated staging acceptance

Use a separate Apps Script project and Sheet. Configure:

- `TRAVEL_CRM_ENVIRONMENT=staging`;
- `TRAVEL_CRM_STAGING_TOKEN` with a random value of at least 32 characters;
- the usual spreadsheet and administrator values when not using one-step setup.

Deploy it once as an **API executable**, connect it to a standard Google Cloud
project and enable the Apps Script API. The manifest restricts API execution to
the deployment owner. Create a protected GitHub environment named `staging`
with these secrets:

- `CLASP_SCRIPT_ID`;
- `CLASP_CREDENTIALS_JSON`;
- `TRAVEL_CRM_STAGING_TOKEN`.

Google documents the executable and Cloud-project prerequisites in
[Execute functions with the Apps Script API](https://developers.google.com/apps-script/api/how-tos/execute).

Run **Apps Script staging** from GitHub Actions. It repeats local checks, pushes
the source and invokes the secret-gated `runStagingAcceptance`. A production
installation rejects this endpoint even if a token is supplied.

## Updating an existing deployment

Do not run an unreviewed `clasp push` against production. Back up the
spreadsheet, validate the target release and follow
[UPGRADING.md](UPGRADING.md).
