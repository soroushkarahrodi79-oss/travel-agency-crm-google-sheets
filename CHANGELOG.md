# Changelog

All notable changes follow the principles of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic
versioning.

## [Unreleased]

### Fixed

- Added the explicit `userinfo.email` OAuth scope required by
  `Session.getActiveUser()` and `Session.getEffectiveUser()`, so first-time
  setup and upgrades can identify the deployment owner.
- Added deployment-owner-gated `setupTravelCrm()` and `runHealthCheck()`
  operator entry points that appear in the Apps Script editor while failing
  closed when called through the execute-as-owner Web App.
- Corrected deployment and upgrade instructions that previously told operators
  to select private underscore-suffixed functions that Apps Script hides.

## [1.3.0] - 2026-07-28

Completes the roadmap's *Next: daily agency workflow* section. Every feature
below is exclusive to `AGENT`/`ADMIN` sessions, respects the existing lead
ownership rules and ships behind the same static, unit and integration gates.

### Added — daily workflow features

- **Follow-up work queue** with `OVERDUE`, `TODAY` and next-seven-day scopes,
  ordered by urgency and reachable from a navigation entry that shows the
  overdue count. Reuses the existing `Next follow-up` column, so no schema
  change is required.
- **Outstanding-balance and payment-aging report**, aged against each
  departure date rather than debt age, with per-bucket totals, urgency
  ordering and a CSV export whose cells are neutralised against spreadsheet
  formula injection.
- **Reusable quote and customer-email templates** with `{{placeholder}}`
  substitution against a lead's current data, administrator-managed and
  agent-rendered within their own leads. The CRM renders the text; sending
  stays in the agent's own mail client so the app never dispatches messages
  on the agency's behalf.
- **A private Google Drive folder per lead** for quotes, tickets and scanned
  documents, created on request and linked from the lead editor. The CRM
  only stores the folder link and never enumerates or reads its contents.
- **Idempotent calendar sync**: one CRM-owned event per lead, kept in sync
  with the *Next follow-up* date — no-op when nothing changed, moved when the
  date changes, deleted when the lead is closed or lost.
- **Full Spanish localization** of the interface and errors, selected by
  `TRAVEL_CRM_LOCALE`. Falls back to English for any locale without a
  catalogue; operator diagnostics stay in English so deployment logs, CI
  output and runbooks keep one greppable wording.

### Changed

- Schema version bumped from **1** to **4** across four incremental steps
  (`TEMPLATES`, `DRIVE_LINKS`, `CALENDAR_EVENTS`). `setupTravelCrm()` creates
  the new sheets automatically on the next run; see
  [`docs/UPGRADING.md`](docs/UPGRADING.md) for the per-schema notes.
- OAuth scopes now include `drive.file` and `calendar.events.owned` — the
  narrowest grants available. Both only cover items the app itself creates;
  the deployer's wider Drive and Calendar contents stay invisible to the CRM.
  Re-authorization is required on the next `setupTravelCrm()` run.
- Reworked payment aggregation into a single
  `activePaymentAggregatesByLead_` pass shared between the dashboard and the
  balance report, replacing two near-identical scans.

### Added — release gates

Because features that grow over time need gates that grow with them:

- **Translation coverage gate** that fails the build when a user-facing
  string has no Spanish translation, so the catalogue cannot silently fall
  behind the interface.
- **OAuth scope gate** tightened to require the exact scope list rather than
  a subset, so any future scope creep must go through a deliberate manifest
  and gate change.
- **Third-party read prohibitions**: static gates fail the build if
  `getFiles()` / `getFolders()` (Drive) or `getEvents()` /
  `getAllCalendars()` (Calendar) ever appear in the source, keeping the
  narrow-scope design load-bearing.

## [1.2.0] - 2026-07-26

### Added

- One-step installer that can create the native Google Sheets data store and
  infer the executing account as the first administrator.
- Explicit `production`, `staging` and `demo` environments with visible
  non-production badges.
- Secret-gated remote staging acceptance through the Apps Script Execution API.
- Version-pinned, on-demand `clasp` tooling, a configuration doctor and a
  manually approved staging deployment workflow.
- Linkable demo screens, verified product screenshots, a compact MP4 and an
  accessible automated product tour.

### Changed

- Demo seeding is blocked in production environments.
- Installation results include the spreadsheet URL, creation state and next
  operational steps.

## [1.1.0] - 2026-07-26

### Added

- Deployment-level app name, currency, locale and time-zone configuration.
- Administrator-only user management inside the Web App.
- Schema-version guard and a health check for headers, keys, relationships, administrators and time-zone alignment.
- Outstanding-balance, overdue-follow-up and conversion dashboard metrics.
- Lead-status filtering and protection against unsaved navigation.
- Accessible cancellation dialog and session invalidation after access changes.
- Documentation for configuration, data schema, operations, support and upgrades.
- Local documentation-link and release-metadata validation.
- In-memory integration coverage for OTP, roles, ownership, leads, payments and health checks.
- Verified tag-to-version release automation for GitHub releases.

### Changed

- OTP issuance and verification now run under the script lock.
- OTP signatures use a timing-resistant comparison.
- Payment IDs use UUID-derived entropy.
- Payment mutations synchronize the lead's paid/pending status.
- Sale totals cannot be removed or reduced below active payments.
- Runtime date and money formatting follows deployment configuration.
- Spreadsheet access and repeated configuration reads are cached per execution.

### Security

- Prevented concurrent OTP requests from racing resend and attempt limits.
- Prevented removal of the final active administrator.
- Added explicit fail-closed behavior for code/schema version mismatch.

## [1.0.0] - 2026-07-24

### Added

- Lead pipeline with agent ownership.
- Reservation details: provider, locator, route and travel dates.
- Installment payments with edit, balance and cancellation audit.
- One-time email codes, signed sessions and role checks.
- Email-code rate limiting and spreadsheet formula-injection protection.
- Script-level concurrency lock.
- Five-sheet installer and fictional demo seeder.
- Responsive Apps Script Web App.
- Static GitHub Pages demo.
- CI, secret scanning, contribution and security documentation.
