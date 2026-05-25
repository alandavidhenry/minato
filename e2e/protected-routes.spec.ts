import { expect, test } from '@playwright/test'

import { mockNoSession } from './fixtures/mock-session'

// Routes protected by proxy.ts (server-side redirect)
const PROXY_PROTECTED = [
  '/customer/documents',
  '/customer/completions',
  '/profile'
]

// Routes protected client-side by permission guards
const CLIENT_GUARDED = ['/admin', '/admin/users', '/admin/companies']

test.describe('Proxy-protected routes redirect to sign-in', () => {
  for (const path of PROXY_PROTECTED) {
    test(`${path} redirects unauthenticated user`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/auth\/signin/)
    })
  }
})

test.describe('Client-guarded admin routes redirect to /unauthorized', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoSession(page)
  })

  for (const path of CLIENT_GUARDED) {
    test(`${path} redirects to /unauthorized`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL('/unauthorized')
    })
  }
})
