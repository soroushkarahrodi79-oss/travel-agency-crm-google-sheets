# Contributing

Thank you for improving Open Travel CRM. Focused bug fixes, security reviews,
accessibility improvements, documentation and tested product changes are
welcome.

## Ground rules

- Use fictional records, emails and identifiers in tests and screenshots.
- Never commit a real `.clasp.json`, OAuth credential, deployment URL or Sheet ID.
- Keep authorization, ownership and financial rules on the server.
- Preserve cancelled financial movements and user history.
- Treat header changes as schema migrations, not formatting edits.
- Maintain keyboard access, visible focus and responsive layouts.
- Keep runtime dependencies at zero unless an architectural proposal justifies them.

Read [the architecture](docs/ARCHITECTURE.md) and
[security model](docs/SECURITY_MODEL.md) before changing authentication,
payments, user administration or sheet schemas.

## Local workflow

Requirements: Node.js 20+.

```bash
npm install
npm run check
```

`npm run check` runs:

1. Apps Script and browser syntax checks;
2. public/private endpoint and security-contract checks;
3. pure domain-helper tests;
4. Markdown link validation;
5. publication secret scanning;
6. release metadata consistency.

There are no packages required by the deployed CRM.

## Branches and commits

Create a focused branch from the latest `main`. Prefer clear conventional-style
commit subjects such as:

```text
fix: prevent stale sessions after role changes
feat: add follow-up queue
docs: document backup recovery test
```

Do not mix broad formatting changes with authorization or payment logic.

## Pull requests

Explain:

- the user or operational problem;
- the chosen behavior and alternatives considered;
- authorization, privacy and financial impact;
- schema or deployment impact;
- tests performed;
- rollback or recovery considerations.

Update `CHANGELOG.md` for user-visible changes. Update the data dictionary,
architecture, deployment or upgrading guides whenever their contracts change.

## Schema changes

Row 1 of every managed sheet is a versioned interface. A schema pull request
must include:

- a new schema version;
- an explicit, idempotent migration;
- backup and rollback instructions;
- tests for old and new states;
- updated `docs/DATA_DICTIONARY.md`.

Never make `setupTravelCrm_()` silently reorder unknown production data.

## Security reports

Do not open a public pull request or issue for an exploitable vulnerability.
Follow [SECURITY.md](SECURITY.md).
