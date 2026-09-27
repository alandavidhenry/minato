# Future Considerations

Business context, current architecture, and testing coverage are documented in `CLAUDE.md` — not repeated here. The reasoning behind past architectural/technical decisions is archived in [`adr.md`](./adr.md). This file is for what's still open: gaps, deferred work, and things to revisit later.

See [`product-roadmap.md`](./product-roadmap.md) for the forward-looking product plan (feature gaps, automations, SaaS prerequisites, subscription tiers) — items built from it get a P-number below.

---

## Completed priorities (P1–P22)

All items from the original workflow plan (comprehension questions, individual/job-role assignment, email + reminder notifications, no-email worker + kiosk support, document versioning) and every enhancement roadmap item through P22 are done. Kept here as a index only — implementation detail lives in the code/tests/git history, and any decision worth remembering lives in `adr.md`.

| # | Feature |
|---|---|
| P1 | Comprehension questions — admin-authored MC questions per template, validated server-side on submission |
| P2 | Individual-level assignment + overdue tracking; company completions list groups by template (highest version only, company-wide + individually auto-enrolled rows merged) |
| P3 | Job role-based assignment (`targetJobRoles` on `Assignment`, `jobRole` on `User`) |
| P4 | Email notifications on assignment |
| P5 | Automated reminder notifications (daily cron) |
| P6 | No-email worker support, line manager notification routing, public kiosk sign-off |
| P7 | Document version cycle — publish new version, auto-replicate assignments |
| P8 | Declaration name-match at completion signing (see "Known gaps" below for hardening ideas) |
| P9 | Dashboard: completions-centric redesign |
| P10 | Users list grouped by company |
| P11 | Activity logs: filter controls + CSV export |
| P12 | Outstanding completions: cross-company filtered table + CSV/XLSX export |
| P13 | Template version history: change log + diff view |
| P14 | Activity logs: compliance KPI graphs (replaced vanity metrics) |
| P15 | Customer Admin: scoped completions dashboard (read-only) |
| P16 | Auto-enrol users to job-role-matching assignments (explicit per-user audit records) |
| P16b | Drag-and-drop form builder + starter templates (see "Known gaps" below for the file-review gap) |
| P17 | Self-serve portal — Customer Admins create/assign their own templates |
| P18 | Unified role-aware navigation shell (replaced three parallel nav systems) |
| P18b | Breadcrumbs, account menu, overdue-completions bell, welcome header |
| P19 | Upload-based documents (Word/PDF), read-only + fill-and-return — see ADR-009/ADR-010 |
| P20 | Dashboard drill-downs, settings cleanup, template categorisation |
| P21 | Supabase-style UI redesign — see ADR-012 |
| P22 | Data retention guard on completion deletion — see `data-management.md` |

### Known gaps / deferred items carried forward from completed work

- **P8 sign-off hardening (not built):** employee number or date-of-birth confirmation for higher-assurance sign-offs; optional password re-entry before signing (useful if someone else has access to an unlocked device); one-time PIN sent to the line manager before kiosk sign-off proceeds; capturing IP address/user-agent alongside the existing `signerName` audit trail.
- **P16b file-field review gap:** an uploaded `file` form-field value has no admin download/review UI — the completion PDF shows only the filename, not a link to the original. Add if reviewing the actual uploaded file becomes necessary.
- **P19 deferred, no target date:** structured data extraction from filled-in documents into a searchable store (Azure Document Intelligence is already provisioned for this — `infrastructure/modules/document_intelligence/` — but unused in application code; same underlying OCR gap noted under "Document Intelligence" below).

---

## Role model — what remains

- Role assignments will need to be scoped per-tenant once multi-tenancy is built — see ADR-003/ADR-007.
- A `Read-only`/`Auditor` role remains deferred until a concrete use case appears.

---

## Document Intelligence (Azure AI) — not yet built

Reasoning for deferring is in ADR-006. Revisit if either becomes true:
- Customers start uploading scanned paper forms that need converting into structured records
- The platform needs to search/filter across form responses (e.g. "show all farms where the fire exit checklist was marked non-compliant")

Free tier: 500 pages/month, then per-page.

---

## Multi-tenancy — not yet built

Approach and reasoning are in ADR-007. **Do not build ahead of need** — this is recorded so the shape is known when/if the platform is marketed to other H&S companies, not a signal to start now.

---

## Testing strategy — what remains

Current coverage is documented in `CLAUDE.md`'s Testing Strategy section (kept current there, not duplicated here).

- **More E2E coverage:** upload-based (Word/PDF) document flows and fill-and-return submissions (P19) are only integration-tested so far — worth adding to the Playwright suite once that UI is judged stable enough to justify the Gotenberg-dependent E2E setup cost.
- **Coverage target:** high coverage on `src/lib/` (>90%) and critical API routes; E2E coverage of the most important user journeys. Don't chase 100% at the expense of test quality.

---

## Deployment pipeline — what remains

Current pipeline (lint → security scan → Playwright E2E → Docker build/push → `prisma migrate deploy` → Azure deploy → smoke test) is documented in `CLAUDE.md`'s Deployment section.

- **No staging environment** — consider a `staging` branch/environment between `dev` and `main` if release risk ever justifies the extra step.

---

## Compliance & Data Protection

See [`data-management.md`](./data-management.md) for the full design discussion (Azure Blob immutability, the GDPR erasure-vs-retention conflict, per-company/jurisdiction retention, container isolation) and P22 above for what's built.

**Actions still needed:**
- Add a privacy policy page
- Confirm with Simon whether any industry-specific H&S standards require certified e-signatures vs. the current simple audit trail (see ADR-004)
- Design the GDPR right-to-erasure/anonymisation flow — `data-management.md` §4 covers the specific conflict with statutory retention (e.g. a client company closing down) and what an override would need. P22 only protects existing signed records from premature admin deletion; it doesn't yet handle a user asking to be forgotten while their documents must be retained.
