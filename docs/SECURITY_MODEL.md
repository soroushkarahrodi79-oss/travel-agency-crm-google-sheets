# Security model

This document describes the intended controls and their limits. It is not a
compliance certification or substitute for an organization-specific review.

## Protected assets

- customer contact, itinerary and commercial data;
- booking providers and locators;
- payment movements and outstanding balances;
- user identities, roles and ownership assignments;
- spreadsheet and Apps Script configuration;
- authentication secrets, OTP records and sessions.

## Trust assumptions

- the deployment-owner Google account is protected and trusted;
- spreadsheet editors can alter all stored data and must be tightly restricted;
- Apps Script Properties are accessible only to project editors and runtime code;
- the Web App browser and every value it sends are untrusted;
- agents do not receive direct spreadsheet or Apps Script editor access.

## Threats and controls

| Threat | Control |
| --- | --- |
| Browser changes role or owner fields | Server reloads user and resolves owner |
| Agent opens another agent's lead | Ownership check on every lead read and mutation |
| Disabled user keeps a session | User status rechecked per request; sessions invalidated on access changes |
| Caller enumerates registered emails | OTP request always returns a generic response |
| Caller brute-forces a code | Attempt limit, short TTL, resend cooldown and hourly quota |
| Concurrent OTP requests bypass limits | Issuance and verification use `ScriptLock` |
| Signature comparison leaks prefix timing | Constant-work comparison over both signatures |
| Session token appears in a URL or sheet | Opaque token stored only in browser session storage |
| Two users race a data mutation | Script-level lock around writes |
| Payment history is erased | Cancellation state instead of physical deletion |
| Sale total becomes lower than collected value | Server recalculates active payments and rejects the edit |
| Cancelled payment leaves a won lead inconsistent | Server recalculates and synchronizes lead status |
| Text becomes a Sheets formula | Formula-leading text is escaped before write |
| Upgrade overwrites unexpected columns | Version guard and exact header compatibility check |
| Repository leaks deployment secrets | Script Properties, ignored private files and secret scan |
| Last administrator is removed | Administrator lifecycle invariant under lock |
| Remote health endpoint probes production | Owner-only API, environment gate and installation-specific staging token |
| Demo records enter a live installation | Demo seeding fails closed in `production` |

## Authentication storage

An installation-specific random secret is generated during setup. OTP and
session property keys are HMAC-derived; raw OTPs and session tokens are not
stored. OTP records include expiry and attempt count. Sessions use a fixed
eight-hour expiry and are revalidated against `USERS` on every request.

Script Properties have platform limits. Expired authentication records are
cleaned during code requests. This model is intended for small teams, not
high-volume consumer authentication.

## Audit limitations

Application mutations are appended to `AUDIT_LOG`, but spreadsheet owners can
edit that sheet directly. It is therefore a useful operational trail, not an
immutable external ledger. Organizations requiring tamper-evident financial
records should export events to an approved append-only system.

## Controls the deployer must provide

- MFA and recovery controls for the deployment-owner account;
- least-privilege spreadsheet and Apps Script sharing;
- Google Workspace lifecycle and device policy;
- backup, restore and incident-response procedures;
- legal basis, consent, retention and deletion policies;
- appropriate regional and payment regulations;
- an external audit destination if tamper evidence is required.

Never store complete payment-card numbers, CVVs, passwords, private keys or
government identity documents in this CRM.

## Known non-goals

- multi-tenant isolation inside one spreadsheet;
- immutable accounting;
- PCI DSS processing;
- public consumer sign-up;
- high-concurrency or high-volume workloads;
- automatic legal or regulatory compliance.

## Reporting vulnerabilities

Follow the private process in [`SECURITY.md`](../SECURITY.md). Use fictional
data and do not attach live deployment identifiers.
