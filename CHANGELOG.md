# Changelog

All notable changes follow the principles of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic
versioning.

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
