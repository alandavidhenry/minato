// Seeded test accounts used by the Playwright suite.
//
// The Tenant Admin account is created by `node scripts/seed-admin.js` from
// DEFAULT_ADMIN_EMAIL — there's no fixed default, so it must be supplied via
// env vars. The Customer Admin/User accounts come from `npm run db:seed`
// (prisma/seed.ts), which fabricates deterministic emails per company and
// accepts an optional password override — both have working fallbacks that
// match that script's defaults.

export const ADMIN_STATE = 'playwright/.auth/admin.json'
export const CUSTOMER_ADMIN_STATE = 'playwright/.auth/customer-admin.json'
export const CUSTOMER_USER_STATE = 'playwright/.auth/customer-user.json'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} must be set to run the Playwright suite (see e2e/credentials.ts)`
    )
  }
  return value
}

export const adminCredentials = {
  get email() {
    return requireEnv('E2E_ADMIN_EMAIL')
  },
  get password() {
    return requireEnv('E2E_ADMIN_PASSWORD')
  }
}

export const customerAdminCredentials = {
  email:
    process.env.E2E_CUSTOMER_ADMIN_EMAIL ??
    'admin@northgatelogistics.example.com',
  password: process.env.E2E_CUSTOMER_PASSWORD ?? 'Password123!'
}

export const customerUserCredentials = {
  email:
    process.env.E2E_CUSTOMER_USER_EMAIL ??
    'worker1@northgatelogistics.example.com',
  password: process.env.E2E_CUSTOMER_PASSWORD ?? 'Password123!'
}
