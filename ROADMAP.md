# Roadmap

The roadmap is organized by user outcome, not feature volume. Security, data
isolation, recovery and low operating complexity take priority.

## Shipped foundation

- [x] Lead, reservation and installment-payment workflows
- [x] Agent ownership and administrator roles
- [x] Email OTP, signed sessions, rate limits and session invalidation
- [x] Configurable brand, currency, locale and time zone
- [x] Web-based user administration
- [x] Versioned schema checks and operational health report
- [x] CI, secret scanning, release checks and operational documentation
- [x] One-step native Sheet setup and production/demo separation
- [x] Secret-gated remote acceptance workflow for a protected staging project
- [x] Interactive demo, verified screenshots and compact product tour

## Next: daily agency workflow

- [x] Follow-up queue with today/overdue views
- [x] Exportable outstanding-balance and payment-aging report
- [x] Reusable quote and customer-email templates
- [x] Calendar follow-up events with idempotent sync
- [x] Drive folders and document links per lead
- [x] Full UI localization, starting with Spanish and English

## Next: confidence at scale

- [ ] Browser-level end-to-end tests against a disposable Apps Script deployment
- [ ] Explicit schema migration registry for future column changes
- [ ] Configurable retention and anonymization workflow
- [ ] External append-only audit export
- [ ] Performance benchmarks and documented volume thresholds

## Later: integrations

- [ ] Authenticated and replay-safe webhook intake
- [ ] Looker Studio starter dashboard
- [ ] Optional multi-branch data partitioning
- [ ] Pluggable booking-provider adapters

Proposals should describe the operational problem, security impact, recovery
behavior and smallest useful implementation.
