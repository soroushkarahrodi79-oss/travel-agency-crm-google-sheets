# Data dictionary

The spreadsheet is the CRM's persistent data store. Row 1 is schema-controlled;
do not rename, reorder or remove headers. User-entered text is sanitized before
write, and date or amount columns retain native Sheets types.

## LEADS

One row per commercial opportunity.

| Column | Type | Meaning |
| --- | --- | --- |
| Lead ID | Text, primary key | Generated `TRV-YYYY-NNNN` identifier |
| Created at | Date-time | Original creation timestamp |
| Name | Text | Customer or principal traveller |
| Phone | Text | Contact number or WhatsApp number |
| Agent email | Email, foreign key | Active owner from `USERS` |
| Source | Enum | Acquisition channel |
| Status | Enum | Current pipeline state |
| Service | Enum | Flight, package, hotel, insurance, visa or other |
| Destination | Text | Primary commercial destination |
| Budget | Currency number | Indicative customer budget |
| Sale amount | Currency number | Final agreed total when known |
| Travel start | Date | Departure or service start |
| Travel end | Date | Return or service end |
| Passengers | Positive integer | Number of travellers |
| Next follow-up | Date | Next commercial contact date |
| Next action | Text | Short operational action |
| Notes | Text | Free-form context; never store regulated secrets |
| Updated at | Date-time | Last lead or automated-status update |

Statuses: `NEW`, `CONTACTED`, `QUOTED`, `NEGOTIATION`,
`BOOKED_PENDING_PAYMENT`, `CLOSED_WON`, `LOST`.

## RESERVATIONS

At most one current reservation projection per lead.

| Column | Type | Meaning |
| --- | --- | --- |
| Lead ID | Text, foreign key | Related `LEADS` record |
| Provider | Text | Airline, wholesaler, hotel or operator |
| Booking locator | Text | Provider reservation reference |
| Route | Text | Human-readable itinerary or route |
| Destination | Text | Reservation destination |
| Travel start | Date | Departure or service start |
| Travel end | Date | Return or service end |
| Updated at | Date-time | Last reservation write |
| Updated by | Email | CRM user responsible for the write |

## PAYMENTS

One row per payment movement. Rows are never physically deleted by the app.

| Column | Type | Meaning |
| --- | --- | --- |
| Payment ID | Text, primary key | Timestamp plus UUID-derived identifier |
| Lead ID | Text, foreign key | Related `LEADS` record |
| Payment date | Date | Business date of the payment |
| Amount | Currency number | Positive collected amount |
| Method | Enum | Card, transfer, cash, financing or other |
| Reference | Text | Receipt or operation reference |
| Notes | Text | Optional payment context |
| Status | Enum | `ACTIVE` or `CANCELLED` |
| Created at | Date-time | Original creation timestamp |
| Updated at | Date-time | Last edit or cancellation timestamp |
| Updated by | Email | User responsible for the latest mutation |
| Cancellation reason | Text | Required when status becomes cancelled |

The active-payment sum cannot exceed the lead's sale total. A sale total cannot
be removed or reduced below its active payments.

## USERS

One retained row per CRM identity.

| Column | Type | Meaning |
| --- | --- | --- |
| Email | Email, primary key | Lowercase sign-in identifier |
| Display name | Text | Name shown in the Web App |
| Role | Enum | `ADMIN` or `AGENT` |
| Active | Boolean | Whether authentication and requests are allowed |
| Created at | Date-time | Original registration timestamp |

Disabling a user or changing its role invalidates existing sessions. The system
refuses to remove the final active administrator.

## TEMPLATES

Reusable quote and customer-email text, shared across the agency.

| Column | Type | Meaning |
| --- | --- | --- |
| Template ID | Text, primary key | Generated `TPL-NNNN` identifier |
| Name | Text | Short label shown in the picker |
| Type | Enum | `QUOTE` or `EMAIL` |
| Subject | Text | Used when rendering an `EMAIL` template |
| Body | Text | Template text; supports `{{placeholder}}` tokens |
| Active | Boolean | Whether agents can select it |
| Updated at | Date-time | Last edit timestamp |
| Updated by | Email | Administrator responsible for the latest edit |

A template is disabled rather than deleted, mirroring `USERS`, so a past render
stays explainable. Only an administrator can create, edit or disable a
template; any agent can render an active one against their own leads.

Placeholders are resolved server side against the rendering lead: `name`,
`phone`, `destination`, `service`, `travelStart`, `travelEnd`, `passengers`,
`nextAction`, `budget`, `saleAmount`, `total`, `paid`, `balance`, `agentName`,
`agentEmail`, `appName`, `today`. An unrecognised token is left in the
rendered text unchanged, so a typo is visible rather than silently dropped.

## DRIVE_LINKS

At most one Drive folder link per lead.

| Column | Type | Meaning |
| --- | --- | --- |
| Lead ID | Text, foreign key | Related `LEADS` record |
| Folder ID | Text | Google Drive folder identifier |
| Folder URL | Text | Direct link opened by the Web App |
| Created at | Date-time | When the folder was created |
| Updated at | Date-time | Reserved for future edits; currently equals `Created at` |
| Updated by | Email | Agent or administrator who created the folder |

Created on request, once per lead, under a single shared root folder named
`"<app name> Leads"`. The CRM only stores the folder's link; it does not
enumerate or read the folder's contents. See
[the security model](SECURITY_MODEL.md) for why the OAuth scope is
deliberately narrow.

## AUDIT_LOG

Append-oriented record of security and domain mutations.

| Column | Type | Meaning |
| --- | --- | --- |
| At | Date-time | Event timestamp |
| User email | Email | Actor resolved by the server |
| Action | Text | Stable action name such as `CREATE_PAYMENT` |
| Entity type | Text | Lead, payment, user, session or system |
| Entity ID | Text | Related business identifier |
| Details | Text | Sanitized human-readable context |

Spreadsheet owners can still edit rows directly, so `AUDIT_LOG` is an
application audit trail rather than an immutable external ledger. Protect the
sheet and restrict spreadsheet editors.
