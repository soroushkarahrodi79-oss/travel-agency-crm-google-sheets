# Contributing

Thank you for improving Open Travel CRM.

## Before opening a pull request

1. Create a focused branch.
2. Use fictional data in tests, screenshots and examples.
3. Run:

   ```bash
   npm test
   npm run security:scan
   ```

4. Explain the user impact and security implications.
5. Update documentation when behavior changes.

## Design principles

- Server authorization beats browser convenience.
- Never trust owner, role or totals received from the client.
- Preserve auditable financial movements.
- Keep runtime dependencies at zero unless clearly justified.
- Prefer backward-compatible sheet changes and explicit migrations.
- Maintain keyboard access, visible focus and responsive forms.

## Pull request scope

Keep pull requests small enough to review. Do not mix formatting-only changes
with authorization or payment logic.

## Security work

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
Public pull requests must not contain real deployment identifiers or customer
data.
