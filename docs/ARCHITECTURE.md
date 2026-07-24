# Architecture

Open Travel CRM uses a deliberately small architecture:

```text
Browser (Index.html)
        |
        | google.script.run
        v
Apps Script services
  - identity and authorization
  - validation and ownership checks
  - lead/reservation/payment operations
  - audit logging and locking
        |
        v
Google Sheets
  LEADS · RESERVATIONS · PAYMENTS · USERS · AUDIT_LOG
```

## Trust boundaries

The browser is untrusted. It may request an owner, role, lead ID or payment
amount, but the server resolves identity from a short-lived opaque session,
rechecks the active user and ownership, and validates every value. One-time
codes and session records are HMAC-keyed in Script Properties; raw codes are
never stored.

## Why separate sheets?

The core lead row stays compact. Reservation details and payment movements have
different update and retention rules:

- one lead has at most one current reservation record;
- one lead can have many payment movements;
- cancelled payments must remain auditable;
- analytics can read the lead pipeline without scanning payment columns.

## Public endpoints

- `requestAccessCode(email)`
- `verifyAccessCode(email, code)`
- `signOut(token)`
- `getBootstrap(token)`
- `getDashboard(token)`
- `searchLeads(token, query, limit)`
- `getLead(token, leadId)`
- `saveLead(token, input)`
- `savePayment(token, input)`
- `cancelPayment(token, input)`

Every CRM endpoint requires a valid session and an active registered user.
Installer and demo-seed functions end with `_`, so Apps Script does not expose
them to `google.script.run`.

## Concurrency

Mutations run inside a `ScriptLock`. This prevents two agents from choosing the
same free row or updating the same payment concurrently.

## Extension points

Good first integrations include Gmail templates, Drive document folders,
calendar follow-ups, Looker Studio dashboards and webhook-based lead intake.
Keep third-party secrets in Script Properties, never in source files.
