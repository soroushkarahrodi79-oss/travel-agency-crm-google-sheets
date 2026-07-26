# Support

Open Travel CRM is a community-maintained reference implementation, not a
hosted support service.

## Usage questions

Before opening a discussion or issue:

1. read the [deployment](docs/DEPLOYMENT.md), [configuration](docs/CONFIGURATION.md)
   and [operations](docs/OPERATIONS.md) guides;
2. run `npm run check`;
3. run `runHealthCheck_()` against the affected installation;
4. reproduce the problem using fictional data.

Include the project version, browser, deployment type, health-check result and
minimal reproduction. Remove spreadsheet IDs, deployment URLs, emails, access
codes and customer data.

## Bug reports

Use the repository bug-report form for reproducible defects. State:

- expected and actual behavior;
- whether the actor is an administrator or agent;
- affected workflow and version;
- sanitized Apps Script error text;
- whether the issue reproduces on a copied test spreadsheet.

## Feature requests

Explain the operational problem, who experiences it and the smallest useful
outcome. Security, data isolation, recoverability and zero runtime dependencies
are core design constraints.

## Security vulnerabilities

Do not open a public issue. Follow the private process in
[SECURITY.md](SECURITY.md).

## No sensitive data

Maintainers do not need real customer records, live access codes, spreadsheet
IDs or credentials to investigate a report. Use fictional replacements.
