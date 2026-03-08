# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier write
npm run format:check # Prettier check
npm run checks       # lint + format + tsc --noEmit (run before committing)
npm test             # Jest (test files must be in __tests__/**/*.test.ts)
npm run setup:admin  # Interactive CLI to create an admin user (requires Azurite running)
```

### Local Development Prerequisites

1. Start Azurite before running the app:
   ```bash
   azurite --silent --location c:\azurite --debug c:\azurite\debug.log
   ```
2. Create `.env.local`:
   ```env
   USE_AZURITE=true
   NEXTAUTH_SECRET=any-random-string
   NEXTAUTH_URL=http://localhost:3000
   ```
3. Create an admin user: `npm run setup:admin`

When `USE_AZURITE=true` and `NODE_ENV=development`, all Azure Storage clients connect to `UseDevelopmentStorage=true` instead of `AZURE_STORAGE_CONNECTION_STRING`.

## Architecture

### Stack
- **Next.js 15** (App Router, server components by default)
- **NextAuth v4** — credentials-only (email/password), JWT sessions
- **Azure Blob Storage** — document files + URL shortener mappings
- **Azure Table Storage** — users table and activity logs table
- **TanStack Table v8** — document listing table with custom cell renderers
- **shadcn/ui** (Radix UI primitives) + **Tailwind CSS v4**

### Key Data Flows

**Documents page** (`/documents?path=<folder>`): Server component fetches via `listBlobs()` → `FileManager.listContent()` → Azure Blob Storage. Folders are represented as `.folder` marker blobs (e.g. `myfolder/.folder`). The `path` query param navigates into subfolders.

**Versioning**: Files are stored with a `_v_TIMESTAMP` suffix (e.g. `report_v_2024-01-15T10-30-00-000Z.pdf`). `src/lib/version-manager.ts` groups blobs by base name and assigns sequential version numbers. `listBlobs()` always shows only the latest version per document by default.

**Authentication flow**: `src/middleware.ts` protects `/documents/*` and `/scan/*`. `src/lib/auth.ts` configures NextAuth to verify credentials against Azure Table Storage (`users` table, partitioned by `'users'`, rowKey = email).

**RBAC**: Three roles — `Administrator`, `Employee`, `Customer` (defined in `src/types/rbac.ts`). The `RBACProvider` wraps the app and exposes `useRBAC()` hook. Use `<PermissionGuard>` for conditional UI rendering. API routes check permissions server-side independently.

### Library Structure

```
src/lib/
  file-system/          # Azure Blob Storage abstraction
    file-manager.ts     # FileManager class + getFileManager() singleton factory
    file-operations.ts  # delete, rename, move, download URL for files
    folder-operations.ts# create, delete, rename, move for folders
    path-utils.ts       # normalizePath, isDirectChild, FOLDER_SEPARATOR, FOLDER_MARKER
    format-utils.ts     # formatSize helper
    types.ts            # FileItem, FileOperationResult, ActivityLogParams
  version-manager.ts    # Document versioning (parseFileName, groupDocumentsByVersion)
  list-blobs.ts         # listBlobs() — main data-fetching function for documents page
  activity-logger.ts    # logActivity() writes to Azure Table Storage 'activityLogs' table
  user-database.ts      # CRUD operations against Azure Table Storage 'users' table
  auth.ts               # NextAuth configuration
  storage.ts            # generateSasToken() helper
  url-shortener.ts      # Short URL creation/resolution stored in 'url-shortener' blob container
```

### API Routes

All document mutation routes live under `src/app/api/documents/` (delete, download, move, rename, upload, share, versions). Admin routes are under `src/app/api/admin/`. The `scan/upload` route handles mobile document scanning uploads.

### Path Alias

`@/` maps to `src/` throughout the codebase.

## Infrastructure (Terraform)

Located in `infrastructure/`. Modules: `resource_group`, `key_vault`, `storage`, `app_service`, `azure_ad`, `document_portal` (composition). Environments: `env/dev`, `env/prod`. State managed remotely (bootstrapped via `infrastructure/bootstrap/`).
