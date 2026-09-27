# Architectural Decision Record

Archive of the "why" behind past architectural/technical decisions — for Alan's future reference (e.g. if the project expands or is re-evaluated), not something that needs re-reading day to day. Current-state facts (schema, file locations, what exists today) live in `CLAUDE.md`; forward-looking gaps and open questions live in `future-considerations.md`. This file exists so that history doesn't have to be re-derived or re-argued later.

Each entry: context that prompted the decision, what was decided, and why. Superseded decisions are marked rather than deleted.

---

## ADR-001 — Relational data moved to PostgreSQL; Table Storage kept only for logs

**Context:** The app originally stored everything in Azure Table Storage. The templates → assignments → completions model needs many-to-many relations (customers ↔ templates), per-assignment state, per-user access scoping within a company, transactional writes (create assignment + log activity atomically), and relational queries ("which templates does this customer have?"). Table Storage handles none of these well.

**Decision:** All relational data moved to Neon PostgreSQL via Prisma (`Tenant`, `User`, `CustomerCompany`, `DocumentTemplate`, `Assignment`, `CompletionRecord`, etc.). Azure Table Storage was kept for exactly one table, `activityLogs` — append-only, time-series, no relational queries, a good fit for Table Storage's strengths. Blob Storage remains the file store regardless.

**Why not stay Table-Storage-only:** the target document model is inherently relational; forcing it into Table Storage's partition/row-key model would have meant hand-rolling joins and losing transactional guarantees.

---

## ADR-002 — No separate `CustomerUser` model

**Decision:** Customer-side users are ordinary `User` rows with a nullable `customerCompanyId` set, rather than a second user table/model.

**Why:** a "customer user" only differs from consultancy staff by which company they belong to and which role they hold — both already modelled on `User`. A separate model would have duplicated auth, session, and role plumbing for no structural benefit.

---

## ADR-003 — Five fixed roles, tenant-scoping deferred

**Decision:** `Platform Admin`, `Tenant Admin`, `Tenant Staff`, `Customer Admin`, `Customer User` — stored as strings on `User.role`, attached to the JWT at sign-in (`src/types/rbac.ts`).

**Deferred, not forgotten:**
- Role assignments will need to be scoped per-tenant once multi-tenancy (ADR-007) is built — the JWT will need to carry tenant context alongside the role, not just today's implicit single-tenant assumption.
- A `Read-only`/`Auditor` role was considered and deliberately not added until a concrete use case appears.

---

## ADR-004 — Electronic signing: audit trail + canvas signature, not third-party e-signing

**Decision:** A signed completion = `signedById` + `signedAt` timestamp + a typed declaration name matched against the account name + a canvas-drawn signature (`react-signature-canvas`) baked directly into the server-rendered PDF as an image. The signature is captured client-side, sent once as part of the completion request, and never persisted separately (no DB column, no separate blob) — since the PDF it's embedded into is itself immutable and never regenerated, there was nothing to gain from storing the raw signature a second time.

**Why not DocuSign/Adobe Sign/Yoti:** legally stronger and tamper-evident with a real certificate chain, but costs money and adds integration complexity. Not justified absent a specific legal or customer requirement — revisit if one emerges.

---

## ADR-005 — PDF generation via `@react-pdf/renderer`

**Decision:** Completion PDFs are rendered server-side with React-PDF inside the Next.js API route that handles submission, rather than a headless-browser HTML→PDF pipeline or a third-party PDF API.

**Why:** free, no external service dependency, fits naturally into a Next.js API route (render React components → PDF buffer → upload). Immutability comes from never rewriting a completion's blob path once written, not from anything PDF-specific.

---

## ADR-006 — Document Intelligence deferred; `formData` designed in from the start

**Decision:** Don't integrate Azure Document Intelligence (OCR / structured extraction from scans) until there's a concrete need — e.g. customers uploading scanned paper forms, or a requirement to search/filter across historical form responses. `CompletionRecord.formData Json?` was included in the schema from its first version specifically so structured data has somewhere to live once that need arrives, without a schema change.

**Trigger conditions to revisit:** scanned/paper-only intake becomes common, or cross-form search/filtering is requested. Free tier is 500 pages/month if/when this is picked up.

---

## ADR-007 — Multi-tenancy: shared database, tenant-scoped rows (not yet built)

**Decision, for when the platform is opened to other H&S companies:** add a `tenantId` column to every table and scope all queries by it, optionally enforced with PostgreSQL row-level security — rather than a database-per-tenant model.

**Why:** simpler to operate than per-tenant databases and scales to hundreds of tenants without infrastructure sprawl. The schema already carries a `Tenant` table and a nullable `tenantId` on `User` specifically so this is additive later rather than a retrofit — adding multi-tenancy to a schema designed for it is straightforward; retrofitting it onto one that wasn't is painful.

**Do not build ahead of need** — this is recorded so the shape is known when the SaaS pivot becomes real, not a signal to start now.

---

## ADR-008 — Free-tier-first infrastructure, with named upgrade triggers

**Decision:** stay on free tiers for every service until there's paying-customer revenue to justify the spend, rather than provisioning for scale up front.

| Service | Free tier | Upgrade trigger |
|---|---|---|
| Azure App Service | F1 — 60 CPU min/day, 1 GB RAM | Custom domain + SSL needed → B1 (~£10/month) |
| Azure Blob Storage | 5 GB free (12 months) | Storage growth — cheap beyond free tier, not a real concern |
| Azure Table Storage | 5 GB free (12 months) | Activity logs only |
| Neon PostgreSQL | Free tier, 0.5 GB, auto-suspend | DB growth → Neon paid (~$19/month) or Azure Postgres Flexible Server (~£25-50/month, module scaffolded at `infrastructure/modules/postgres_flexible_server/` but not wired in — swap is a module block + `DATABASE_URL` app-setting change, no code change) |
| Azure Communication Services | 100 emails/day free | >100 emails/day → pay-per-email (~£0.00025/email) |
| Azure Document Intelligence | 500 pages/month free | See ADR-006 |
| GitHub Actions / GHCR | 2,000 min/month; free public images, 1 GB private | Not expected to bind soon |

---

## ADR-009 — Gotenberg as its own container for Word→PDF conversion

**Context:** upload-based documents (P19) need Word→PDF conversion. Bundling LibreOffice into the app's own hardened runtime image was considered and rejected — it would bloat and complicate that image for a capability only a subset of requests use.

**Decision:** delegate conversion to [Gotenberg](https://gotenberg.dev) (a stateless HTTP wrapper around LibreOffice) running as a separate container, called via `POST {GOTENBERG_URL}/forms/libreoffice/convert` (`src/lib/document-conversion.ts`).

**Networking tradeoff:** the App Service Plan is Free (F1) in both Dev and Prod, which doesn't support regional VNet integration — so Gotenberg can't be made network-private without a plan upgrade (~$13/month for B1). Accepted: run it on a public endpoint, locked down with Gotenberg's built-in basic auth (Terraform-generated credentials, stored in Key Vault, injected as `GOTENBERG_BASIC_AUTH_USERNAME`/`PASSWORD`). **Revisit with VNet-scoped ingress if the App Service Plan is ever upgraded to B1+.**

**Compute tier (superseded once, 2026-07):** originally ran on Azure Container Instances, which bills for a fixed-size container around the clock regardless of use — noticeably more expensive than expected. Moved to an Azure Container App on the Consumption plan: scales to zero between conversions, and draws from its own free monthly grant (vCPU-seconds/GiB-seconds/requests) separate from the App Service F1 tier's shared 60 CPU-minute/day-per-region budget that dev and prod already split. Ingress is also now TLS-terminated by the platform.

---

## ADR-010 — Retain the original Word file alongside the converted PDF

**Decision:** whenever a Word document is converted to PDF (template source documents, and employee fill-and-return submissions), the original Word file is always retained too, not discarded after conversion.

**Why:** a PDF isn't practically re-editable. Without the original, renewing a template (or amending a submission) would mean re-authoring it from scratch. Retaining the original turns renewal into "edit the retained original, re-upload" instead of "lose editability entirely."

---

## ADR-011 — Cheap general-purpose LLM over a dedicated SLM for comprehension-question generation

**Decision:** comprehension-question suggestions (Simon reviews/edits before anything is saved — never auto-published) are generated via Azure AI Foundry using a cheap, general-purpose "nano"-class GPT deployment (pay-per-token, no reserved capacity), rather than a dedicated small-language-model family such as Phi. `version_upgrade_option = "NoAutoUpgrade"` was set deliberately.

**Why:** generation only fires on-demand (an admin clicks "Generate with AI"), so at this volume the cost difference between an SLM and a cheap LLM is negligible — reliability of structured JSON output matters more than shaving fractions of a cent. `NoAutoUpgrade` avoids a model retirement silently changing output quality/cost without a human noticing; check the deployed model's retirement date on its Azure AI Foundry catalog card periodically.

---

## ADR-012 — UI redesign: adopt Supabase Studio's resolved token values, not its derivation engine

**Context (P21):** the UI was stock shadcn/ui "new-york" on the default slate palette. Target: Supabase Studio's visual language. Supabase's dashboard is built on the same foundation as this project (shadcn/ui + Tailwind v4 CSS-first tokens), and their semantic token names are shadcn's — so most of the work was a token swap, not a rewrite. Their actual system derives every colour in OKLCH from a handful of inputs (`--surface`, `--chroma`, `--hue 159`, `--contrast`, `--elevation-step`).

**Decision:** take Supabase's *resolved output* colour values as literals rather than porting their derivation engine.

**Why:** the derivation engine is machinery built for a multi-brand design system managing many products; this is a single-product app, so porting it would have been more infrastructure than the payoff justified.

**Decisions bundled into the same pass:**
- **Dark by default** (light retained, toggleable) — the target palette is a dark-native design language; dark values live on `:root` so an unclassed document still paints dark, with a blocking inline script in `layout.tsx` applying the stored theme class before first paint (without it, a dark-default app flashes white on every load).
- **Inter + Source Code Pro**, not Supabase's actual fonts — their sans is the proprietary Circular, which can't be shipped; Source Code Pro is their real mono and is on Google Fonts.
- **`default` stays the emphasised/brand button variant.** In Supabase's own vocabulary `default` is the quiet neutral button and `primary` is the green one — adopting that naming verbatim would have silently demoted every existing CTA across roughly 100 call sites. Supabase's neutral button was added as a new `surface` variant instead, and `default` kept its existing meaning.
- **Table headers are normal-case, not uppercase** — Supabase Studio's own are, and uppercase read badly against long real column values (e.g. a long document title).

---

## ADR-013 — Data retention & immutability decisions

Kept in their own file rather than duplicated here: **see [`data-management.md`](./data-management.md)** for the reasoning behind the retention-window guard (P22), the Azure Blob immutability policy design (unlocked vs. locked WORM, container vs. version-level), the GDPR erasure-vs-retention conflict, and per-company/jurisdiction retention variability. That file is itself already ADR-shaped and is the canonical record for this topic.
