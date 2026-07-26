# Configuration

Deployment-specific values live in Apps Script Properties, not in source files.
This keeps forks publishable and avoids committing spreadsheet IDs, email
addresses or environment-specific branding.

## Required installation properties

| Property | Purpose | Lifecycle |
| --- | --- | --- |
| `TRAVEL_CRM_SPREADSHEET_ID` | Opens the agency-owned data store | Retained |
| `TRAVEL_CRM_ADMIN_EMAIL` | Creates the first administrator | Deleted after setup |

## Optional product settings

| Property | Default | Validation | Example |
| --- | --- | --- | --- |
| `TRAVEL_CRM_APP_NAME` | `Open Travel CRM` | 1–80 safe text characters | `Atlas Travel Desk` |
| `TRAVEL_CRM_CURRENCY` | `EUR` | Three-letter ISO 4217 code | `USD` |
| `TRAVEL_CRM_LOCALE` | `en-GB` | Language or language-region | `es-ES` |
| `TRAVEL_CRM_TIME_ZONE` | `Europe/Madrid` | IANA time zone or `UTC` | `America/Bogota` |
| `TRAVEL_CRM_ENVIRONMENT` | `production` | `production`, `staging` or `demo` | `staging` |

Currency and locale are used by the browser's `Intl.NumberFormat`. The time
zone is used for IDs, dates and timestamps and is also applied to the
spreadsheet during setup.

## Interface language

`TRAVEL_CRM_LOCALE` also selects the interface language. Its first two letters
are matched against the catalogues in `src/I18n.gs`; anything without a
catalogue falls back to English, so `es-ES`, `es-CO` and `es-MX` all render
Spanish while `fr-FR` renders English rather than failing.

Translation covers the Web App and the errors agents read. Two categories stay
in English on purpose:

- **Operator diagnostics** — the installer, schema guard, staging acceptance
  and `TRAVEL_CRM_*` validation messages, so deployment logs, CI output and
  runbooks keep one greppable wording across every deployment.
- **Spreadsheet contents** — sheet names, headers and stored values are data,
  not interface, and renaming them would break the schema guard.

To add a language, add a catalogue keyed by its two-letter code to
`OTC_MESSAGES`. `npm test` fails if any user-facing string lacks a Spanish
translation, so the catalogue cannot silently fall behind the interface.

Choose the production time zone before entering real records. After changing a
setting, reload the Web App. A time-zone change on an existing installation can
alter how historical dates are interpreted: back up the sheet, test against a
copy, rerun `setupTravelCrm_()` and complete the acceptance test.

## Managed internal properties

The installer and authentication service own these values:

| Property | Purpose |
| --- | --- |
| `TRAVEL_CRM_AUTH_SECRET` | HMAC key for opaque OTP and session property keys |
| `TRAVEL_CRM_SCHEMA_VERSION` | Installed data-schema version |
| `TRAVEL_CRM_INSTALL_ID` | Non-secret identifier for this installation |
| `TRAVEL_CRM_STAGING_TOKEN` | Secret for remote staging acceptance only |
| `TRAVEL_CRM_OTP_*` | Short-lived signed OTP records |
| `TRAVEL_CRM_SESSION_*` | Short-lived session records |
| `TRAVEL_CRM_RATE_*` | Email-code quota windows |

Do not edit or copy `TRAVEL_CRM_AUTH_SECRET` casually. Replacing it invalidates
all current OTPs and sessions. Never commit Script Properties to the repository.

Use a random `TRAVEL_CRM_STAGING_TOKEN` of at least 32 characters only when
`TRAVEL_CRM_ENVIRONMENT=staging`. Non-production environments show a visible
badge, and demo seeding is refused in production.

## Recommended regional examples

### Spain

```text
TRAVEL_CRM_CURRENCY=EUR
TRAVEL_CRM_LOCALE=es-ES
TRAVEL_CRM_TIME_ZONE=Europe/Madrid
```

### Colombia

```text
TRAVEL_CRM_CURRENCY=COP
TRAVEL_CRM_LOCALE=es-CO
TRAVEL_CRM_TIME_ZONE=America/Bogota
```

### United States

```text
TRAVEL_CRM_CURRENCY=USD
TRAVEL_CRM_LOCALE=en-US
TRAVEL_CRM_TIME_ZONE=America/New_York
```

## Source-level policy

Authentication TTLs, rate limits, sheet names and allowed domain options are
source-controlled constants in `src/Config.gs`. Changes affect security or data
compatibility and should be reviewed through a pull request with updated tests.
