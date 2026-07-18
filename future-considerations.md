# Future Considerations

## Business Context

This app is a health and safety document management platform. The primary customer is a small H&S consultancy (two to three employees) that serves up to 100 client businesses. The consultancy (Simon's business) is the initial and currently only tenant. Alan is the sole developer.

The platform may eventually be marketed to other H&S companies or to businesses that manage their own H&S compliance — this is a meaningful SaaS pivot that should inform architectural decisions now.

---

## Workflow Implementation Plan

This section maps Simon's stated workflow (see README "How It Works") to the current implementation, identifies gaps, and prioritises remaining work.

### Status summary

| Step | Feature | Status |
|---|---|---|
| 1 | Document upload + indexing (ref, name, date, version) | ✅ Done (blob storage + template record) |
| 2 | Comprehension questions per document | ✅ Done — admin builder + server-side validation + customer answer form |
| 3 | Job role-based assignment to individuals | ✅ Done — individual-level assignment (userId nullable) + job role filtering (targetJobRoles on Assignment, jobRole on User) |
| 4a | Email notification on assignment | ✅ Done — fire-and-forget from assignment POST; individual → assigned user, company-wide → all matching job-role users |
| 4b | No-email worker name-entry sign-off | ✅ Done — public kiosk at `/signoff/[companyId]`; workers select name, complete form, submit via unauthenticated API |
| 4c | Line manager reminder for no-email workers | ✅ Done — `resolveEmailRecipients` routes all notifications (assignment + reminders) to line manager for no-email users |
| 5 | Read + answer questions + digital sign-off | ⬜ Partial — sign-off done, questions done, signature pad not yet |
| 6a | Completed vs overdue report | ✅ Done — `dueDate` on assignments; admin completions view shows per-assignment breakdown (completed vs outstanding) with overdue badge |
| 6b | Automated reminder notifications for overdue | ✅ Done — daily GitHub Actions cron → `GET /api/cron/reminders` (Bearer token auth) → `getAssignmentsNeedingReminders` → `sendReminderNotification`; schedule: 3 days before, 1 day before, due date, then weekly |
| 7/8 | New document version triggers new assignment cycle | ✅ Done — `version` on `DocumentTemplate`; "Publish as New Version" in edit dialog + standalone button; auto-creates assignments for all previously assigned companies/users; completions list shows per-version badges |

### Priority order and detail

#### P1 — Comprehension questions ✅ Done
Admin defines 2–3 multiple-choice questions per template via the Edit Template dialog — each question has a set of options and one marked as correct. Options are shown to customers as radio buttons; the correct answer is stored server-side only. On the customer completion page, questions appear as a "Comprehension Check" section; answers are validated server-side on submission (exact string match against the correct option). Wrong answers return HTTP 400 with `failedQuestionIds`; the UI highlights failed questions and lets the customer re-select and resubmit.

Key files: `src/types/comprehension-question.ts`, `src/lib/document-templates.ts` (`questions` field), `src/lib/assignments.ts` (strips answers before returning to client), `src/app/api/customer/assignments/[id]/complete/route.ts` (validates answers), `src/components/admin/edit-template-dialog.tsx` (question builder), `src/app/customer/documents/[assignmentId]/complete/page.tsx` (answer form).

#### P2 — Individual-level assignment and overdue tracking ✅ Done

- ✅ `dueDate DateTime?` on `Assignment`; set via admin assign dialogs (both company-wide and individual)
- ✅ `getAssignmentStatusSummary` in `src/lib/completion-records.ts` — returns completed users, outstanding users, isOverdue (still used by the per-assignment Customer Admin completions view)
- ✅ Admin completions view (`/admin/completions/[companyId]/[templateId]`) shows completed + outstanding sections with overdue badge
- ✅ Company completions list (`/admin/completions/[companyId]`) now shows ALL templates (not just those with completions), with status/overdue/outstanding count columns and due date, one row per template — see "Company completions grouping" below
- ✅ Company detail page shows due date column in both assignment tables

**Company completions grouping (added after the list started showing the same template repeated 2–4×):** the raw `Assignment` table can have several rows behind one visible template — one per published version (old versions are replicated forward, not replaced, when `createAssignmentsForNewVersion` runs) and one per individual auto-enrolled user layered on top of a company-wide assignment. `getCompletionGroupsByCompany` now groups by `templateId`, keeps only the highest `templateVersion` (older versions can never be completed since employees only ever see the latest — `getAssignmentsForUser` already dedupes to it), and merges same-version assignments into one row (summed completion count; expected count = all company users if any assignment in the group is company-wide, else one per individual assignment; earliest due date; latest completion date). `getTemplateCompletionSummaryForCompany(companyId, templateId)` is the equivalent merged detail view, backing `GET /api/admin/companies/[id]/completions/[templateId]` and the `/admin/completions/[companyId]/[templateId]` page. The cross-company `/admin/completions/outstanding` page (`getOutstandingCompletions`) intentionally stays one row per assignment — it's used for reminder-chasing where the distinction between individual/company-wide/job-role-targeted assignments matters. The Customer Admin equivalent (`/customer/admin/completions`) has not been changed and may have the same duplication.

#### P3 — Job role-based assignment ✅ Done

- ✅ `jobRole String?` on `User` (freeform string; null = no role set = sees all assignments)
- ✅ `targetJobRoles Json?` on `Assignment` (string array; null/empty = visible to all users in company)
- ✅ Filtering rule: assignment is visible if `targetJobRoles` is null/empty, OR `user.jobRole` is null, OR `user.jobRole` is in `targetJobRoles`
- ✅ `getAssignmentsForUser` applies filtering for company-wide assignments (individual assignments bypass filter — already targeted at a specific user)
- ✅ `jobRole` included in JWT/session so no extra DB query per customer request
- ✅ Customer assignments route passes `session.user.jobRole` to `getAssignmentsForUser`
- ✅ Admin assign-template dialog has comma-separated "Restrict to job roles" input
- ✅ Company detail page shows `targetJobRoles` column in company-wide assignments table
- ✅ User details dialog: replaced non-functional `jobTitle`/`department` fields with `jobRole`
- ✅ Create user dialog: optional `jobRole` field shown for customer roles
- ✅ Users admin table: Job Role column added

#### P4 — Email notifications on assignment ✅ Done

When a document is assigned, relevant users receive an email with a link to their documents page.

- `src/lib/email.ts` — reusable `sendAssignmentNotification(recipients, templateTitle, dueDate, baseUrl)` wrapping ACS `EmailClient`
- Triggered fire-and-forget from `POST /api/admin/companies/[id]/assignments`
- Individual assignment → notifies the assigned user (`getUserById`)
- Company-wide assignment → notifies all company users filtered by `targetJobRoles` (`getUsersByCompany` + same job-role filtering logic as customer view)
- Email failure is logged but never blocks the HTTP response or the assignment creation

#### P5 — Automated reminder notifications ✅ Done

- `src/lib/reminders.ts` — `isReminderDay(dueDate, today)` (true on days -3, -1, 0, -7, -14, … relative to due) and `getAssignmentsNeedingReminders(today)` (queries all assignments with due dates, returns outstanding users per assignment with job role filtering applied)
- `GET /api/cron/reminders` — requires `Authorization: Bearer {CRON_SECRET}`; calls reminders lib, sends `sendReminderNotification` per target; returns `{ sent: number }`
- `.github/workflows/reminders.yml` — GitHub Actions scheduled workflow, 08:00 UTC daily, calls the cron endpoint using `prod` environment secrets (`NEXTAUTH_URL` var + `CRON_SECRET` secret)
- Requires `CRON_SECRET` as a GitHub Actions secret and Next.js env var in each environment
- No-email worker line manager routing implemented in P6 — `getAssignmentsNeedingReminders` calls `resolveEmailRecipients`; assignments where all users resolve to no recipients are skipped

#### P6 — No-email worker support and line manager routing ✅ Done

No-email workers are stored as regular `User` records with `email = null` and `passwordHash = null`. They cannot log in (the login gate checks `passwordHash` before calling bcrypt). Their `lineManagerId` points to another user who receives their notifications.

- ✅ `User.email String?`, `User.passwordHash String?` — nullable; migration `20260523000000_no_email_worker`
- ✅ `User.lineManagerId String?` — self-referential FK to `User.id` (ON DELETE SET NULL); no-email workers have their line manager set here
- ✅ `resolveEmailRecipients(users)` in `src/lib/user-database.ts` — maps users → `{email, name}[]`; routes no-email users to their line manager; deduplicates by email address
- ✅ Assignment notifications (`POST /api/admin/companies/[id]/assignments`) call `resolveEmailRecipients` before sending — no-email workers' managers get the notification
- ✅ Reminder cron (`src/lib/reminders.ts`) calls `resolveEmailRecipients` — assignments where all outstanding users resolve to no recipients are skipped entirely
- ✅ Public kiosk at `/signoff/[companyId]` — `GET /api/signoff/[companyId]` returns company name + workers + their pending assignments; worker selects name from dropdown, clicks assignment, completes form; `POST /api/signoff/[companyId]/[assignmentId]` validates workerId (must be a no-email user in this company), validates comprehension answers, records completion, generates PDF — same as the authenticated flow
- ✅ Admin company detail page shows kiosk URL with copy button
- ✅ Create user dialog and user details dialog support no-email workers: line manager dropdown shown when email is blank; line manager dropdown only shows users with email addresses
- ✅ Admin users page and company page show "No email — kiosk" for null email fields

#### P7 — Document version cycle ✅ Done

When Simon uploads a new version of a document, the new version triggers a fresh assignment + completion cycle.

- ✅ `DocumentTemplate.version Int @default(1)` — explicit version number, incremented on publish
- ✅ `Assignment.templateVersion Int @default(1)` — snapshot of template version at assignment creation; unique index now includes version so multiple versions can coexist per template per company
- ✅ `publishNewTemplateVersion(id, updates?)` in `src/lib/document-templates.ts` — increments version via Prisma `{ increment: 1 }`, optionally applies content updates atomically
- ✅ `createAssignmentsForNewVersion(templateId, newVersion)` in `src/lib/assignments.ts` — finds all assignments at `templateVersion = newVersion - 1`, creates new assignments at `newVersion` with null dueDate; returns created assignments for notification dispatch
- ✅ `POST /api/admin/templates/[id]/publish-version` — increments version, creates new assignments, sends assignment notifications fire-and-forget; returns `{ template, previousVersion, newVersion, assignmentsCreated }`
- ✅ Manual assignment creation (`POST /api/admin/companies/[id]/assignments`) now fetches current template version and uses it for duplicate checks and assignment creation
- ✅ `getAssignmentsForUser` — updated deduplication: for each templateId, shows the highest-version assignment (at same version, individual beats company-wide)
- ✅ Admin templates page shows `v{N}` badge for templates at version > 1; standalone "Publish New Version" icon button per template row
- ✅ EditTemplateDialog has "Publish as New Version" button alongside "Save Template"
- ✅ Admin completions list shows `v{N}` badge next to template name when `templateVersion > 1`

---

## Enhancement Roadmap

Ordered by priority — quick wins and high-value UX first, then larger architectural features. Items later in the list may depend on earlier ones being in place.

### P8 — Name Validation at Completion Signing ✅ Done

**Goal:** Prevent fraudulent sign-offs where an authenticated user enters someone else's name on a completion record.

- ✅ Customer complete page (`src/app/customer/documents/[assignmentId]/complete/page.tsx`) has a "Declaration" section with a `declarationName` free-text field the user must type to confirm sign-off
- ✅ `POST /api/customer/assignments/[id]/complete` requires `declarationName` (400 if missing/blank) and compares it against `session.user.name` (case-insensitive, trimmed) — mismatch returns HTTP 400 with `nameError: true`; UI highlights the name field and shows a clear message
- ✅ Tested in `src/app/api/__tests__/customer-assignments.test.ts` — missing/blank declarationName, mismatch, case-insensitive + whitespace match

For kiosk sign-off (`/signoff/[companyId]`), the worker selects their own name from a dropdown, so no further name-matching is needed at this stage — the `workerId` is already validated server-side.

**Future hardening (P8+):**
- Require employee number or date of birth confirmation for higher-assurance sign-offs
- Optional password re-entry before signing (especially useful if someone else has access to an unlocked device)
- One-time PIN sent to line manager email before kiosk sign-off proceeds
- `CompletionRecord` already stores `signerName`; add IP address and user-agent capture for audit trail

---

### P9 — Dashboard: Completions-Centric Redesign ✅ Done

**Goal:** The admin dashboard is the first thing Simon sees. H&S compliance is fundamentally about completions — the dashboard should reflect that.

Changes:
- ✅ Top section: KPI tiles — active assignments, completed this month, outstanding, overdue (across all companies) with colour-coded values
- ✅ "Recent completions" feed replacing the generic activity feed (completion events only; uploads/logins still visible in full activity log)
- ✅ Quick-action links: "Outstanding"/"Overdue" KPI tiles and a "View outstanding completions" link now route to the dedicated `/admin/completions/outstanding` page (P12)
- ✅ Secondary stats (user count, company count, template count, documents) moved to "System Overview" section below

Key files: `src/lib/dashboard.ts` (`getDashboardKPIs`), `src/app/api/admin/dashboard/stats/route.ts`, `src/app/api/admin/dashboard/completions/route.ts`, `src/components/admin/recent-completions.tsx`, `src/app/admin/page.tsx`

---

### P10 — Users List: Group by Company ✅ Done

**Goal:** The flat `/admin/users` list becomes unwieldy as user counts grow across 100 client businesses.

- ✅ `/admin/users` page restructured into collapsible sections grouped by company (all collapsed by default)
- ✅ Internal staff (Platform Admin, Tenant Admin, Tenant Staff) appear first under an "Internal Staff" heading
- ✅ Customer users grouped by company name, sorted alphabetically; users without a company appear under "Unassigned"
- ✅ Section header shows user count; click to expand/collapse
- ✅ Search filters within all groups simultaneously; groups with no matches are hidden
- ✅ `GET /api/admin/users` enriched with `customerCompanyName` (resolved from `CustomerCompany` table via parallel fetch)
- ✅ All existing CRUD operations, role management, and dialogs unchanged

Key files: `src/app/admin/users/page.tsx`, `src/app/api/admin/users/route.ts`

---

### P11 — Activity Logs: Filter Controls and CSV Export ✅ Done

**Goal:** The current activity log is a paginated flat list with no filtering. Simon needs to investigate events by user, company, and event type.

- ✅ **Event type** — dropdown covering all 7 `ActivityType` values (view, download, upload, new_version, rename, delete, move); applied client-side so it's instant
- ✅ **Company** — dropdown populated from `CustomerCompany` list; selecting a company triggers a server-side refetch scoped to that company's users (resolved via Prisma → passed as `userIds[]` OData filter on `PartitionKey`)
- ✅ **User/file search** — free-text search across `userName` and `fileName`; applied client-side
- ✅ **Date range** — from/to date pickers; triggers server-side refetch with OData `timestamp ge/le` filter
- ✅ **Export CSV** — "Export CSV" button downloads the current filtered result set (all visible rows) as a `.csv` file; generated client-side with proper quoting and a datestamped filename
- ✅ Result count shown ("N entries") above the table

Key files: `src/lib/activity-logger.ts` (`ActivityLogFilters` interface + `buildODataFilter()`), `src/app/api/admin/activity/route.ts` (new `companyId`, `startDate`, `endDate` params), `src/app/admin/activity/page.tsx`

The graphs on the activity logs page are currently tracking vanity metrics (upload count, login count). Replace them with compliance-oriented KPIs — see P14 below.

---

### P12 — Outstanding Completions: Filtered Table and Spreadsheet Export ✅ Done

**Goal:** Simon currently has to navigate into each company individually to find outstanding or overdue items. A cross-company outstanding completions view is needed for client reporting and proactive chasing.

- ✅ New admin page `/admin/completions/outstanding`, one row per assignment with `outstandingCount > 0`:

| Column | Notes |
|---|---|
| Company | Links to `/admin/companies/[id]` |
| Template | Links to `/admin/templates` |
| Version | v{N} badge |
| Assigned To | User name (individual) or job role label / "All staff" (company-wide) |
| Due Date | Formatted, with overdue badge |
| Days Overdue | Calculated server-side in `getOutstandingCompletions` |
| Last Reminder | Date the reminders cron last sent a reminder for this assignment |

- ✅ **Filters:** Company (multi-select dropdown), template, job role, due date range, overdue-only toggle — all applied client-side against the full fetched row set
- ✅ **Sort:** due date (default, ascending, no-due-date last), company, template, overdue status — clickable column headers with `SortArrows`
- ✅ **Export:** CSV (client-side, matches P11's quoting convention) and XLSX (via `exceljs`, lazy-loaded on click to avoid bloating the initial bundle)
- ✅ Dashboard "Outstanding"/"Overdue" KPI tiles and a new quick-action link now route to this page; `/admin/completions` has a "View Outstanding" button

**Schema addition:** `Assignment.lastReminderSentAt DateTime?` — set by `GET /api/cron/reminders` (`prisma.assignment.updateMany`) each time reminders are sent for an assignment. Previously there was no persisted record of reminder sends.

Key files: `src/lib/outstanding-completions.ts` (`getOutstandingCompletions`), `src/app/api/admin/completions/outstanding/route.ts`, `src/app/admin/completions/outstanding/page.tsx`, `src/app/api/cron/reminders/route.ts`

---

### P13 — Template Version History: Change Log and Diff View ✅ Done

**Goal:** When Simon publishes a new version of a template (e.g. following new HSE legislation), there is currently no record of what changed or why. Auditors and company admins need to see the full version history with reasons.

- ✅ `TemplateVersionHistory` table — `templateId`, `version`, `changeReason?`, `snapshot Json` (`{title, description, formSchema, questions}`), `publishedAt`, `publishedBy?` (userId). Only ever holds *superseded* versions — the live version's content stays on `DocumentTemplate` itself, so there's no redundant "current" row
- ✅ `publishNewTemplateVersion` now requires `changeReason`; in one `prisma.$transaction`, it snapshots the current (about-to-be-replaced) content into `TemplateVersionHistory` and then increments the version + applies any content updates — atomic so a version is never incremented without its predecessor being recorded
- ✅ `POST /api/admin/templates/[id]/publish-version` returns 400 if `changeReason` is missing/blank; passes `session.user.id` as `publishedBy`
- ✅ "Publish as New Version" (both the templates list row action and the Edit Template dialog) now opens a shared `PublishVersionDialog` requiring a "Reason for change" field instead of a plain `confirm()`
- ✅ `GET /api/admin/templates/[id]/version-history` — combines the synthesized current version with past `TemplateVersionHistory` rows, resolves `publishedBy` to a display name, sorted by version descending
- ✅ Template preview dialog (`ViewTemplateDialog`) now has "Preview" and "Version History" tabs; the history tab lists all versions (date, author, reason), expandable to show the snapshot, plus a "Compare versions" control that renders a structured diff (title/description before→after, form fields and comprehension questions as added/removed/changed/unchanged) via the pure `diffTemplateSnapshots` function — additions green, removals red/strikethrough, unchanged grey, changed shown as a removed+added pair

Key files: `src/lib/template-version-history.ts`, `src/lib/template-version-diff.ts`, `src/app/api/admin/templates/[id]/version-history/route.ts`, `src/components/admin/publish-version-dialog.tsx`, `src/components/admin/template-version-history.tsx`, `src/components/admin/version-diff-view.tsx`, `src/components/admin/view-template-dialog.tsx`

---

### P14 — Activity Logs: KPI Graphs and Audit Metrics ✅ Done

**Goal:** Current graphs track volume metrics (uploads, logins) that have little meaning for H&S compliance. Replace with actionable compliance KPIs.

- ✅ **Completion rate by company** — horizontal bar chart, sorted ascending (worst first), colour-coded red/amber/green by threshold; shows `rate% (completed / total assignments)` in tooltip
- ✅ **Assignments vs completions per month** — dual bar chart over the last 12 months; a widening gap signals a growing backlog; month labels formatted as "Jan '24"
- ✅ **Average days to completion per template** — horizontal bar chart, sorted descending; tooltip shows count of completions used to compute the average
- ✅ **Risk indicators table** — 3 columns:
  - Companies with no completions in the last 30 days
  - Assignments with zero completions (coverage gaps; top 20, with "+N more" overflow)
  - Users with the most overdue items (top 10 ranked, with red badge count)

Old charts (daily activity, activity by type, top 5 users) removed from the activity logs page.

Key files: `src/lib/compliance-kpis.ts` (`getComplianceKPIs()`), `src/app/api/admin/dashboard/compliance-kpis/route.ts`, `src/components/admin/ComplianceDashboard.tsx`, `src/components/admin/charts/CompanyCompletionRateChart.tsx`, `src/components/admin/charts/MonthlyThroughputChart.tsx`, `src/components/admin/charts/TemplateAvgDaysChart.tsx`, `src/components/admin/RiskIndicatorsTable.tsx`

---

### P15 — Company Admin: Scoped Completions Dashboard ✅ COMPLETED

**Goal:** Company admins (a client company's manager) currently have no visibility of their employees' completion status. They need to see their own team's compliance without requiring Simon to pull a report for them.

**Implemented:** `/customer/admin/completions` (page + 3 API routes)

- Per-assignment completion status table scoped to `session.user.customerCompanyId`
- Outstanding users per assignment with overdue badges
- PDF download of individual employees' signed completion records (via SAS token)
- Filters: template name search, due date range, overdue-only toggle (all client-side)
- Export to CSV
- "Team Compliance" nav item in customer sidebar — visible only to Customer Admin role

API routes:
- `GET /api/customer/admin/completions` — lists completion groups; companyId always from session
- `GET /api/customer/admin/completions/[assignmentId]` — assignment status; validates assignment belongs to session company; returns `hasPdf: boolean` (not raw blobPath)
- `GET /api/customer/admin/completions/[assignmentId]/download/[completionId]` — SAS PDF download; validates completion → assignment → company chain

Security: company ID is always from `session.user.customerCompanyId`; `formData` (raw employee answers) is never returned; double-validates assignment + completion ownership on download.

This is a read-only feature — company admins cannot create assignments, manage templates, or access other companies. Full self-serve creation is P16.

---

### P16 — Auto-Assign Templates to Job Roles ✅ Done (Option B)

**Goal:** Reduce manual assignment work by automatically matching templates to users when their job role aligns with the template's `targetJobRoles`, and leave a durable "enrolled on [date]" audit record rather than relying solely on view-layer filtering.

**Implemented — Option B (explicit per-user auto-enrolment):**
- ✅ `Assignment.autoEnroll Boolean @default(false)` — set on a company-wide assignment (never on an individual one; `createAssignment` forces it to `false` whenever `userId` is set)
- ✅ `enrollMatchingUsersForAssignment(assignment)` in `src/lib/assignments.ts` — for a company-wide `autoEnroll` assignment, creates an individual enrolment `Assignment` for every company user whose `jobRole` matches `targetJobRoles` (or all users when `targetJobRoles` is null). Skips users already individually enrolled at that `templateVersion`
- ✅ `enrollUserInMatchingAssignments(userId, customerCompanyId, jobRole)` — for a single user, creates enrolment records for every matching `autoEnroll` company-wide assignment in their company
- ✅ Matching is stricter than the view-layer `isVisibleToJobRole` rule: a user with no `jobRole` does **not** match a role-restricted `autoEnroll` assignment (enrolment requires an explicit role match; viewing still falls back to "no role = sees everything")
- ✅ Hooked in at every point a user's enrolment eligibility can change:
  - `POST /api/admin/companies/[id]/assignments` — creating a company-wide assignment with `autoEnroll: true` immediately enrols all current matching users
  - `POST /api/auth/register` — a new customer user with a `customerCompanyId` is enrolled in matching assignments at creation
  - `PATCH /api/admin/users/[id]` — admin-driven `jobRole` changes re-run matching
  - `PATCH /api/profile` — self-service `jobRole` changes re-run matching
- ✅ `createAssignmentsForNewVersion` carries `autoEnroll` forward so a new template version keeps auto-enrolling matching users
- ✅ Enrolment creates an ordinary individual `Assignment` row (`autoEnroll: false`), so it naturally wins the existing "individual beats company-wide at the same version" dedup rule in `getAssignmentsForUser`, and its `createdAt` serves as the enrolment date for P15 company admin reporting
- ✅ "Auto-enroll matching users" checkbox added to `assign-template-dialog.tsx` (company-wide assignment dialog only — the individual `assign-to-user-dialog.tsx` has no need for it)

Key files: `src/lib/assignments.ts`, `src/app/api/admin/companies/[id]/assignments/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/profile/route.ts`, `src/components/admin/assign-template-dialog.tsx`

---

### P16b — Drag-and-Drop Form Builder with Starter Templates ✅ Done

**Goal:** The existing form field builder in the "Edit Template" dialog was functional but list-based — fields were added and reordered via buttons, which became tedious for forms with many fields. A drag-and-drop interface with pre-built starter templates makes form creation significantly faster for Simon and is a prerequisite for making the self-serve portal (P17) usable by non-technical company admins.

**Drag-and-drop reordering — ✅ Done:**
- ✅ Fields in the builder are grabbed by a drag handle (`GripVertical` icon) and reordered freely
- ✅ `@dnd-kit/core` + `@dnd-kit/sortable` — a single `DndContext` in `edit-template-dialog.tsx` wraps the field list (`SortableContext` + `verticalListSortingStrategy`); `KeyboardSensor` with `sortableKeyboardCoordinates` gives keyboard-navigable reordering alongside pointer drag
- ✅ No change to the underlying `formSchema` JSON format — reordering only changes array order; conditions (`Show only when`) that would end up referencing a field no longer earlier in the array are cleared automatically, same as the old up/down-button behaviour

**Field palette (click and drag-to-add) — ✅ Done:**
- ✅ `FieldTypePalette` (`src/components/admin/form-builder/field-type-palette.tsx`) — a panel alongside the canvas showing all 8 field types: Text, Long text, Number, Date, Yes/No, Dropdown, File upload, Section heading
- ✅ Clicking a palette item appends a field of that type to the end of the canvas
- ✅ Dragging a palette item onto the canvas (via `useDraggable`) inserts it before the field it's dropped on, or appends it if dropped on the empty canvas area (`useDroppable` id `fields-canvas`)
- ✅ **Schema extended** beyond the original four types to support the full palette: `FormFieldType` (`src/types/form-schema.ts`) now includes `number`, `select` (carries `options: string[]`), `file` (stores `{ blobPath, fileName }` once uploaded), and `section` (heading-only — no value, never required, excluded from stored `formData` and from PDF field rows)
- ✅ `select` fields get an inline options editor (add/remove/edit, minimum 2 non-empty options enforced in `validateForm`)
- ✅ `file` fields — full end-to-end support, not just a builder-only stub: new multipart upload endpoints `POST /api/customer/assignments/[id]/upload-file` and `POST /api/signoff/[companyId]/[assignmentId]/upload-file` (10MB limit, validates the field exists and is type `file`) upload to Blob Storage under `form-uploads/{assignmentId}/{userId}/{fieldId}-{timestamp}-{filename}` and return `{ blobPath, fileName }`; the customer/kiosk complete pages upload immediately on file selection via the shared `FormFieldRenderer` (`src/components/form-field-renderer.tsx`); the completion PDF shows the filename (`📎 filename.ext`) rather than embedding the file — reviewing the original uploaded file itself is not yet exposed in any admin UI (no download link), which is a known gap if that becomes necessary later

**Starter templates — ✅ Done:**
`src/lib/starter-templates.ts` — hardcoded, client-side-only presets (`STARTER_TEMPLATES`), loaded via `StarterTemplatePicker` (shown only when the field list is empty, per the original spec) which regenerates field ids on load so a preset can never collide with another loaded earlier in the session:

| Template name | Pre-populated fields |
|---|---|
| COSHH Assessment | Substance name, supplier, hazard classification (dropdown), exposure route (dropdown), PPE required, emergency procedure, assessor name |
| Manual Handling | Task description, load weight (kg) (number), frequency (dropdown), posture assessment, controls in place, residual risk rating (dropdown) |
| Risk Assessment | Hazard description, who is at risk, likelihood 1–5 (dropdown), severity 1–5 (dropdown), existing controls, further actions |
| Induction Checklist | Site rules acknowledged, PPE issued, emergency exits shown, fire assembly point confirmed, first aider contact known (all Yes/No) |
| Toolbox Talk Record | Topic, presenter, date, site/location, attendee names (long text, one per line — no dedicated multi-entry/repeater field type exists yet) |

**Implementation notes:**
- The builder lives in `src/components/admin/edit-template-dialog.tsx` plus `src/components/admin/form-builder/` (`field-type-palette.tsx`, `sortable-field-card.tsx`, `starter-template-picker.tsx`)
- `isFieldVisible` (condition logic) was consolidated into `src/lib/form-schema-utils.ts`, shared by the customer complete page, kiosk complete page, and admin preview dialog (previously duplicated four times)
- Required-field and visible-data server-side validation was consolidated into `src/lib/form-validation.ts` (`getMissingRequiredFields`, `getVisibleFormData`), shared by both completion API routes (previously duplicated)
- `FormFieldRenderer` (`src/components/form-field-renderer.tsx`) is a single component rendering all 8 field types, used by the customer complete page, kiosk complete page, and the admin preview dialog — replacing three near-identical render blocks
- This enhancement is also the foundation for the self-serve portal (P17) — company admins creating their own forms need the same builder, and the starter templates reduce the learning curve considerably

Key files: `src/types/form-schema.ts`, `src/lib/form-schema-utils.ts`, `src/lib/form-validation.ts`, `src/lib/starter-templates.ts`, `src/lib/pdf/completion-pdf.tsx`, `src/components/form-field-renderer.tsx`, `src/components/admin/edit-template-dialog.tsx`, `src/components/admin/form-builder/`, `src/app/api/customer/assignments/[id]/upload-file/route.ts`, `src/app/api/signoff/[companyId]/[assignmentId]/upload-file/route.ts`

---

### P17 — Self-Serve Portal: Company Admins Create and Assign Forms ✅ Done

**Goal:** Reduce Simon's workload by allowing company admins to create their own internal forms (e.g. site-specific induction checklists, internal risk assessments) and assign them to their own employees. Simon manages the canonical H&S template library; company admins manage their company-specific additions.

**Implemented:**
- ✅ `DocumentTemplate.ownerCompanyId String?` — null = tenant-managed (Simon's library); set = created by that `CustomerCompany`'s admin. `getAllDocumentTemplates` (Simon's library listing) filters `WHERE ownerCompanyId IS NULL`; `getDocumentTemplatesByOwnerCompany(companyId)` is the company-scoped equivalent, reused by both the company admin's own list and Simon's read-only view
- ✅ Company admin UI at `/customer/admin/templates` — template list (company-owned only, with an "Assigned" badge and version badge), reusing `CreateTemplateDialog`/`EditTemplateDialog` (both gained an optional `apiBasePath` prop, defaulting to `/api/admin/templates`, so the same form-field-builder + comprehension-question-builder UI works unmodified against `/api/customer/admin/templates`) and a new company-scoped `AssignCompanyTemplateDialog` (`src/components/customer/`) — a per-row "Assign" action (due date, job-role restriction, auto-enroll) rather than the main admin's per-company template dropdown, since the template is already known from the row and the company is always the session's own
- ✅ New API routes, all gated on `UserRole.CUSTOMER_ADMIN` + `session.user.customerCompanyId`, never accepting a company/owner id from the client:
  - `GET/POST /api/customer/admin/templates`, `GET/PATCH/DELETE /api/customer/admin/templates/[id]` (ownership-checked — 404 if the template belongs to another company or the tenant library), `POST /api/customer/admin/templates/[id]/publish-version` (identical to the main admin publish-version route, scoped)
  - `GET/POST /api/customer/admin/assignments` — company-wide only; rejects `templateId`s not owned by the session company (400) — assigning tenant-library templates is still Simon's job via the main admin portal; reuses `createAssignment`, `enrollMatchingUsersForAssignment`, `resolveEmailRecipients`, `sendAssignmentNotification` (same behaviour as `POST /api/admin/companies/[id]/assignments`)
  - `GET /api/customer/admin/users` — id/displayName/jobRole only, for the assign dialog's job-role dropdown
- ✅ "Company Templates" nav item added to the customer sidebar (Customer Admin only), alongside the existing "Team Compliance" (P15) link
- ✅ Consultancy read-only view: `GET /api/admin/companies/[id]/templates` (admin-only) + a "Company-Created Templates" table on `/admin/companies/[id]` — title/description/version/created date only, no edit/delete actions
- ✅ Versioning and completions work unchanged — `publishNewTemplateVersion`/`createAssignmentsForNewVersion`/`TemplateVersionHistory` are keyed by `templateId` regardless of `ownerCompanyId`; P15's `/customer/admin/completions` already reports on all of a company's assignments including self-serve ones

Key files: `src/lib/document-templates.ts`, `src/app/api/customer/admin/templates/`, `src/app/api/customer/admin/assignments/route.ts`, `src/app/api/customer/admin/users/route.ts`, `src/app/api/admin/companies/[id]/templates/route.ts`, `src/app/customer/admin/templates/page.tsx`, `src/components/customer/assign-company-template-dialog.tsx`, `src/components/admin/create-template-dialog.tsx`, `src/components/admin/edit-template-dialog.tsx`, `src/app/customer/layout.tsx`, `src/app/admin/companies/[id]/page.tsx`

---

### P18 — Navigation Shell: Unified Role-Aware Sidebar ✅ Done

**Goal:** Fix the disjointed navigation. Previously there were three parallel systems (a global top navbar, a card-grid home page everyone landed on, and section-only sidebars inside `/admin` and `/customer`), so admins landed on a near-useless grid of links (Documents, Scan, "Future Feature 1/2") with the real dashboard buried a click away, and the primary menu looked different depending on where you were.

**Implemented:**
- ✅ Single global app shell (`src/components/app-shell.tsx`) — slim top bar + one role-aware left sidebar (`src/components/app-sidebar.tsx`), collapsible-to-icons on desktop (preference persisted in `localStorage` as `sidebar-collapsed`, tooltips on the icon rail) and a slide-out drawer on mobile. Rendered once in `src/app/layout.tsx`, replacing the old `NavBar` (deleted).
- ✅ `app-sidebar.tsx` builds nav groups from the user's roles — admin (Dashboard, Users, Companies, Templates, Completions, Activity Logs, Settings + a low-prominence "Tools → Documents"), tenant staff (Documents), customer (My Documents, Completed Forms), customer admin (adds Team Compliance, Company Templates). It is the single source of truth for primary nav; the admin/customer layouts were reduced to just their page guards (`AdminPageGuard`/`CustomerPageGuard`), no longer carrying their own sidebars.
- ✅ Public/kiosk routes (`/auth`, `/signoff`, `/shared`, `/s/`) and signed-out users get a minimal top-bar-only chrome (brand + theme + sign-in), not the sidebar.
- ✅ Landing route: `src/app/page.tsx` (`/`) is now a server-side role redirect (admin → `/admin`, customer admin → `/customer/admin/completions`, customer user → `/customer/documents`, tenant staff → `/documents`, signed-out → `/auth/signin`) — the relevant dashboard/list is each role's home; the card-grid home page (and the Scan / "Future Feature" placeholders) is gone.
- ✅ Document scanning (`/scan`) is built but intentionally unlinked from navigation — it will return to the nav later; the page, `/api/scan/upload`, and its proxy guard remain in place.

Key files: `src/components/app-shell.tsx`, `src/components/app-sidebar.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/admin/layout.tsx`, `src/app/customer/layout.tsx`

---

### P18b — Navigation Shell Follow-ups: Breadcrumbs, Account Menu, Overdue Bell, Welcome Header ✅ Done

**Goal:** Round out the P18 navigation shell with the remaining SaaS-standard affordances: orientation on deep pages, a conventional place for account actions, and surfacing the reminders system proactively instead of only on the dashboard KPI tiles.

**Implemented:**
- ✅ Breadcrumbs (`src/components/breadcrumbs.tsx` + `src/components/providers/breadcrumb-provider.tsx`) — rendered above page content in `AppShell`, shown only when there are 2+ crumbs. Static segments resolve via a `ROUTE_LABELS` map; dynamic id segments (company/template/completion names) resolve via a `useBreadcrumbLabel(path, label)` registry populated by the 5 detail pages once their data loads (`admin/companies/[id]`, `admin/completions/[companyId]`, `admin/completions/[companyId]/[assignmentId]`, `customer/completions/[id]/view`, `customer/documents/[assignmentId]/complete`). Trailing action segments (`view`, `complete`) fold into the preceding entity crumb. `/documents` is excluded since its file browser already has its own folder breadcrumb.
- ✅ Account menu (`src/components/user-menu.tsx`) — avatar-initials dropdown in the top bar (Profile link + Sign Out), replacing the sidebar's old account footer. `app-sidebar.tsx`'s `SidebarRow` was simplified back to link-only (the button/`onClick` branch it needed for sign-out was dead code once removed).
- ✅ Notification bell (`src/components/notification-bell.tsx`) — top bar bell with an overdue-completions count badge, polled every 5 minutes, visible only to Admin and Customer Admin (the roles who chase outstanding sign-offs — not individual customer users or tenant staff). Reuses existing endpoints rather than adding new ones: `/api/admin/dashboard/stats`'s `overdue` KPI for Admin, `/api/customer/admin/completions`'s `isOverdue` groups for Customer Admin. Links through to the relevant outstanding/overdue view.
- ✅ Welcome header (`src/components/customer/welcome-header.tsx`) — one-line "Welcome back, {first name}" plus a status subtitle (pending/outstanding count) on `/customer/documents` and `/customer/admin/completions`, replacing their plain `<h1>`.

Key files: `src/components/breadcrumbs.tsx`, `src/components/providers/breadcrumb-provider.tsx`, `src/components/user-menu.tsx`, `src/components/notification-bell.tsx`, `src/components/customer/welcome-header.tsx`, `src/components/app-shell.tsx`, `src/components/app-sidebar.tsx`

---

### P19 — Upload-Based Documents (Word/PDF) ✅ Done

**Goal:** Alongside the online form builder (which is on hold for now), support templates authored as uploaded Word/PDF documents rather than structured `formSchema` fields — matching how Simon and customer managers actually work today (fill in a Word doc, then have staff read/sign it, or hand it out to be filled and returned).

**Architecture decisions:**
- `DocumentTemplate` gains `sourceType: 'form' | 'upload'` and, for uploads, `uploadMode: 'read-only' | 'fill-and-return'` (set by the author). Read-only: assignees view the shared uploaded document, then answer comprehension questions + sign. Fill-and-return: assignees download the shared source, fill it in offline, and upload their own completed copy as part of submission.
- Word documents are converted to PDF on upload for tamper evidence (viewable everywhere, normalises formatting, strips macros/track-changes) — but the original Word file is **always retained** alongside the PDF, so template renewal means editing the retained original and re-uploading, not losing editability.
- Employee fill-and-return submissions get the same treatment: converted PDF + retained original, stored on `CompletionRecord`, not `DocumentTemplate`.
- Web-only — no kiosk support for either upload mode (uploading/downloading files isn't practical at a shared kiosk terminal).
- Data extraction (search across filled-in form content) and SLM-generated comprehension questions are deliberately deferred — noted below, not blocking this work.

**Conversion service — Gotenberg:** Rather than bundling LibreOffice into the hardened `dhi.io` runner image, Word→PDF conversion is delegated to [Gotenberg](https://gotenberg.dev), a stateless HTTP wrapper around LibreOffice, run as a separate container (`src/lib/document-conversion.ts` calls `POST {GOTENBERG_URL}/forms/libreoffice/convert`).
- **Networking tradeoff:** the App Service Plan is on the Free (F1) SKU in both Dev and Prod, which does not support regional VNet integration — so private VNet isolation between the app and Gotenberg wasn't available without a plan upgrade (~$13/mo for B1). Decision: stay on F1, run Gotenberg on a **public** Azure Container Instance, locked down with Gotenberg's built-in basic auth (`--api-enable-basic-auth`, credentials generated by Terraform and stored in Key Vault). Traffic between the app and Gotenberg is not VNet-private or TLS-encrypted. **Revisit this if the App Service Plan is ever upgraded to B1+** — switch to `ip_address_type = "Private"` + regional VNet integration.

**Phase 1 — done (infra + conversion lib, nothing user-facing yet):**
- ✅ `infrastructure/modules/gotenberg/` — public ACI running `gotenberg/gotenberg:8`, basic auth credentials generated by Terraform and stored in Key Vault, wired into `infrastructure/modules/minato/main.tf` (`GOTENBERG_URL`, `GOTENBERG_BASIC_AUTH_USERNAME`/`PASSWORD` app settings)
- ✅ `src/lib/document-conversion.ts` — `isPdfMimeType`, `isConvertibleToPdf`, `convertToPdf()` (posts to Gotenberg, adds Basic auth header when credentials are configured, throws a clear error if `GOTENBERG_URL` isn't set); full unit test coverage with mocked `fetch`

**Phase 2 — done (schema + lib, nothing user-facing yet):**
- ✅ Migration `add_upload_based_documents` — `DocumentTemplate` gains `sourceType String @default("form")`, `uploadMode String?`, `sourceDocBlobPath`/`sourceDocOriginalBlobPath`/`sourceDocFileName` (all `String?`); `CompletionRecord` gains `submittedBlobPath`/`submittedOriginalBlobPath`/`submittedFileName` (all `String?`) — purely additive, applied to the dev database
- ✅ `src/types/document-template.ts` — `DocumentTemplateSourceType`, `DocumentTemplateUploadMode` literal types, shared by the lib layer and `TemplateSnapshot`
- ✅ `src/lib/document-templates.ts` — `DocumentTemplateData` and `create/update/publishNewTemplateVersion` extended with the new fields; `publishNewTemplateVersion`'s snapshot now carries `sourceType`/`uploadMode`/source doc paths forward into `TemplateVersionHistory`
- ✅ `src/lib/completion-records.ts` — `CompletionRecordData` and `createCompletionRecord` extended with submission fields; new `updateCompletionSubmission()` (mirrors `updateCompletionBlobPath`) for recording the employee's converted+retained filled copy after upload
- ✅ `src/types/template-version-history.ts` — `TemplateSnapshot` gains the same fields as optional (pre-P19 history entries won't have them)
- Note: `diffTemplateSnapshots` (`src/lib/template-version-diff.ts`) was deliberately left untouched — it doesn't need to diff source-document changes for this phase
- Note: `CompletionRecordForAdmin`/`CompletionRecordForAssignment` (admin-facing projections) were **not** extended to expose submission fields yet — that's Phase 3/4 work, once a route actually needs to show/download the employee's filled copy

**Phase 3 — done (admin authoring, upload-based templates fully creatable/editable):**
- ✅ `src/lib/storage.ts` — new `uploadBlob()`; `src/lib/document-upload.ts` — `uploadSourceDocument()` (PDF stored as-is, Word converted via Gotenberg with the original retained)
- ✅ `POST /api/admin/templates/upload-document` and `POST /api/customer/admin/templates/upload-document` — multipart upload endpoints (10MB limit, role-gated)
- ✅ Create/publish-version routes (admin + customer-admin) extended to accept/forward `sourceType`/`uploadMode`/source-doc blob paths; PATCH routes needed no changes (already forward the full body)
- ✅ `create-template-dialog.tsx` — form-vs-upload choice, upload mode, immediate upload+convert on file select; `edit-template-dialog.tsx` — replace-document section instead of the field builder for upload templates, comprehension questions unchanged; `view-template-dialog.tsx` and both templates list pages show an "Uploaded" badge; the dialog's Preview tab renders the actual source document (via `GET /api/admin/templates/[id]/document` + the shared `PDFRenderer`) instead of a placeholder — this was originally stubbed out pending Phase 4's employee-facing viewer, then fixed once that viewer landed by reusing the same `PDFRenderer`/proxy pattern, just admin-scoped instead of company-scoped

**Phase 4 — done (employee consumption, read-only sign-off end to end):**
- ✅ `src/lib/assignments.ts` — `TEMPLATE_SELECT`/`AssignmentWithTemplate`/`toAssignmentWithTemplate` extended with `sourceType`/`uploadMode`/`sourceDocBlobPath`/`sourceDocFileName` (this was a real gap — assignments previously didn't carry these fields at all, so the employee-facing routes had no way to know a template was upload-based)
- ✅ `GET /api/customer/assignments/[id]/document` — SAS view URL for the source PDF (`generateSasToken`, `inline` disposition), company-scoped, 404s for non-upload templates or missing blob path
- ✅ `customer/documents/[assignmentId]/complete/page.tsx` — renders the existing `PDFRenderer` (reused as-is from `documents/view/[...name]/components/PDFRenderer.tsx` — pagination, zoom, print, download all included for free) in place of the form-field list when `sourceType === 'upload'`; comprehension questions + declaration/signature sections are unchanged and apply to both template kinds
- ✅ `customer/documents/page.tsx` — assignment cards show "Read & Sign" / "Re-read & Sign" instead of the form-fields wording for upload templates
- Fill-and-return was not handled at the end of Phase 4 — that gap is closed by Phase 5 below.

**Phase 5 — done (fill-and-return, end to end):**
- ✅ `POST /api/customer/assignments/[id]/upload-submission` — company/assignment-scoped upload endpoint for the employee's own filled-in copy; 400s unless the template is `sourceType: 'upload'` + `uploadMode: 'fill-and-return'`; reuses `uploadSourceDocument()` (PDF as-is, Word converted + original retained) with a `assignment-submissions/{assignmentId}/{userId}-{versionId}` path prefix; returns blob paths only — nothing is persisted to the database at this step since the `CompletionRecord` doesn't exist yet
- ✅ `POST /api/customer/assignments/[id]/complete` — now requires a `submission` (`{blobPath, originalBlobPath, fileName}`) in the request body whenever the assignment's template is `fill-and-return`, 400ing with "Please upload your completed copy of the document before signing." if missing; passes the fields straight through to `createCompletionRecord()`'s existing `submittedBlobPath`/`submittedOriginalBlobPath`/`submittedFileName` params (no need for the separate `updateCompletionSubmission()` two-step, since the submission is already uploaded and converted before the record is created — unlike the signed PDF, which needs the record's own id for its filename)
- ✅ `customer/documents/[assignmentId]/complete/page.tsx` — renders an upload step below the `PDFRenderer` when `uploadMode === 'fill-and-return'` (same file-input/spinner/replace pattern as the `file` form field type in `form-field-renderer.tsx`); client-side blocks submission with a toast until a file has been uploaded, mirroring the server-side 400
- ✅ `customer/documents/page.tsx` — assignment cards show "Fill & Sign" / "Re-fill & Sign" for fill-and-return templates (vs "Read & Sign" / "Re-read & Sign" for read-only ones)
- Web-only, as planned — no kiosk changes (fill-and-return was never meant to be kiosk-accessible)

**Customer-admin self-serve parity (P17) — confirmed, no gap found:** traced the full chain (`POST /api/customer/admin/templates` → `createAssignment` → `getAssignmentWithTemplate`'s `TEMPLATE_SELECT` → the employee-facing `/document`, `/upload-submission`, `/complete` routes) and `ownerCompanyId` is never referenced anywhere in the employee-facing path — access is scoped purely by `assignment.customerCompanyId === session.user.customerCompanyId`. `TEMPLATE_SELECT` (`src/lib/assignments.ts`) doesn't even select `ownerCompanyId`, so a self-serve upload template and a tenant-managed one are structurally indistinguishable to an employee. All phases of P19 are complete.

**Deferred, no target date:**
1. SLM-generated comprehension questions with a human-review gate before publish
2. Structured data extraction from filled-in documents into a searchable store (Document Intelligence is already provisioned via Terraform for this — `infrastructure/modules/document_intelligence/` — but unused in application code so far)

Key files so far: `infrastructure/modules/gotenberg/`, `infrastructure/modules/minato/main.tf`, `src/lib/document-conversion.ts`, `src/lib/document-upload.ts`, `src/lib/storage.ts`, `prisma/schema.prisma`, `prisma/migrations/20260708222132_add_upload_based_documents/`, `src/types/document-template.ts`, `src/types/template-version-history.ts`, `src/lib/document-templates.ts`, `src/lib/completion-records.ts`, `src/lib/assignments.ts`, `src/app/api/admin/templates/upload-document/`, `src/app/api/customer/admin/templates/upload-document/`, `src/app/api/customer/assignments/[id]/document/`, `src/app/api/customer/assignments/[id]/upload-submission/`, `src/app/api/customer/assignments/[id]/complete/`, `src/components/admin/create-template-dialog.tsx`, `src/components/admin/edit-template-dialog.tsx`, `src/app/customer/documents/[assignmentId]/complete/page.tsx`, `src/app/customer/documents/page.tsx`

---

### P20 — Dashboard Drill-Downs, Settings Cleanup, Template Categorisation ✅ Done

**Goal:** A batch of small admin-side usability fixes: the "Active Assignments" and "Completed This Month" KPI tiles on `/admin` were dead (non-clickable, unlike "Outstanding"/"Overdue"); there was no "Completed This Week" figure; the Azure Integration settings tab was entirely hardcoded/fake (always showed "Connected to Azure AD" regardless of reality, with no live check or functional content); and `/admin/templates` had no way to organise the growing template library (e.g. several COSHH-related documents) or search it.

**Dashboard drill-downs — ✅ Done:**
- ✅ `getDashboardKPIs` (`src/lib/dashboard.ts`) gains `completedThisWeek` (Monday-start week, UK convention) alongside the existing calendar-month `completedThisMonth`
- ✅ "Active Assignments" and "Completed This Month" tiles on `/admin` are now `Link`-wrapped like "Outstanding"/"Overdue" already were; a new "Completed This Week" tile was added (grid: `sm:grid-cols-2 lg:grid-cols-5`)
- ✅ New page `/admin/assignments` — every assignment across every company, unfiltered (deliberately matches the KPI's raw `assignment.count()` exactly; no CSV export or heavy filter toolbar, just a sortable table), backed by `getAllAssignmentsForAdmin()` (`src/lib/assignments.ts`, modelled on the existing `getOutstandingCompletions()` pattern minus the outstanding-only filter) and `GET /api/admin/assignments`
- ✅ New page `/admin/completions/history` — every completion, client-side filterable by signed date (`from`/`to` query params, deep-linked from the "This Week"/"This Month" KPI tiles), with a PDF download action per row. No lib changes were needed — `getAllCompletionsForAdmin()` already existed and returned exactly what was required

**Settings cleanup — ✅ Done:**
- ✅ Azure Integration tab removed from `/admin/settings` entirely (was static JSX with a hardcoded "Connected" status — not a real check, no supporting API route, nothing functional to preserve)

**Template categorisation — ✅ Done:**
- ✅ `DocumentTemplate.category String @default("General")` — fixed 8-value enum (`COSHH`, `Fire Safety`, `First Aid`, `General`, `Manual Handling`, `Other`, `PPE`, `Risk Assessment`; `src/types/document-template.ts`'s `DocumentTemplateCategory`/`DOCUMENT_TEMPLATE_CATEGORIES`)
- ✅ Editable at any time — behaves like `title`/`description` (updatable via plain edit-and-save, updatable via publish-version, snapshotted into `TemplateVersionHistory`) rather than frozen like `sourceType`, since it's a correctable classification rather than structural content
- ✅ `create-template-dialog.tsx`/`edit-template-dialog.tsx` both gained a category `Select` field; since these dialogs are shared verbatim with the customer self-serve portal (P17) via `apiBasePath`, company-created templates get a category too — but `/customer/admin/templates` itself was **not** changed to add grouping/search, only `/admin/templates` was
- ✅ `/admin/templates` restructured to group templates into collapsible sections by category (fixed alphabetical iteration order, empty categories hidden) plus a search bar — mirrors `/admin/users`'s existing company-grouping pattern (`groupUsers`/`renderGroup`/`expandedGroups`) exactly, just grouped by category instead of company

Key files: `src/lib/dashboard.ts`, `src/lib/assignments.ts` (`getAllAssignmentsForAdmin`), `src/app/api/admin/assignments/route.ts`, `src/app/admin/assignments/page.tsx`, `src/app/api/admin/completions/history/route.ts`, `src/app/admin/completions/history/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/settings/page.tsx`, `prisma/schema.prisma`, `prisma/migrations/20260718211605_add_template_category/`, `src/types/document-template.ts`, `src/lib/document-templates.ts`, `src/components/admin/create-template-dialog.tsx`, `src/components/admin/edit-template-dialog.tsx`, `src/app/admin/templates/page.tsx`

---

## Document Model

### Current state (as of 2026-04)
Files are stored as blobs in Azure Blob Storage with a hierarchical path structure. The template → assignment → completion flow is now partially built:

- **Templates** — created and managed by admins; each template has a `formSchema` (JSON array of `FormField`) defining what the customer fills in; admin can edit via the form field builder in `/admin/templates`
- **Assignments** — templates assigned to customer companies; visible to customers at `/customer/documents`
- **Completions** — customers navigate to `/customer/documents/[assignmentId]/complete`, fill in the form, and submit; `CompletionRecord` is written with `formData`; PDF uploaded to `completions/{recordId}.pdf`; customer and admin can download signed PDF
- **Customer documents page** — shows assigned documents with Pending/Complete badges; "Fill In & Complete" navigates to the form page; "Mark Complete" for no-form templates works directly

All of Steps 1–8 are now complete:
- ✅ Form schema on templates (admin form field builder)
- ✅ Customer form page at `/customer/documents/[assignmentId]/complete`
- ✅ Required-field validation in the complete API
- ✅ PDF generation via `@react-pdf/renderer` (`src/lib/pdf/completion-pdf.tsx`); uploaded to Blob Storage at `completions/{recordId}.pdf`
- ✅ Customer can download their signed PDF from `/customer/documents`
- ✅ Admin completions view at `/admin/completions` with per-record PDF download
- ✅ Customer users must be linked to a company at creation time (or via role change); `Create User` and `Change Role` dialogs now include a company selector for customer roles
- ✅ Individual-level assignment — `Assignment.userId` nullable field; `userId = null` = company-wide (all users see it), `userId` set = only that user sees it; two partial unique indexes enforce uniqueness; admin can assign to individual users from the company detail page; customer sees company-wide + individual combined (deduplicated)

**Remaining for the completion flow:**
- ✅ Signature pad (canvas) — `react-signature-canvas`, embedded drawn signature into PDF (Step 8) — see Electronic Signing below for details
- Data retention / immutability policy — prevent deletion of completion blobs

### Target model
The correct mental model is **templates → assignments → completions**:

- **Template library** — a set of reusable H&S documents (e.g. farmyard safety checklist, power tools checklist, food packing machine checklist). Maintained by the H&S consultancy admin.
- **Customer assignment** — each customer is assigned a subset of templates relevant to their business type (e.g. a farmer gets farmyard + power tools; a food factory gets power tools + food packing machine). Some templates may be customised per customer (e.g. arable farm vs livestock farm variant).
- **Completion/signing** — when a customer completes a document, it is signed and becomes immutable. The signed copy belongs to that customer only and is not visible to others. A signed PDF with audit trail is the target format.

This is an inherently relational model:
- Templates are shared across many customers
- Customers have many assigned templates
- Each assignment has a completion state, signer identity, and timestamp
- A company may have multiple users, each with access to a subset of that company's assigned documents

This model **cannot be cleanly implemented in Azure Table Storage** — see the Database section below.

---

## Data Layer: Azure Table Storage vs PostgreSQL

### Current approach (as of 2026-04)
User accounts and password reset tokens are stored in **Neon PostgreSQL** via **Prisma ORM**. Activity logs remain in Azure Table Storage (well-suited to append-only, time-series data with no relational queries).

**Migration completed:** `prisma/schema.prisma` defines `Tenant`, `User`, and `PasswordReset` models. The schema includes a nullable `tenantId` on `User` so multi-tenancy can be enforced later without a schema change. The Prisma client is generated to `src/generated/prisma/` and accessed via a singleton at `src/lib/prisma.ts` using `@prisma/adapter-pg`.

**What stays in Azure Storage:**
- Blob Storage — all file storage stays here permanently
- Table Storage — `activityLogs` table only (Terraform corrected to provision this table; the old stale `users` table definition has been removed)

### Why PostgreSQL was needed
The document model (templates → assignments → completions) requires:
- Many-to-many relationships (customers ↔ templates)
- Per-assignment state (completed, signed, by whom, when)
- Per-user access scoping within a company
- Transactional writes (create assignment + log activity atomically)
- Relational queries ("which templates does this customer have?", "which customers have completed this template?")

Table Storage handles none of these well.

### Schema (current — as of 2026-04)

```
Tenant              — one row per H&S company using the platform (future multi-tenancy; populated when needed)
User                — belongs to a Tenant; has a Role; customer-role users also link to a CustomerCompany
PasswordReset       — one token per user; expires after 1 hour
CustomerCompany     — a client business; belongs to a Tenant
DocumentTemplate    — a reusable H&S document; belongs to a Tenant; blobPath nullable (form-only templates)
Assignment          — links a DocumentTemplate to a CustomerCompany (company-wide, userId=null) or to a specific User (individual, userId set); partial unique indexes enforce uniqueness per scope
CompletionRecord    — a customer user's signed completion; blobPath nullable until PDF generation is built; formData Json? for Document Intelligence
```

No separate `CustomerUser` model — the existing `User` model covers customer users via `customerCompanyId` (nullable; set for Customer Admin / Customer User roles, null for consultancy staff).

### Remaining deployment work
- Migrate existing users from Azure Table Storage to PostgreSQL (one-time data migration script needed if there are production users)
- Run `terraform apply` after the latest IaC fixes: storage table renamed from `users` → `activityLogs`; dead `azure_ad`/`redirect_uris` variables removed; `DEFAULT_ADMIN_EMAIL` now set via computed app settings; dev outputs now include `cron_secret`

---

## Role Model

### Current roles (as of 2026-04)
Five roles are implemented, stored as strings in the `User.role` column and attached to the JWT at sign-in. Defined in `src/types/rbac.ts`.

| Role | Description | Admin portal access |
|---|---|---|
| `Platform Admin` | Alan — manages tenants, billing, platform config | Yes |
| `Tenant Admin` | H&S consultancy admin (Simon) — manages templates, customers, users | Yes |
| `Tenant Staff` | H&S consultancy employee — can view documents and activity logs | No |
| `Customer Admin` | A client company's manager — view documents and users | No |
| `Customer User` | An individual within a client company — view and download docs only | No |

`ADMIN_ROLES` (`Platform Admin`, `Tenant Admin`) is used as the gate for all admin API routes and the admin portal UI. The `ROLE_PERMISSIONS` map in `rbac.ts` defines what each role can do.

### What remains
- Role assignments will need to be per-tenant once multi-tenancy is introduced — the JWT will need to carry tenant context alongside the role.
- `Read-only / Auditor` role deferred until a concrete use case appears.

---

## Electronic Signing ✅ Done (options 1 and 2)

### Requirement
Customers need to sign completed documents. A signed document should be immutable, attributable to a specific user, and timestamped.

### Options (in order of complexity)

1. **✅ Simple audit trail** — `CompletionRecord` stores signer identity (`signedById`), timestamp (`signedAt`), and a typed `declarationName` matched against the account name (P8). A signed PDF is generated server-side via React-PDF.

2. **✅ Signature pad** — a canvas-based signature capture, embedded as an image into the generated PDF.
   - `react-signature-canvas` (`src/components/signature-pad.tsx`) — resizes its canvas to its container via `ResizeObserver` (native canvas resize wipes the bitmap, so the component clears and re-emits `null` on a real container-width change to keep state consistent); "Clear signature" button; exposes a trimmed PNG data URL via `onChange`.
   - **No new DB column or blob storage.** The signature is captured client-side, sent as part of the completion request body, and baked directly into the immutable signed PDF via `@react-pdf/renderer`'s `<Image>` (`CompletionPDFProps.signatureDataUrl`, `src/lib/pdf/completion-pdf.tsx`). Since PDFs are never regenerated once created, there was no need to persist the raw signature separately — avoids scope creep and an unused migration.
   - `src/lib/signature.ts` (`isValidSignatureDataUrl`) validates the value server-side: must be a `data:image/png;base64,...` string, max 500,000 base64 chars (~375KB decoded) — generous for a trimmed signature capture, rejects anything absurd.
   - Required on both completion routes — `POST /api/customer/assignments/[id]/complete` and `POST /api/signoff/[companyId]/[assignmentId]` — 400s with "A signature is required to sign this document." if missing/invalid, mirroring the existing `declarationName` requirement (checked immediately after it, before the fill-and-return/name-match/comprehension checks).
   - Both completion UIs (`customer/documents/[assignmentId]/complete/page.tsx`, `signoff/[companyId]/[assignmentId]/complete/page.tsx`) render `SignaturePad` in the Declaration section below the typed name, client-side blocking submission with a toast until signed, mirroring the server-side 400.

3. **Third-party e-signing** (DocuSign, Adobe Sign, Yoti) — legally stronger, tamper-evident certificates, better audit trail. Costs money and adds integration complexity. Not needed unless there is a specific legal or customer requirement.

Key files: `src/components/signature-pad.tsx`, `src/lib/signature.ts`, `src/lib/pdf/completion-pdf.tsx`, `src/app/api/customer/assignments/[id]/complete/route.ts`, `src/app/api/signoff/[companyId]/[assignmentId]/route.ts`, `src/app/customer/documents/[assignmentId]/complete/page.tsx`, `src/app/signoff/[companyId]/[assignmentId]/complete/page.tsx`

---

## PDF Generation

### Requirements
- Convert web forms into PDFs
- Embed completion/signing metadata into the PDF
- PDFs must be immutable after signing

### Recommended approach
Use **`@react-pdf/renderer`** (React-PDF) — renders React components to PDF server-side. Works well in Next.js API routes. Free, no external dependency.

Workflow:
1. Customer fills in a web form (Next.js page)
2. On submission, a Next.js API route renders the form data as a PDF using React-PDF
3. The PDF is uploaded to Azure Blob Storage with a content hash in the path (makes it immutable by construction)
4. A `CompletionRecord` is written to the database with the blob path, signer identity, and timestamp
5. The original template is never modified

---

## Document Intelligence (Azure AI)

### Potential use
Azure Document Intelligence (formerly Form Recognizer) can extract structured data from uploaded PDFs and scanned documents — converting form fields into queryable JSON.

### When this makes sense
- If customers upload scanned paper forms that need to be processed into structured records
- If the platform needs to search or filter across form responses (e.g. "show all farms where the fire exit checklist was marked as non-compliant")
- If historical paper documents need to be ingested into the system

### Cost
Azure Document Intelligence has a free tier (500 pages/month). Beyond that it charges per page. For a small H&S consultancy this is likely within the free tier initially.

### Recommendation
Defer until there is a clear use case. The programmatic PDF generation approach (above) produces structured data natively — Document Intelligence is only needed when the source document is a scan or an unstructured upload. Design the `CompletionRecord` schema to include a `formData` JSON field from the start so structured data can be stored regardless of how it is captured.

---

## Multi-tenancy

### Current state
The app is single-tenant — one H&S company, one set of users, one document library.

### Future state
If the platform is marketed to other H&S companies, each company needs:
- Their own document template library
- Their own customer base
- Their own admin users
- Data isolation from other tenants

### Recommended approach: shared database, tenant-scoped rows

Add a `tenantId` foreign key to every table. All queries are scoped by `tenantId`. This is simpler to operate than separate databases per tenant and scales well to hundreds of tenants. Row-level security in PostgreSQL can enforce tenant isolation at the database level.

**Do not build this yet** — but design the schema with a `Tenant` table and `tenantId` columns from the start. Adding multi-tenancy to a schema that was designed for it is straightforward; retrofitting it is painful.

---

## Testing Strategy

### Current state
Vitest is configured. Unit and integration tests are in place. E2E tests are not yet written.

**Stack:**

| Layer | Tool | Status |
|---|---|---|
| Unit | Vitest | Done — full coverage of `src/lib/` and `src/lib/file-system/` |
| Integration | Vitest (direct route handler calls) | Done — health, admin user CRUD, forgot/reset password, all document routes |
| E2E | Playwright | Not yet started |
| Coverage | Vitest built-in (`v8`) | Configured |

**Integration tests cover all document routes** (`src/app/api/__tests__/documents.test.ts`): upload, download, delete, move, rename, share, versions — auth checks, validation, success paths, and failure paths for each.

**TDD workflow:**
1. Define interface types and function signatures first
2. Write tests against the interface (before implementation exists)
3. Implement to make the tests pass
4. Review both together

This works well and catches design problems early. Always request tests before implementation.

**Test discipline (non-negotiable):** update existing tests whenever code changes; write new tests whenever new code is added.

### What remains
- **E2E tests (Playwright)** — sign in, view documents, admin manages users. Add once the document model is more stable, as UI tests are brittle against layout changes. Add Playwright step to CI after the suite exists.

### Coverage target
High coverage on `src/lib/` (>90%) and critical API routes. E2E coverage of the five to ten most important user journeys. Do not chase 100% coverage at the expense of test quality.

---

## Free Tier Architecture

### Target: zero cost until paying customers exist

| Service | Free tier | Notes |
|---|---|---|
| Azure App Service | F1 (free) — 60 CPU min/day, 1 GB RAM | No custom domain SSL on F1; upgrade to B1 (~£10/month) when needed |
| Azure Blob Storage | 5 GB free (12 months), then ~£0.016/GB | Negligible cost for lots of small files |
| Azure Table Storage | 5 GB free (12 months) | Activity logs only once DB is migrated |
| Neon PostgreSQL | Free tier — 0.5 GB, auto-suspend | Sufficient for <100 customers; migrate to paid when needed |
| Azure Communication Services | 100 emails/day free | Already provisioned |
| Azure Document Intelligence | 500 pages/month free | Defer until needed |
| GitHub Actions | 2,000 min/month free (private repos) | Sufficient for CI/CD |
| GitHub Container Registry | Free for public images; 1 GB free for private | Already in use |

### When to start spending
- Custom domain + SSL certificate → upgrade App Service to B1
- Storage exceeds free tier → Blob Storage pricing is cheap, not a concern
- Database exceeds Neon free tier → migrate to Neon paid (~$19/month) or Azure Database for PostgreSQL (~£25-50/month)
- More than 100 emails/day → ACS pricing is low (£0.00025/email)

---

## Deployment Pipeline

### Current state
GitHub Actions: lint → security scan → Docker build/push → Azure deploy → release. Triggered on `main` (prod) and `dev` (dev environment) branches.

### Current state
Lint, format check, type check, and all Vitest tests (unit + integration) run on every PR and release via `lint-format.yml`.

### Gaps to address
- No E2E tests in the pipeline — add a Playwright step after the Docker build once E2E tests exist
- No staging environment — consider adding a `staging` branch/environment between `dev` and `main`
- No database migration step — ✅ Done. `prisma migrate deploy` runs in `azure-deploy.yml` before the App Service deploy step, using `DATABASE_URL` from GitHub environment secrets.
- No smoke test after deployment — ✅ Done. `GET /api/health` with 12 retries × 15s runs in `azure-deploy.yml` after the App Service deploy step.

### Recommended pipeline order (target state)
1. Lint + format check + type check + unit/integration tests (`npm run checks`) ✓ done
2. Docker build + push
3. E2E tests against the built app (Playwright) — not yet
4. Database migration (`prisma migrate deploy`) ✓ done — runs in `azure-deploy.yml` before deploy
5. Azure deploy
6. Post-deploy smoke test ✓ done — runs in `azure-deploy.yml` after deploy
7. Release tag

---

## Compliance & Data Protection

### GDPR (UK)
- All data is UK-resident (Azure UK South / UK West regions)
- Personal data includes: user names, email addresses, signed documents (may contain signatures, employee names)
- Retention policy needed: how long are completed/signed documents kept? Who can delete them?
- Right to erasure: design user deletion to anonymise rather than hard-delete where documents must be retained for compliance purposes

### Health & Safety regulations
- Signed H&S checklists may need to be retained for a defined period (typically 3-5 years under UK H&S law)
- The immutable signed PDF approach (content-addressed blob path) supports this naturally
- Audit trail in activity logs supports evidence of compliance

### Actions needed
- Add a data retention policy to the admin settings
- Add a privacy policy page
- Confirm with Simon whether any industry-specific H&S standards require certified e-signatures vs simple audit trails
