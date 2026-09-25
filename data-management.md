# Data Management: Retention, Immutability & Erasure

This document covers the design decisions behind completion-record retention and deletion — what's built (P22, see `future-considerations.md`), what Azure-level enforcement would add, and the open policy questions that need answering (ideally with legal input) before building further. It exists separately from `future-considerations.md` because these decisions interact with each other in non-obvious ways — see "How the pieces interact" at the end.

---

## 1. What's built today (P22)

**Where it's set:** `/admin/settings` → "Data Retention" tab. A single number input (years) + Save.

**Who can set it:** Gated by `ADMIN_ROLES` (`Platform Admin`, `Tenant Admin`) via `GET`/`PATCH /api/admin/settings/data-retention` — the same access level as every other admin setting.

**Scope:** Per-`Tenant`, not per-company. `Tenant.completionRetentionYears Int @default(5)`. Since the app is single-tenant today, this is effectively **one retention period for the whole platform** — every client company's completions are governed by the same value. See §3 for what changing this would take.

**Enforcement:** Purely at the application layer. `DELETE /api/admin/completions/[id]` looks up the completion's `signedAt`, compares it against the tenant's retention period (`src/lib/data-retention.ts`'s `isWithinRetentionPeriod`), and returns 403 before it would otherwise call `deleteCompletionRecord()` + `deleteBlob()`. Both the single-record and bulk-select delete flows on `/admin/completions/[companyId]/[templateId]` go through this one endpoint, so both are covered.

**What this does *not* protect against** — the guard only holds if deletion goes through this API route:
- Someone deleting the blob directly via the Azure Portal, Storage Explorer, or the SDK with storage account credentials
- A future code path that calls `deleteBlob()` without going through this guard
- Deleting the `CompletionRecord` row directly in the database, bypassing the route entirely

Key files: `prisma/schema.prisma` (`Tenant.completionRetentionYears`), `src/lib/data-retention.ts`, `src/lib/user-database.ts` (`getAdminTenantId`/`getCompletionRetentionYears`/`updateCompletionRetentionYears`), `src/app/api/admin/settings/data-retention/route.ts`, `src/app/api/admin/completions/[id]/route.ts`, `src/app/admin/settings/page.tsx`, `src/app/admin/completions/[companyId]/[templateId]/page.tsx`.

---

## 2. Azure Blob immutability policies (not yet built)

The app-level guard above can be bypassed by anyone with storage account access. Azure Blob Storage has a real, Azure-enforced mechanism for this: **immutability policies** (WORM — write once, read many).

### Two flavours

- **Container-level (legacy)** — applies uniformly to every blob in the container. Wrong fit here: the existing `documents` container holds templates (edited/republished), scans, and uploads alongside completions, so a container-wide lock would break normal template editing.
- **Version-level (current)** — set **per blob**, via `BlobClient.setImmutabilityPolicy({ expiresOn, policyMode })` and `BlobClient.setLegalHold(bool)` (`@azure/storage-blob` v12.33, already a dependency — see `src/lib/storage.ts`). This is the right fit: each completion PDF gets its own expiry, computed from whatever retention rule applies to it at upload time.

### Prerequisites

- Blob versioning enabled account-wide (`blob_properties { versioning_enabled = true }`).
- The container must have "immutable storage with versioning" turned on **at creation** — Terraform's `azurerm_storage_container.immutable_storage_with_versioning = true`. This **cannot be retrofitted** onto an existing container.
- The existing `documents` container wasn't created with this. A new, dedicated container (e.g. `completions`) would be needed, used only for signed completion PDFs — which also means a migration path for existing completion blobs.
- An account with any container using this feature can't use blob point-in-time restore.

### Unlocked vs Locked — the decision that matters most

- **Unlocked**: the policy can still be shortened or removed, but only via elevated Azure-level storage account access — not through the app's normal admin role. A genuine, auditable "break glass" path.
- **Locked**: truly enforced by Azure. Can only be **extended**, never shortened or removed, by anyone — including whoever holds the storage account keys. This is the only mode that's tamper-proof against a compromised or coerced app-level admin.

**This choice directly determines whether an erasure override (§4) is ever possible.** Locked mode means no early deletion, full stop, until the policy's `expiresOn` naturally passes — not even for a legitimate GDPR or legal-order case. That tradeoff needs to be made deliberately, not defaulted into.

### App code changes, once the container exists

- At PDF-generation time (the existing complete/sign-off routes), call `setImmutabilityPolicy({ expiresOn: signedAt + retentionYears, policyMode })` right after upload.
- The existing `DELETE /api/admin/completions/[id]` guard becomes a nicety (friendlier error before even hitting Azure) rather than the only thing standing in the way — Azure itself rejects the blob delete with a 409 while the policy is active.

**Recommendation:** treat as a "before onboarding real paying customers with a live compliance obligation" item, not urgent pre-production. Bounded, well-understood scope once undertaken.

---

## 3. Different retention periods per company / jurisdiction

**Does this need a container per company? No.** Version-level immutability policies are set per blob, so each completion's `expiresOn` is simply computed from whatever rule applies to *that* completion's company at upload time. A UK company's completions can carry a 5-year lock and a company under different legislation can carry a different one, all in the same container — no container restructuring required, as long as version-level (not container-level) immutability is used.

**App-level change needed:** currently `Tenant.completionRetentionYears` is one value for the whole tenant. To vary it:
- Add a nullable `CustomerCompany.completionRetentionYears Int?`
- Change `getCompletionRetentionYears` to resolve: company override → tenant default
- The 403 guard already has `assignment.customerCompanyId` available on the completion it's checking, so no new lookup path is needed beyond this

This is a small, additive, non-breaking change from what's built — no migration of existing data required beyond the new nullable column.

**Is this actually needed right now?** Business context is a single UK consultancy serving UK client businesses under one legal regime, so a genuine cross-jurisdiction need would most likely arrive via the future SaaS pivot (a different H&S company, in a different country, as a separate `Tenant`) — and tenant-level defaults already vary independently per tenant today, since `Tenant.completionRetentionYears` is already scoped per tenant row. The gap is only ever *within one tenant*, i.e. if one consultancy's own client companies need different periods from each other (e.g. a contract-specific requirement). Worth building only if that scenario actually arises.

---

## 4. GDPR right to erasure vs the retention obligation

Prompted by: "what if a client company closes down and wants everything destroyed?"

**The legal shape of the conflict:** GDPR Article 17(3)(b) provides an explicit exception to the right to erasure — it doesn't apply where retention is necessary "for compliance with a legal obligation." UK H&S law's 3–5 year retention requirement for signed compliance documents is exactly that kind of obligation, and it typically doesn't lapse just because the client relationship ends — if anything, the record matters *more* after closure, in case of a future claim or HSE investigation. So **a request to destroy everything on closure is one the consultancy may be entitled, or even obligated, to partially refuse** for the signed documents specifically — while still being free to purge everything else tied to that company (login credentials, contact details, unsigned drafts, self-serve templates).

This split — "must retain" vs "may/must delete" — is exactly what `future-considerations.md` already flags as unbuilt ("design user deletion to anonymise rather than hard-delete where documents must be retained").

**What an override mechanism would actually need, if built:**
- A distinct, higher-friction action from the existing per-completion delete — scoped to a whole `CustomerCompany`, not one record at a time (today's UI would make bulk deletion for a closing company painfully slow one record at a time)
- Gated more tightly than `ADMIN_ROLES` alone — e.g. a typed confirmation (company name) plus a required, logged reason (`activityLogs`), since this is exactly the kind of action that needs an audit trail proving *why* retention was overridden
- A per-record choice between hard-delete and **anonymize-in-place** (keep the PDF/audit-trail structure, strip identifying fields like signer name/signature) — often the right answer when the compliance record itself must survive but the personal data within it doesn't need to
- If Azure-level immutability policies are in place (§2): the override must call the Azure-level policy removal (only possible in Unlocked mode, via elevated storage credentials) *before* `deleteBlob` can succeed — the app-level guard alone stops being sufficient once Azure-level policies exist

**The direct conflict with §2:** if Locked immutability is adopted for its stronger tamper-proofing, this override becomes *impossible* to build — Locked policies cannot be shortened or removed by anyone, ever, before their expiry. Choosing Locked mode is implicitly choosing to never be able to honour an early-erasure request, however legally justified, until the retention period naturally elapses.

**Not yet decided — needs legal input, not just engineering:**
1. Should Locked or Unlocked immutability be used (§2)? This gates whether §4's override can exist at all.
2. Is there ever a valid case where the consultancy *must* destroy a signed H&S record early, or does Art 17(3)(b) mean this genuinely never applies to the compliance documents themselves?
3. If an override is built, what's the sign-off process — does it require input beyond an admin's own judgement (e.g. Simon's legal counsel)?

---

## 5. Container-per-company for general data security?

A separate question from retention: is splitting blob storage into one container per client company worth it for isolation, independent of the above?

**Case for:**
- Stronger blast-radius isolation — a leaked SAS token or app bug is contained to one company's data rather than the whole platform
- Makes "delete everything for company X" (§4) architecturally trivial and safe — delete a whole container rather than carefully filtering blob paths company-by-company

**Case against, given what's actually built:**
- Real refactor, not a config change — 24 files reference `AZURE_STORAGE_CONTAINER_NAME` directly today (`src/lib/storage.ts`, `src/lib/file-system/*`, `document-templates.ts`, `completion-records.ts`, the documents browser, scan uploads, …). Every blob-path resolution function would need to also resolve *which* container.
- The app's real access-control boundary today isn't the container — it's the DB ownership check that runs before a short-lived SAS token is ever issued (e.g. `GET /api/customer/assignments/[id]/document` checks `assignment.customerCompanyId === session.user.customerCompanyId` first). That check still has to happen per request regardless of container layout — a container boundary would be defense-in-depth on top of an already-working control, not a replacement for one.
- Consultancy staff (Simon, Tenant Staff) legitimately need cross-company visibility — dashboards, activity logs, downloading any company's completions. A hard per-company split works against that access pattern; admin routes would need to fan out across N containers instead of querying one.

**Recommendation:** draw the isolation boundary at **tenant**, not company, and only once real multi-tenancy is built (already deferred in `future-considerations.md`). That's where the isolation actually matters — a future SaaS competitor's data shouldn't share infrastructure with Simon's — whereas different client companies of the *same* consultancy already share a trust boundary by design (Simon's own staff can see all of them). Company-level container isolation within one tenant would be solving a problem the current single-tenant setup doesn't have, at real refactor cost.

---

## How the pieces interact

These four questions can't be answered independently:

- **§2's Locked/Unlocked choice gates §4.** Pick Locked for maximum tamper-resistance and you've implicitly decided erasure overrides can never happen before natural expiry — anywhere, for any company, ever. Pick Unlocked and an override is possible but relies on an elevated-credential, out-of-band process rather than app-level enforcement alone.
- **§3's per-company retention variability composes cleanly with §2** as long as version-level (not container-level) immutability is used — each blob's `expiresOn` is independent, so different rules per company don't force a container split.
- **§5's container question is orthogonal to §2 and §3** — neither retention-duration flexibility nor immutability requires per-company containers, so that decision can be made on its own merits (and deferred) without blocking the retention work.

**Suggested order, if/when this gets built:** settle the Locked-vs-Unlocked policy question with legal input first (§2/§4 — it's the one decision that can't be easily undone later), then build version-level immutability with per-company retention support (§2+§3 together, since they touch the same upload code path), and leave container-per-company (§5) out of scope until real multi-tenancy is underway.
