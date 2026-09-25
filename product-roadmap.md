# Product Roadmap: Feature Gaps, Automations & Subscription Tiers

This document looks at Minato as a product rather than a codebase. It covers what's missing from the core loop, what similar H&S platforms offer, which automations would save real time, and how features could be split into subscription tiers (including a free tier). `future-considerations.md` is the engineering log of what's built (P1–P22). This file is the forward-looking product plan. Where an item here gets built, record it as a new P-number in `future-considerations.md` and tick it off here.

**Scope guardrail:** the product is *"get the right H&S documents to the right people, prove they read and understood them, and keep that proof."* Every item below is scored against that. Items that only loosely serve it are marked **Adjacent**. Build those only if customers ask for them, because they are where H&S suites become large, unfocused and expensive.

---

## 1. Where the product stands today

The core loop is complete and solid:

| Capability | State |
|---|---|
| Template library (form builder + Word/PDF upload, categories, versioning with change reasons + diffs) | ✅ |
| Comprehension questions (manual + AI-generated) | ✅ |
| Assignment (company-wide / individual / job-role targeted / auto-enrol) | ✅ |
| Distribution (email, line-manager routing for no-email workers, public kiosk) | ✅ |
| Sign-off (declaration name, drawn signature, immutable PDF) | ✅ |
| Tracking (dashboards, outstanding/overdue, compliance KPIs, CSV/XLSX export, reminders cron) | ✅ |
| Client self-serve (Customer Admin completions view + own templates) | ✅ |
| Retention guard on signed records | ✅ (app-level only) |

**What it lacks as a sellable SaaS:** multi-tenancy enforcement, billing, entitlements, self-serve signup and white-labelling. None of these is a feature a customer asks for, but you can't charge a subscription without them. See §5.

---

## 2. Feature gaps in the core loop

These are gaps inside the existing purpose. They're ranked by how likely a real customer is to hit them in the first month.

### 2.1 Recurring sign-offs and completion expiry ⭐ highest value
**Gap:** A completion is valid forever. A new cycle only starts when a new template *version* is published. Much of H&S doesn't work that way. The fire safety briefing, manual handling refresher and annual policy acknowledgement all need re-signing every 12 months even when the document hasn't changed.

**Proposal:**
- `Assignment.recurrenceMonths Int?`: when set, each completion gets a `validUntil` date (`signedAt + recurrenceMonths`).
- The daily cron re-opens the assignment for that user N days before expiry. It creates a fresh cycle, and reminders then run as normal.
- Status gains an **"Expiring soon"** / **"Expired"** state alongside Outstanding/Overdue.
- The PDF prints "Valid until".

**Why it matters for subscriptions:** this is the feature that makes the platform *recurring* by nature. Customers who rely on annual re-sign-off never have a reason to cancel.

### 2.2 Template review dates
**Gap:** There's nothing to remind Simon that a policy is due its annual review. Regulators and auditors expect documents to show a review date.

**Proposal:** add `DocumentTemplate.reviewDueAt` and `reviewOwnerId`, with a default of 12 months after publish. Show a "Templates due for review" tile on the dashboard, send an email to the owner at 30/7/0 days, and print the review date on the document and signed PDF. Publishing a new version, or clicking "Reviewed — no changes", resets the date. "Reviewed — no changes" logs a history entry without bumping the version or triggering re-signing.

### 2.3 Training / sign-off matrix
**Gap:** Status is only viewable per template or per assignment. The industry-standard view is a **matrix** with people down the side and documents across the top, where each cell is coloured by status (signed / due / overdue / expired / not required). Every auditor and client manager asks for this.

**Proposal:** `/admin/companies/[id]/matrix` and `/customer/admin/matrix`, filterable by job role and exportable to XLSX and PDF. It's pure read-model work: all the data already exists.

### 2.4 Audit / compliance pack export
**Gap:** Getting evidence out for an HSE visit, insurer or client audit means downloading PDFs one at a time.

**Proposal:** a one-click **"Compliance pack"** per company, containing:
- a cover summary (completion rates, overdue list, matrix)
- the current version of each assigned document
- every signed PDF in a date range

It's delivered as a ZIP, or as one merged PDF with a contents page. Generate it as a background job with an email link when ready, because it can be large. This is a strong upsell because it saves hours before every audit.

### 2.5 Worker lifecycle: bulk import, leavers, transfers
**Gaps:**
- There is no bulk user import. Onboarding a 60-person client means creating 60 users by hand.
- There is no deactivation. Leavers can only be deleted, which conflicts with retention of their signed records, or they stay "outstanding" forever and pollute overdue stats.

**Proposal:**
- CSV/XLSX import with a preview step. Columns: name, email (optional), job role, line manager. Matching `autoEnroll` assignments are applied immediately.
- `User.status: active | left` with a `leftAt` date. Leavers drop out of outstanding counts and kiosk lists, but their signed records stay intact and viewable. This is also the natural foundation for GDPR anonymisation (see `data-management.md`).
- Job-role change already re-runs auto-enrolment ✅. Transfers between companies would need a similar hook.

### 2.6 Onboarding packs (template bundles)
**Gap:** Auto-enrolment works one template at a time. A new starter normally needs a *set* of documents: H&S policy, fire procedure, first aid arrangements, DSE, plus role-specific ones.

**Proposal:** a `TemplateBundle` (for example "New starter — warehouse") that is assigned as a unit and auto-enrols new users. The due date is relative to the start date ("within 5 working days").

### 2.7 Group sign-off (toolbox talks and briefings)
**Gap:** The Toolbox Talk starter template stores attendees as a free-text list, so there is no individual signature per attendee. Toolbox talks are one of the most common H&S records.

**Proposal:** a supervisor starts a "briefing session" on one device (kiosk-style), and each attendee picks their name and signs in turn. That produces one session record with N individual completions, and optionally a group photo. It reuses the existing kiosk and signature components.

### 2.8 Stronger evidence and tamper-evidence
**Gaps:** IP address and user-agent aren't captured (already noted as P8+). The signed PDF can't be independently verified either.

**Proposal:**
- Store a SHA-256 hash of each signed PDF on `CompletionRecord`.
- Print a **verification QR** on the PDF linking to `/verify/[id]`, a public page confirming "this record exists, signed by X on Y, hash matches".
- Capture IP address and user-agent.
- Later, Azure Blob immutability (already designed in `data-management.md` §2).

Auditors value this far more than its build cost. It's cheap to build and makes a good marketing line ("tamper-evident sign-off").

### 2.9 Accessibility for real workforces
**Gap:** Many target sectors (agriculture, food production, construction, cleaning) have workers with English as a second language or low literacy. At the moment a worker who can't read the document can still guess their way to a signature.

**Proposal (AI-assisted, human-approved):**
- **Translated versions** of a template (Polish, Romanian, Ukrainian, Punjabi, etc.). The admin reviews each translation before it's published, as with question generation. The worker chooses a language, and the signed PDF records which language they read.
- **Read aloud** (browser text-to-speech, or Azure Speech) on the kiosk and web completion pages.
- **Plain-English key points** summary shown above long documents.

This is a genuine differentiator, and it helps with "reasonable steps to ensure understanding", which is the whole point of the comprehension questions.

### 2.10 Smaller known gaps (from the existing logs)
- Admins can't download files uploaded via `file` form fields (P16b note).
- The Customer Admin completions view may show duplicate template rows (P2 note).
- `/customer/admin/templates` lacks the category grouping and search that `/admin/templates` has (P20 note).
- There is no privacy policy page and no GDPR erasure/anonymisation flow (Compliance section).
- Reminder schedule is hard-coded (-3, -1, 0, then weekly) and should be tenant-configurable.
- Upload/fill-and-return flows have no E2E coverage.

---

## 3. Features from other platforms worth considering

For reference, the market splits into three kinds of product:
- **Inspection/checklist apps** (e.g. SafetyCulture/iAuditor)
- **Full EHS suites** (e.g. EcoOnline, Evotix, Ideagen, Donesafe, Notify)
- **Consultancy-bundled SME platforms** (e.g. Citation, Peninsula/BrightSafe, Alcumus)

Minato sits closest to the third group, but is sold *to* consultancies rather than *by* one.

| Feature | Seen in | Fit | Notes |
|---|---|---|---|
| **Inspections & checklists** (scheduled, pass/fail/N-A items, photos, scoring) | SafetyCulture, most suites | **Strong**: `example_docs/` already contains *MEWP Inspection (Daily)* and *All Areas Inspection*. Simon's clients already do these on paper/Word. | This is a separate record type from sign-off (a *finding*, not an *acknowledgement*), but it reuses the form builder, PDF generation, scheduling and reminders almost entirely. |
| **Actions / corrective action tracking** (owner, due date, evidence photo, close-out) | All suites | **Strong**: risk assessments already have a "further actions" field that nothing tracks. | This is what ties everything together. Failed inspection items, risk assessment actions, incident outcomes and consultant visit findings all create an action. |
| **Consultant site visit / audit reports** | Citation, Alcumus (internally) | **Strong, and unique to the consultancy tier.** This is Simon's core billable activity. | Mobile audit on site → photos → findings → branded report PDF emailed to the client → findings become actions assigned to the client's admin. It turns the platform into the consultancy's *delivery tool*, not just a document store. |
| **Training & certificate records** (CSCS, first aid, IPAF, PASMA, FLT, with expiry) | BrightSafe, most suites | **Strong**: same "who is competent, and is it in date?" question as sign-off. | Upload the certificate, set an expiry, get reminders. It feeds the matrix (§2.3). Cheap to build on top of recurring expiry (§2.1). |
| **Incident / accident / near-miss reporting** incl. RIDDOR | Notify, all suites | **Adjacent** but high demand. A UK business legally needs an accident book, and paper ones have GDPR issues. | A QR code on the kiosk or poster opens a short report form. It flags RIDDOR-reportable categories and deadline countdowns (10 days / 15 days), then routes to the customer admin and the consultant. Keep it simple: a form + workflow, not an investigation suite. |
| **Risk assessment builder with 5×5 matrix** | BrightSafe, Citation | **Strong**: RA templates are already in `example_docs/`. | Add a computed "risk score" field type (likelihood × severity → colour band) and residual risk. Everything else is the existing form builder. |
| **Asset / equipment register** (PAT, LOLER, extinguishers, ladders, with QR tags) | SafetyCulture, Elogbooks | **Adjacent** | A QR on the equipment opens its inspection history and today's check. It pairs naturally with inspections. Later. |
| **COSHH register with SDS storage** | Most suites | **Adjacent** | Substance list + SDS PDF + linked COSHH assessment. The COSHH starter template exists already. Later. |
| **Contractor pre-qualification** (insurance, RAMS, accreditations with expiry) | Alcumus, Donesafe | **Adjacent** | Largely the certificate-expiry feature applied to companies instead of people. Later / Enterprise. |
| **Permit to work** | Enterprise suites | **Out of scope** | Heavy workflow, low fit for SMEs. |
| **Legal register / regulatory update feed** | Consultancies, Barbour | **Adjacent** | A consultancy tenant could publish "legislation update" notices to all clients, each linked to the affected templates. Good consultancy-tier content. |
| **Mobile app / offline** | SafetyCulture | Later | A PWA first (installable, offline inspections with sync). A native app only if inspections take off. |
| **SSO (Microsoft Entra / Google)** | Enterprise tiers everywhere | Enterprise tier | The NextAuth provider swap is modest. |
| **Integrations** (Teams/Slack notifications, HRIS sync such as BambooHR/BrightHR, API & webhooks) | Mid/enterprise | Higher tiers | HR sync removes the "leavers/starters" admin burden entirely. |

---

## 4. Automations that make H&S jobs easier

Grouped by who they save time for. ⚙️ = rules-based (cron/event), 🤖 = AI-assisted with a human-review gate. AI output is never auto-published, following the precedent set by question generation.

### For the consultancy (Simon)
| Automation | Type | Saves |
|---|---|---|
| Template review-date reminders + "Reviewed, no changes" one-click (§2.2) | ⚙️ | Tracking review dates in a spreadsheet |
| **Monthly client compliance report**: auto-generated branded PDF per client, emailed to the customer admin and CC'd to the consultant | ⚙️ | Hours of monthly reporting. Also *shows the client the consultancy's value every month*, which is a retention tool for Simon's own business. |
| Weekly "chase list" digest: top overdue items across all clients, grouped by client | ⚙️ | Opening the outstanding page daily |
| Legislation update → list of templates likely affected (keyword/AI match on template text) | 🤖 | Manually re-reading the library after each HSE change |
| Draft a risk assessment / method statement from a short task description, using the tenant's own templates as style examples | 🤖 | First-draft authoring time |
| Scanned paper form → structured record (Document Intelligence is already provisioned) | 🤖 | Re-typing historic paper records. Also fixes the "scanned PDF can't generate questions" gap. |
| Site visit findings → auto-created client actions with due dates | ⚙️ | Writing up and chasing visit reports |

### For the client company (Customer Admin)
| Automation | Type | Saves |
|---|---|---|
| Recurring re-sign-off and certificate expiry reminders (§2.1) | ⚙️ | Tracking annual refreshers |
| **Escalation chain**: overdue X days → line manager, Y days → customer admin, Z days → consultant | ⚙️ | Manual chasing. Tenant-configurable. |
| Onboarding packs auto-assigned on user creation or HR sync (§2.6) | ⚙️ | Remembering what each new starter needs |
| Leaver detected (HR sync / import) → removed from outstanding counts | ⚙️ | Stats polluted by people who left |
| Weekly team digest email ("3 overdue, 2 expiring this month") | ⚙️ | Logging in to check |
| Scheduled inspections with missed-inspection alerts; a failed item auto-creates an action | ⚙️ | Paper checklists nobody reviews |
| RIDDOR deadline countdown on reportable incidents | ⚙️ | Missing statutory deadlines |

### For the worker
| Automation | Type | Saves |
|---|---|---|
| **SMS / WhatsApp reminders** with a magic link, for no-email workers (ACS supports SMS) | ⚙️ | Relying on the line manager to pass the message on |
| Translation + read-aloud (§2.9) | 🤖 | Misunderstood safety documents |
| Plain-English key-point summary before long documents | 🤖 | Wading through a 20-page policy |
| Calendar (iCal) feed of due dates | ⚙️ | Forgetting deadlines |

**Cost note:** SMS and AI have real per-use cost, and email is capped at 100/day on the ACS free tier. These must be metered per tenant and tied to plan quotas and add-on credits (§6), so a free-tier user can't create a bill.

---

## 5. SaaS prerequisites (Phase 0: before charging anyone)

None of these is a customer-visible feature, but all of them block a subscription launch.

1. **Multi-tenancy enforcement.** `tenantId` exists but isn't enforced. Every query needs tenant scoping. Consider Postgres Row-Level Security as a backstop, and put tenant context in the JWT. See the Multi-tenancy section of `future-considerations.md`. **This is the largest single piece of work, and the riskiest to get wrong,** so do it first and test it hardest (cross-tenant access tests on every route).
2. **Self-serve signup + onboarding wizard.** Create a tenant, choose "consultancy" or "single business", seed the starter template library, invite the first users, and send a sample assignment to themselves.
3. **Billing: Stripe Billing.** Subscriptions, hosted checkout, customer portal (card changes, invoices, cancel), webhooks → `Tenant.plan` / `subscriptionStatus`, trial periods, and Stripe Tax for UK VAT.
4. **Entitlements layer.** A single `getEntitlements(tenantId)` that returns plan limits and feature flags, checked in API routes (authoritative) and the UI (hides or upsells). Usage counters for metered items: active workers, client companies, AI calls, SMS, storage.
5. **Downgrade / cancellation rules.** See the principle in §6.4: never delete or lock away signed records.
6. **White-labelling** (consultancy tier): logo, brand colour (the design tokens make this cheap: override `--brand`), email sender name, and later a custom domain and sending domain.
7. **Infrastructure off free tiers.** App Service F1 (60 CPU-min/day), the Neon free tier and 100 emails/day won't survive paying customers. Budget B1 plus a paid Neon tier (or the pre-scaffolded Flexible Server) plus ACS pay-as-you-go before launch, and do a cost-per-tenant estimate to sanity-check prices.
8. **Legal and trust:** terms of service, privacy policy, DPA (clients will ask, because this is employee personal data), a sub-processor list (Azure, Neon, Stripe, AI provider), and a cookie notice.
9. **Operational basics:** error monitoring (e.g. Sentry / App Insights), a status page, in-app help or knowledge base, a changelog ("what's new" also drives retention), and full data export on cancellation.

---

## 6. Subscription model

### 6.1 Two buyer types, one model
- **Consultancies** (Simon's business model): manage many client companies and pay for the platform as a tool to deliver their service. They may bundle it into their retainer.
- **Direct businesses** (SMEs managing their own H&S): one company, so they're effectively a tenant with exactly one client company.

Model both as a `Tenant` with a plan. A direct business is simply a tenant whose plan allows one company. This avoids building two products.

### 6.2 Value metric
Per-user pricing (the SafetyCulture model) punishes the workforce Minato is best at: many low-tech, no-email workers who sign a handful of documents a year. Price instead by **active worker bands** (for direct plans) and **client company bands** (for consultancy plans). Admin seats stay generous. Kiosk-only workers count as workers, but bands keep the maths predictable for the buyer.

### 6.3 Proposed tiers

Prices are **placeholders to validate** with Simon and a handful of prospects. They are not researched market prices.

| | **Free** | **Essentials** | **Professional** | **Consultancy** | **Enterprise** |
|---|---|---|---|---|---|
| Indicative price | £0 | ~£29–39/mo | ~£79–119/mo | ~£149/mo base, bands by client count | Custom |
| For | Trying it / micro-business | Small business, core compliance | Growing business wanting automation | H&S consultancies | Larger orgs / consultancy groups |
| Companies | 1 | 1 | 1 | 10 incl. → bands (25 / 50 / 100 / unlimited) | Unlimited |
| Active workers | 10 | 50 | 250 | Per client: by band, or pooled | Unlimited |
| Admin users | 1 | 3 | 10 | Unlimited consultancy staff + 1 admin per client | Unlimited |
| Active templates | 5 | Unlimited | Unlimited | Unlimited + push library to clients | Unlimited |
| Form builder + Word/PDF upload + e-signature + signed PDFs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comprehension questions | ✅ manual | ✅ | ✅ | ✅ | ✅ |
| Email notifications + standard reminders | ✅ (capped volume) | ✅ | ✅ | ✅ | ✅ |
| Versioning, change log, diffs | Latest only | ✅ | ✅ | ✅ | ✅ |
| Job-role targeting + auto-enrol | — | ✅ | ✅ | ✅ | ✅ |
| **Kiosk sign-off** (no-email workers) | — | ✅ | ✅ | ✅ | ✅ |
| Recurring re-sign-off / expiry (§2.1) | — | ✅ | ✅ | ✅ | ✅ |
| Training matrix (§2.3) + CSV/XLSX export | View only | ✅ | ✅ | ✅ | ✅ |
| Bulk import, leavers, onboarding packs | — | ✅ | ✅ | ✅ | ✅ |
| Certificate & training records (§3) | — | ✅ | ✅ | ✅ | ✅ |
| Group / toolbox-talk sign-off (§2.7) | — | ✅ | ✅ | ✅ | ✅ |
| Compliance pack export (§2.4) | — | — | ✅ | ✅ | ✅ |
| Tamper-evident verification QR (§2.8) | — | — | ✅ | ✅ | ✅ |
| Escalation chains + configurable reminders | — | — | ✅ | ✅ | ✅ |
| Inspections + actions (§3) | — | — | ✅ | ✅ | ✅ |
| Incident / near-miss reporting | — | — | ✅ | ✅ | ✅ |
| AI: question generation, summaries, translations | — | Small monthly quota | ✅ quota | ✅ larger quota | ✅ custom |
| SMS reminders | — | Add-on credits | Credits included | Credits included | Custom |
| Client self-serve portal (client admins build own templates) | n/a | n/a | n/a | ✅ | ✅ |
| **Consultant site-visit audits + branded reports** | — | — | — | ✅ | ✅ |
| **Automated monthly client compliance reports** | — | — | — | ✅ | ✅ |
| Cross-client dashboards, chase-list digests, legislation-update broadcasts | — | — | — | ✅ | ✅ |
| White-label (logo/colours); custom domain | — | — | Logo only | ✅ / domain add-on | ✅ |
| SSO, API/webhooks, HR integrations | — | — | — | Add-on | ✅ |
| Configurable retention + Azure-enforced immutability | Default 5 yrs | Default | Configurable | Configurable | Locked-mode immutability, custom |
| Support | Docs | Email | Priority email | Priority + onboarding call | SLA, named contact |

**Add-ons (any paid tier):** SMS credit packs, extra AI credits, extra storage, extra client-company bands, and premium template packs (see §6.5).

### 6.4 Tier design principles
- **Free must demonstrate the full core loop** (create → assign → read → answer → sign → PDF), otherwise it converts no one. It is limited by *scale* (10 workers, 5 templates) and *automation*, not by crippling the core. The free tier should give a small business something they genuinely use, so they hit the 10-worker limit or want kiosk sign-off, and upgrade.
- **Kiosk is the natural first paywall.** It's the feature that makes Minato work for real non-desk workforces, and most competitors don't handle no-email workers well.
- **Automation and evidence sit higher up.** Recurring, escalation, compliance packs and verification are the features people pay more for because they save time or reduce audit risk.
- **Consultancy features are a separate axis**, not simply "more": multi-client, white-label and client reporting. A consultancy pays because it makes *their* business more efficient and *looks* more professional to their clients.
- **Never hold signed records hostage.** On downgrade or cancellation, signed PDFs stay downloadable, read-only, for the full retention period, and a full export is always available. This is both a legal necessity (retention obligations) and a trust signal worth stating on the pricing page. Over-limit accounts become read-only for *new* assignments, but never lose access to records.
- **Metered costs are gated.** AI, SMS and high email volume are quota'd per plan so the free tier can't generate costs. Free-tier email volume is capped at the tenant level to protect the shared ACS daily limit.
- **Annual billing discount** (e.g. 2 months free). H&S buyers budget annually, and it improves cash flow and retention.

### 6.5 Additional revenue ideas
- **Template marketplace / content packs.** Simon's library (policies, RAs, inspections) is valuable content. Sell curated packs ("Construction starter pack", "Food manufacturing pack") to direct businesses, with a revenue share to the authoring consultancy. It also gives free/Essentials users something to buy without changing plan.
- **Consultancy reseller model.** Consultancies resell Minato to their clients inside their retainer, with the consultancy billed wholesale. This is the most natural route to many SMEs, and Simon is the first design partner.
- **Setup / migration service.** A one-off fee to import a client's existing paper/Word library and staff list.

---

## 7. Phased plan

### Phase 0 — SaaS foundations (before charging; required)
1. Multi-tenancy enforcement + cross-tenant tests (§5.1)
2. Entitlements layer + plan model (§5.4)
3. Stripe Billing + customer portal + webhooks (§5.3)
4. Self-serve signup + onboarding wizard + seeded starter library (§5.2)
5. Legal pages, DPA, privacy policy, GDPR erasure/anonymisation (§5.8, `data-management.md` §4)
6. Move infrastructure off free tiers, add monitoring, and estimate cost per tenant (§5.7, §5.9)

### Phase 1 — Release-ready core gaps (with Phase 0 or immediately after)
Small-to-medium builds, all inside the core purpose, that make the paid tiers credible:
1. User status / leavers + bulk CSV import (§2.5)
2. Recurring re-sign-off + completion expiry (§2.1)
3. Template review dates (§2.2)
4. Training matrix + export (§2.3)
5. Escalation chains + configurable reminder schedule
6. Weekly digests (consultant + customer admin)
7. Known small gaps (§2.10)

### Phase 2 — First 3–6 months after release (upsell to Professional/Consultancy)
1. Compliance pack export (§2.4)
2. Tamper-evident hash + verification QR + IP/UA capture (§2.8)
3. Onboarding packs / template bundles (§2.6)
4. Group / toolbox-talk sign-off (§2.7)
5. Certificate & training records with expiry
6. Automated monthly client compliance reports (consultancy)
7. White-label (logo/colours)
8. SMS reminders (metered)

### Phase 3 — Expansion modules (6–12 months, driven by customer demand)
1. Inspections & checklists (scheduled, photos, scoring). Start from `example_docs/` MEWP/All Areas.
2. Actions / corrective action tracking (links inspections, RAs, visits)
3. Consultant site-visit audits with branded reports → client actions
4. Risk-assessment 5×5 matrix field type
5. Translations + read-aloud + key-point summaries (AI, human-approved)
6. PWA / offline for inspections

### Phase 4 — Later / Enterprise (only on demand)
Incident/near-miss + RIDDOR, asset register with QR tags, COSHH register, contractor pre-qualification, SSO, API/webhooks, HR integrations, Azure locked-mode immutability, legislation update broadcasts, template marketplace.

---

## 8. Open questions to validate (ideally with Simon and 3–5 prospects)

1. Which documents do Simon's clients re-sign annually vs only on revision? This validates §2.1 as the top priority.
2. How many client companies does Simon expect to have on the platform in year 1, and would he pay per client or pass the cost on?
3. What share of client workforces have no email? This decides whether kiosk and SMS belong in the entry paid tier.
4. Do clients do paper inspections today (daily vehicle/MEWP/forklift checks)? If so, inspections move up to Phase 2.
5. Which languages are most common among client workforces?
6. What would clients pay today? What do they currently pay for H&S software or consultancy retainers?
7. Is there any sector requirement for qualified/advanced e-signatures over the current audit-trail approach? (Already an open question in `future-considerations.md`.)
8. Would Simon want to sell his template library to other consultancies or businesses (§6.5)?
