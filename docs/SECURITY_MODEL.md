# Security model

## Protected assets

- customer contact and itinerary data;
- booking provider and locator;
- commercial values and payment movements;
- user list and roles;
- spreadsheet and Apps Script configuration.

## Threats addressed

| Threat | Control |
| --- | --- |
| Agent changes the owner in browser tools | Server replaces/validates owner |
| Agent opens another agent's lead | Ownership check on every read and write |
| Two users write the same row | Script-level lock |
| Payment history is erased | Cancel state instead of physical deletion |
| Accidental overpayment | Server recalculates active payments |
| Malformed dates or amounts | Server parsing and range validation |
| Repository leaks deployment identifiers | Script Properties and secret scan |
| Disabled user keeps access | Active status checked on every endpoint |
| Public caller guesses a code | Six attempts, 10-minute TTL and resend cooldown |
| Access-code email is abused | Per-address hourly email quota |
| Session token is exposed in a URL or sheet | Opaque token in session storage only |
| Agents bypass the Web App through Sheets | Agents do not receive spreadsheet access |
| User text becomes a spreadsheet formula | Formula-leading text is escaped before writes |

## Not provided automatically

This project is a reference implementation, not a compliance certification.
Deployers remain responsible for:

- legal basis and consent;
- data retention and deletion policies;
- account lifecycle and Workspace security;
- spreadsheet sharing rules;
- backups and incident response;
- payment-card compliance—never store complete card data in the CRM.

## Reporting vulnerabilities

Follow the private disclosure process in [`SECURITY.md`](../SECURITY.md).
